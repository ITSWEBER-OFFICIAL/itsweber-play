import { createWriteStream, createReadStream } from "node:fs";
import { mkdir, rm, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Job } from "bullmq";
import { prisma } from "@play/db";
import { config, getObject, putObject } from "@play/storage";
import {
  probe,
  selectVariants,
  transcodeVariant,
  extractThumbnailCandidates,
} from "../ffmpeg";
import { captionQueue } from "../queue";
import type { TranscodeJobData } from "../queue";

async function downloadToFile(bucket: string, key: string, dest: string) {
  const stream = await getObject(bucket, key);
  await pipeline(stream, createWriteStream(dest));
}

async function uploadDirRecursive(
  localDir: string,
  bucket: string,
  prefix: string,
) {
  const entries = await readdir(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const local = path.join(localDir, entry.name);
    const remote = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await uploadDirRecursive(local, bucket, remote);
    } else {
      const size = (await stat(local)).size;
      const contentType =
        entry.name.endsWith(".m3u8")
          ? "application/vnd.apple.mpegurl"
          : entry.name.endsWith(".m4s") || entry.name.endsWith(".mp4")
            ? "video/mp4"
            : "application/octet-stream";
      await putObject(bucket, remote, createReadStream(local) as unknown as Buffer, {
        "Content-Type": contentType,
        "Content-Length": String(size),
      });
    }
  }
}

// CODECS-Strings pro HLS-Variante. Werte sind RFC-6381-konform und erlauben
// Playern (hls.js, Safari), die beste unterstützte Variante zu wählen.
function codecsString(codec: "h264" | "av1" | "vp9"): string {
  switch (codec) {
    case "h264":
      return "avc1.640028,mp4a.40.2";
    case "av1":
      return "av01.0.05M.08,mp4a.40.2";
    case "vp9":
      return "vp09.00.41.08,mp4a.40.2";
  }
}

function buildMasterPlaylist(
  variants: { name: string; height: number; videoBitrateKbps: number; codec: "h264" | "av1" | "vp9" }[],
): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:7"];
  for (const v of variants) {
    const bandwidth = (v.videoBitrateKbps + 128) * 1000;
    const width = Math.round((v.height * 16) / 9);
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${v.height},CODECS="${codecsString(v.codec)}",NAME="${v.name}"`,
    );
    lines.push(`${v.name}/playlist.m3u8`);
  }
  return lines.join("\n") + "\n";
}

export async function runTranscodeJob(
  job: Job<TranscodeJobData>,
): Promise<void> {
  const { videoId, rawKey } = job.data;
  const workDir = path.join(tmpdir(), `play-transcode-${videoId}`);
  const inputPath = path.join(workDir, "input.bin");
  const outputDir = path.join(workDir, "hls");
  const thumbDir = path.join(workDir, "thumbs");

  try {
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "PROCESSING", failureReason: null },
    });

    await mkdir(outputDir, { recursive: true });
    await mkdir(thumbDir, { recursive: true });

    // 1. Original aus play-raw ziehen
    await downloadToFile(config.buckets.raw, rawKey, inputPath);
    await job.updateProgress(10);

    // 2. Probe: Dauer, Auflösung, Codec
    const meta = await probe(inputPath);
    await job.updateProgress(20);

    // 3. HLS-Varianten (je nach Source-Höhe)
    const variants = selectVariants(meta.height);
    for (const variant of variants) {
      await mkdir(path.join(outputDir, variant.name), { recursive: true });
      await transcodeVariant(inputPath, outputDir, variant);
      await job.updateProgress(20 + (60 * (variants.indexOf(variant) + 1)) / variants.length);
    }

    // 4. Master-Playlist
    const master = buildMasterPlaylist(variants);
    const masterPath = path.join(outputDir, "master.m3u8");
    await writeFile(masterPath, master, "utf8");

    // 5. Thumbnail-Kandidaten (5 Stück bei 10/30/50/70/90 % der Dauer)
    const candidatePaths = await extractThumbnailCandidates(
      inputPath,
      thumbDir,
      meta.durationSec,
    );
    await job.updateProgress(85);

    // 6. Uploads nach MinIO: HLS unter play-videos/<id>/, Thumbs unter play-thumbs/
    await uploadDirRecursive(outputDir, config.buckets.videos, videoId);

    const { createReadStream: crs } = await import("node:fs");
    const thumbnailKeys: string[] = [];
    for (let i = 0; i < candidatePaths.length; i++) {
      const localPath = candidatePaths[i]!;
      const key = `${videoId}-cand-${i + 1}.webp`;
      const size = (await stat(localPath)).size;
      await putObject(
        config.buckets.thumbs,
        key,
        crs(localPath) as unknown as Buffer,
        { "Content-Type": "image/webp", "Content-Length": String(size) },
      );
      thumbnailKeys.push(key);
    }
    // Default-Auswahl: mittlere (index 2, = 50 % der Dauer).
    const defaultIndex = Math.min(2, thumbnailKeys.length - 1);
    const thumbnailKey = thumbnailKeys[defaultIndex] ?? null;
    await job.updateProgress(95);

    // Shorts-Klassifikation: User-Hint aus dem Upload-/Import-Flow hat
    // Vorrang. Sonst Auto-Detection (portrait + Dauer ≤ 60 s).
    const formatHint = job.data.formatHint;
    const autoIsShort =
      meta.height > meta.width &&
      meta.durationSec > 0 &&
      meta.durationSec <= 60;
    const finalFormat: "LONG" | "SHORT" = formatHint ?? (autoIsShort ? "SHORT" : "LONG");

    // 7. DB-Finalize
    const finalized = await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "LIVE",
        publishedAt: new Date(),
        durationSec: meta.durationSec,
        width: meta.width,
        height: meta.height,
        codec: meta.codec,
        bitrateKbps: meta.bitrateKbps,
        thumbnailKey,
        thumbnailCandidates: thumbnailKeys,
        format: finalFormat,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        visibility: true,
        channelId: true,
      },
    });

    // 8. Auto-Captions enqueuen wenn Feature aktiv
    if (process.env.AUTO_CAPTIONS_ENABLED === "1") {
      await captionQueue.add("caption-generate", {
        videoId,
        hlsKey: videoId,
        language: "de",
      });
    }

    // 9. Abonnenten benachrichtigen — aber nur wenn Video PUBLIC ist.
    // PRIVATE/UNLISTED/LOGGED_IN-Default-Uploads triggern keine Notifications.
    if (finalized.visibility === "PUBLIC") {
      const subs = await prisma.subscription.findMany({
        where: { channelId: finalized.channelId, notify: true },
        select: { subscriberId: true },
      });
      if (subs.length > 0) {
        await prisma.notification.createMany({
          data: subs.map((s) => ({
            userId: s.subscriberId,
            type: "NEW_UPLOAD",
            title: `Neues Video: ${finalized.title}`,
            body: null,
            link: `/watch/${finalized.slug}`,
          })),
        });
      }
    }
    await job.updateProgress(100);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", failureReason: message },
    });
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
