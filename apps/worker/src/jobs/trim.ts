// Trim-Job: schneidet das Original-Video auf [startSec, endSec] und
// enqueued anschließend den Standard-Transcode-Job, damit HLS neu gerendert
// wird.
//
// Strategie:
//   1. `-ss <start> -to <end> -c copy` (stream-copy, null CPU-Cost)
//   2. Fallback falls #1 ein invalides MP4 erzeugt (Keyframes passen nicht):
//      `-ss <start> -to <end> -c:v libx264 -preset veryfast -c:a aac`
//   3. Überschreibt play-raw/<id>.mp4, triggert Transcode-Queue
//
// Der Re-Encode-Fallback erkennen wir an ffprobe: wenn die getrimmte Datei
// keine gültigen Frames hat oder duration stark abweicht.

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Job } from "bullmq";
import { prisma } from "@play/db";
import { config, getObject, putObject } from "@play/storage";
import { ffmpeg, probe } from "../ffmpeg";
import {
  transcodeQueue,
  type TrimJobData,
  type TranscodeJobData,
} from "../queue";

async function downloadToFile(bucket: string, key: string, dest: string) {
  const stream = await getObject(bucket, key);
  await pipeline(stream, createWriteStream(dest));
}

function runFfmpeg(
  input: string,
  output: string,
  startSec: number,
  endSec: number,
  reEncode: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(input)
      .setStartTime(startSec)
      .setDuration(Math.max(0.1, endSec - startSec));
    if (reEncode) {
      cmd
        .videoCodec("libx264")
        .audioCodec("aac")
        .addOption("-preset", "veryfast")
        .addOption("-crf", "23");
    } else {
      cmd.videoCodec("copy").audioCodec("copy");
    }
    cmd
      .addOption("-movflags", "+faststart")
      .output(output)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

export async function runTrimJob(job: Job<TrimJobData>): Promise<void> {
  const { videoId, rawKey, startSec, endSec } = job.data;
  const workDir = path.join(tmpdir(), `play-trim-${videoId}`);
  const inputPath = path.join(workDir, "input.mp4");
  const outputPath = path.join(workDir, "output.mp4");

  try {
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "PROCESSING", failureReason: null },
    });
    await mkdir(workDir, { recursive: true });

    await downloadToFile(config.buckets.raw, rawKey, inputPath);

    // Erst stream-copy versuchen.
    let mode: "copy" | "reencode" = "copy";
    try {
      await runFfmpeg(inputPath, outputPath, startSec, endSec, false);
      const p = await probe(outputPath);
      const expected = endSec - startSec;
      // Wenn Dauer um mehr als 1s abweicht: Keyframes passten nicht → re-encode.
      if (Math.abs(p.durationSec - expected) > 1) {
        mode = "reencode";
      }
    } catch {
      mode = "reencode";
    }

    if (mode === "reencode") {
      await rm(outputPath, { force: true });
      await runFfmpeg(inputPath, outputPath, startSec, endSec, true);
    }

    const size = (await stat(outputPath)).size;
    await putObject(
      config.buckets.raw,
      rawKey,
      createReadStream(outputPath) as unknown as Buffer,
      {
        "Content-Type": "video/mp4",
        "Content-Length": String(size),
      },
    );

    // Video-Row kurz zurücksetzen — Transcode-Job schreibt gleich alles neu.
    await prisma.video.update({
      where: { id: videoId },
      data: {
        durationSec: null,
        width: null,
        height: null,
        bitrateKbps: null,
      },
    });

    // Standard-Transcode anstoßen.
    const payload: TranscodeJobData = {
      videoId,
      rawKey,
      sourceType: "UPLOAD",
    };
    await transcodeQueue.add("transcode", payload, {
      jobId: `transcode-${videoId}-trimmed-${Date.now()}`,
    });
  } catch (err) {
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        failureReason: String((err as Error).message ?? err),
      },
    });
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
