// Admin logo upload. Accepts a raw image/* body, streams it straight into
// the public play-assets bucket, and persists the MinIO key on the theme
// singleton. The tRPC layer can't handle raw binary bodies, so this lives
// as a plain Fastify route like the video-upload.

import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@play/db";
import { config, putObject, removeObject } from "@play/storage";
import { auth } from "./auth";
import { publishThemeUpdate } from "./theme-bus";
import { readAndValidateMime } from "./magic-bytes";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  // Deliberately NOT image/svg+xml — SVGs can carry scripts, and without a
  // sanitiser we'd be shipping an admin-XSS. Can be revisited with a sanitiser.
]) as ReadonlySet<string>;

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB — logos shouldn't need more.

export async function logoUploadHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Session + admin gate.
  const headers = new Headers();
  for (const [k, v] of Object.entries(request.headers)) {
    if (Array.isArray(v)) for (const vv of v) headers.append(k, vv);
    else if (v !== undefined) headers.append(k, String(v));
  }
  const session = await auth.api.getSession({ headers });
  if (!session) return reply.status(401).send({ error: "UNAUTHORIZED" });
  const user = session.user as { id: string; role?: string };
  if (user.role !== "ADMIN") {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  // Magic-Bytes-Check: Header lügt. Wir puffern das kleine Logo (≤ 2 MB) und
  // validieren gegen die echte File-Signatur.
  const magic = await readAndValidateMime(request, ALLOWED_MIME, MAX_LOGO_BYTES);
  if (!magic.ok) {
    return reply.status(magic.status).send({ error: magic.error, hint: magic.hint });
  }
  const detectedMime = magic.detectedMime;

  // Fetch the previous key BEFORE writing, so we can delete it after success.
  const before = await prisma.themeSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
    select: { logoAssetKey: true },
  });

  const ext = detectedMime.split("/")[1] ?? "png";
  const key = `logo/${randomUUID()}.${ext}`;

  await putObject(config.buckets.assets, key, magic.buffer, {
    "Content-Type": detectedMime,
    "Cache-Control": "public, max-age=3600",
  });

  await prisma.themeSettings.update({
    where: { id: "singleton" },
    data: { logoAssetKey: key, updatedBy: user.id },
  });

  // Best-effort cleanup — old logo no longer reachable via the settings row.
  if (before.logoAssetKey && before.logoAssetKey !== key) {
    removeObject(config.buckets.assets, before.logoAssetKey).catch((err) => {
      request.log.warn({ err, key: before.logoAssetKey }, "old logo delete failed");
    });
  }

  await prisma.themeAuditLog.create({
    data: {
      userId: user.id,
      action: "logoUpload",
      payload: { key, contentType: detectedMime, bytes: magic.buffer.length },
    },
  });

  await publishThemeUpdate({ source: "logo" });

  return reply.status(200).send({ ok: true, key });
}
