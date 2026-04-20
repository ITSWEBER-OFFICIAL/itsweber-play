// Setup-Wizard logo upload.
//
// Spiegelt logoUploadHandler, ist aber NICHT admin-gated — der Wizard läuft
// vor dem ersten Login. Stattdessen: nur erreichbar, solange
// `SiteSettings.setupCompleted = false`. Jeder Aufruf nach Wizard-Abschluss
// kriegt 403; danach übernimmt der reguläre /api/admin/theme/logo-Endpoint.

import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@play/db";
import { config, putObject, removeObject } from "@play/storage";
import { publishThemeUpdate } from "./theme-bus";
import { readAndValidateMime } from "./magic-bytes";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  // SVG bewusst nicht erlaubt — siehe Begründung in logo-upload.ts.
]) as ReadonlySet<string>;

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function setupLogoUploadHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
    select: { setupCompleted: true },
  });
  if (settings?.setupCompleted) {
    return reply.status(403).send({
      error: "SETUP_COMPLETED",
      hint: "Wizard ist bereits abgeschlossen — bitte /admin/theme verwenden.",
    });
  }

  const magic = await readAndValidateMime(request, ALLOWED_MIME, MAX_LOGO_BYTES);
  if (!magic.ok) {
    return reply.status(magic.status).send({ error: magic.error, hint: magic.hint });
  }
  const detectedMime = magic.detectedMime;

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
    data: { logoAssetKey: key },
  });

  if (before.logoAssetKey && before.logoAssetKey !== key) {
    removeObject(config.buckets.assets, before.logoAssetKey).catch((err) => {
      request.log.warn({ err, key: before.logoAssetKey }, "old setup logo delete failed");
    });
  }

  await prisma.themeAuditLog.create({
    data: {
      userId: null,
      action: "logoUpload",
      payload: { key, contentType: detectedMime, bytes: magic.buffer.length, source: "setup-wizard" },
    },
  });

  await publishThemeUpdate({ source: "logo" });

  return reply.status(200).send({ ok: true, key });
}
