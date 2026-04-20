// Fastify-Handler für Video-spezifische Asset-Uploads:
//  • Custom-Thumbnail (PNG/JPEG/WebP, max 2 MB)
//  • Caption (VTT oder SRT; SRT wird hier zu VTT konvertiert, im Player
//    läuft nur VTT)

import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@play/db";
import { config, putObject } from "@play/storage";
import { auth } from "./auth";
import { readAndValidateMime } from "./magic-bytes";

const IMG_MIME = new Set(["image/png", "image/jpeg", "image/webp"]) as ReadonlySet<string>;
const MAX_THUMB_BYTES = 2 * 1024 * 1024;
const MAX_CAPTION_BYTES = 1 * 1024 * 1024;

async function getOwnerGated(
  request: FastifyRequest,
  reply: FastifyReply,
  videoId: string,
): Promise<
  { userId: string; role?: string } | { denied: true }
> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(request.headers)) {
    if (Array.isArray(v)) for (const vv of v) headers.append(k, vv);
    else if (v !== undefined) headers.append(k, String(v));
  }
  const session = await auth.api.getSession({ headers });
  if (!session) {
    reply.status(401).send({ error: "UNAUTHORIZED" });
    return { denied: true };
  }
  const user = session.user as { id: string; role?: string };
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { ownerId: true },
  });
  if (!video) {
    reply.status(404).send({ error: "VIDEO_NOT_FOUND" });
    return { denied: true };
  }
  if (video.ownerId !== user.id && user.role !== "ADMIN") {
    reply.status(403).send({ error: "FORBIDDEN" });
    return { denied: true };
  }
  return { userId: user.id, role: user.role };
}

// ─── Thumbnail ──────────────────────────────────────────────────────────

export async function videoThumbnailUploadHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const videoId = request.params.id;
  const gate = await getOwnerGated(request, reply, videoId);
  if ("denied" in gate) return;

  // Magic-Bytes-Check: Header lügt. Buffer + Signature-Validierung.
  const magic = await readAndValidateMime(request, IMG_MIME, MAX_THUMB_BYTES);
  if (!magic.ok) {
    return reply.status(magic.status).send({ error: magic.error, hint: magic.hint });
  }
  const detectedMime = magic.detectedMime;

  const ext = detectedMime.split("/")[1] ?? "png";
  const key = `${videoId}-custom-${randomUUID()}.${ext}`;

  await putObject(config.buckets.thumbs, key, magic.buffer, {
    "Content-Type": detectedMime,
    "Cache-Control": "public, max-age=3600",
  });

  // Key in thumbnailCandidates aufnehmen (falls noch nicht drin) +
  // als aktuellen Thumbnail-Key setzen.
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { thumbnailCandidates: true },
  });
  const candidates = new Set(video?.thumbnailCandidates ?? []);
  candidates.add(key);
  await prisma.video.update({
    where: { id: videoId },
    data: {
      thumbnailKey: key,
      thumbnailCandidates: [...candidates],
    },
  });

  return reply.status(200).send({ ok: true, key });
}

// ─── Captions ───────────────────────────────────────────────────────────

// Minimal SRT→VTT Konverter. SRT-Format:
//   1
//   00:00:01,000 --> 00:00:04,000
//   Text…
// VTT verlangt `WEBVTT`-Header + `.` statt `,` als Dezimaltrenner.
function srtToVtt(srt: string): string {
  const body = srt
    .replace(/^\uFEFF/, "") // BOM
    .replace(/\r\n/g, "\n")
    .replace(
      /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
      (_, hms, ms) => `${hms}.${ms}`,
    )
    // Numerische Cue-Index-Zeilen sind in VTT optional — wegstrippen.
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n");
      if (lines.length > 1 && /^\d+$/.test(lines[0]!.trim())) {
        return lines.slice(1).join("\n");
      }
      return block;
    })
    .join("\n\n");
  return `WEBVTT\n\n${body.trim()}\n`;
}

export async function videoCaptionUploadHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { lang?: string; label?: string };
  }>,
  reply: FastifyReply,
) {
  const videoId = request.params.id;
  const gate = await getOwnerGated(request, reply, videoId);
  if ("denied" in gate) return;

  const lang = String(request.query.lang ?? "").trim().toLowerCase();
  if (!/^[a-z]{2}(-[a-z]{2})?$/i.test(lang)) {
    return reply.status(400).send({ error: "INVALID_LANGUAGE" });
  }
  const label = String(request.query.label ?? lang).slice(0, 80);

  const contentType = String(request.headers["content-type"] ?? "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  if (
    contentType !== "text/vtt" &&
    contentType !== "application/x-subrip" &&
    contentType !== "text/srt" &&
    contentType !== "text/plain" &&
    contentType !== "application/octet-stream"
  ) {
    return reply.status(415).send({ error: "UNSUPPORTED_MEDIA_TYPE" });
  }

  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (contentLength > MAX_CAPTION_BYTES) {
    return reply.status(413).send({ error: "PAYLOAD_TOO_LARGE" });
  }

  // Body als UTF-8-String einsammeln.
  const chunks: Buffer[] = [];
  for await (const chunk of request.raw) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");

  // Format erkennen: VTT beginnt mit "WEBVTT"; sonst als SRT behandeln.
  const vtt = raw.trimStart().startsWith("WEBVTT") ? raw : srtToVtt(raw);
  const assetKey = `captions/${videoId}/${lang}.vtt`;

  await putObject(config.buckets.assets, assetKey, Buffer.from(vtt, "utf8"), {
    "Content-Type": "text/vtt; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });

  const caption = await prisma.videoCaption.upsert({
    where: { videoId_language: { videoId, language: lang } },
    update: { label, assetKey },
    create: {
      videoId,
      language: lang,
      label,
      assetKey,
    },
    select: { id: true },
  });

  return reply.status(200).send({ ok: true, captionId: caption.id, assetKey });
}
