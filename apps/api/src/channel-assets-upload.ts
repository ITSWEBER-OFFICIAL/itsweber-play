// Channel-Asset-Upload (Avatar + Banner). Raw-stream, analog zum
// logo-upload.ts. Owner-only (Channel muss dem eingeloggten User gehören).
// S3_PUBLIC_URL baut die URL zusammen — `avatarUrl`/`bannerUrl` wird parallel
// zum Key gespeichert, damit alle Konsumenten beide Felder lesen können.

import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@play/db";
import { config, putObject, removeObject } from "@play/storage";
import { auth } from "./auth";
import { readAndValidateMime } from "./magic-bytes";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]) as ReadonlySet<string>;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_BANNER_BYTES = 4 * 1024 * 1024; // 4 MB

function buildPublicUrl(key: string): string | null {
  const base = process.env.S3_PUBLIC_URL;
  if (!base) return null;
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/${config.buckets.assets}/${key}`;
}

async function sessionUserFromRequest(request: FastifyRequest) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(request.headers)) {
    if (Array.isArray(v)) for (const vv of v) headers.append(k, vv);
    else if (v !== undefined) headers.append(k, String(v));
  }
  return auth.api.getSession({ headers });
}

async function uploadChannelAsset(
  request: FastifyRequest,
  reply: FastifyReply,
  kind: "avatar" | "banner",
) {
  const session = await sessionUserFromRequest(request);
  if (!session) return reply.status(401).send({ error: "UNAUTHORIZED" });
  const user = session.user as { id: string };

  const maxBytes = kind === "avatar" ? MAX_AVATAR_BYTES : MAX_BANNER_BYTES;

  // Magic-Bytes-Check: Header lügt. Buffer + Signature-Validierung.
  const magic = await readAndValidateMime(request, ALLOWED_MIME, maxBytes);
  if (!magic.ok) {
    return reply.status(magic.status).send({ error: magic.error, hint: magic.hint });
  }
  const detectedMime = magic.detectedMime;

  const channel = await prisma.channel.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      avatarAssetKey: true,
      bannerAssetKey: true,
    },
  });
  if (!channel) return reply.status(404).send({ error: "NO_CHANNEL" });

  const ext = detectedMime.split("/")[1] ?? "png";
  const prefix = kind === "avatar" ? "avatar" : "banner";
  const key = `${prefix}/${channel.id}.${ext}`;

  await putObject(config.buckets.assets, key, magic.buffer, {
    "Content-Type": detectedMime,
    "Cache-Control": "public, max-age=3600",
  });

  const keyField = kind === "avatar" ? "avatarAssetKey" : "bannerAssetKey";
  const urlField = kind === "avatar" ? "avatarUrl" : "bannerUrl";
  const url = buildPublicUrl(key);
  const prevKey =
    kind === "avatar" ? channel.avatarAssetKey : channel.bannerAssetKey;

  await prisma.channel.update({
    where: { id: channel.id },
    data: { [keyField]: key, [urlField]: url } as never,
  });

  if (prevKey && prevKey !== key) {
    removeObject(config.buckets.assets, prevKey).catch((err) => {
      request.log.warn({ err, key: prevKey }, "old channel asset delete failed");
    });
  }

  return reply.status(200).send({ ok: true, key, url });
}

export function channelAvatarUploadHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  return uploadChannelAsset(request, reply, "avatar");
}

export function channelBannerUploadHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  return uploadChannelAsset(request, reply, "banner");
}
