import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { customAlphabet } from "nanoid";
import { prisma } from "@play/db";
import { config, putObject } from "@play/storage";
import { transcodeQueue } from "@play/worker/queue";
import { auth } from "./auth";
import { peekAndValidateMime } from "./magic-bytes";

// URL-safe, kurz, unmissverständlich (kein 0/O, kein I/l).
const videoSlug = customAlphabet(
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz",
  11,
);

export async function uploadHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Session-Check über die Request-Header.
  const headers = new Headers();
  for (const [k, v] of Object.entries(request.headers)) {
    if (Array.isArray(v)) for (const vv of v) headers.append(k, vv);
    else if (v !== undefined) headers.append(k, String(v));
  }
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return reply.status(401).send({ error: "UNAUTHORIZED" });
  }

  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.startsWith("video/")) {
    return reply
      .status(415)
      .send({ error: "UNSUPPORTED_MEDIA_TYPE", hint: "Content-Type must be video/*" });
  }

  const title = String(request.headers["x-upload-title"] ?? "Unbenanntes Video");
  // User-Intent vom Upload-Form. "short" → SHORT-Override beim Worker.
  const formatHeader = String(request.headers["x-upload-format"] ?? "").toLowerCase();
  const formatHint: "LONG" | "SHORT" | undefined =
    formatHeader === "short" ? "SHORT" : formatHeader === "long" ? "LONG" : undefined;
  const maxUploadMB = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 8192);
  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (contentLength > maxUploadMB * 1024 * 1024) {
    return reply.status(413).send({ error: "PAYLOAD_TOO_LARGE" });
  }

  // Default-Channel des Users (wurde beim Sign-up via Hook angelegt).
  const channel = await prisma.channel.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!channel) {
    return reply
      .status(500)
      .send({ error: "NO_DEFAULT_CHANNEL", hint: "User ohne Channel — Sign-up-Hook defekt?" });
  }

  // Magic-Bytes-Check: file-type peekt die ersten ~4 KB und verifiziert, dass
  // das wirklich ein Video-Container ist (mp4/webm/mkv/mov/avi/…). Liefert
  // einen Replay-Stream, in dem die gepeekten Bytes zurückgespielt werden —
  // so kann der Rest des Uploads normal gestreamt werden.
  const magic = await peekAndValidateMime(request, "video/");
  if (!magic.ok) {
    return reply.status(magic.status).send({ error: magic.error, hint: magic.hint });
  }
  const detectedMime = magic.detectedMime;

  const videoId = randomUUID();
  const slug = videoSlug();
  const ext = detectedMime.split("/")[1]?.split(";")[0] || "bin";
  const rawKey = `${videoId}.${ext}`;

  // 1. Raw-Datei in MinIO streamen. Der Replay-Stream liefert erst den
  //    gepeekten Head, dann den verbleibenden Request-Body.
  await putObject(config.buckets.raw, rawKey, magic.stream, {
    "Content-Type": detectedMime,
  });

  // 2. Video-Row anlegen (PENDING — Worker setzt auf LIVE).
  // formatHint wird auch direkt auf das Video gesetzt, damit die Studio-Liste
  // den User-Intent schon zeigt, bevor der Transcode durch ist.
  const video = await prisma.video.create({
    data: {
      id: videoId,
      slug,
      ownerId: session.user.id,
      channelId: channel.id,
      title,
      source: "UPLOAD",
      visibility: "PRIVATE", // Sicherheitsnetz — User promoted manuell.
      status: "PENDING",
      ...(formatHint ? { format: formatHint } : {}),
    },
    select: { id: true, slug: true, status: true },
  });

  // 3. Job in die Queue.
  await transcodeQueue.add(
    "transcode",
    { videoId, rawKey, sourceType: "UPLOAD", formatHint },
    { jobId: videoId },
  );

  return reply.status(202).send({
    videoId: video.id,
    slug: video.slug,
    status: video.status,
  });
}
