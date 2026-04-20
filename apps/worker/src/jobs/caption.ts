import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import type { Job } from "bullmq";
import { prisma } from "@play/db";
import { config, getObject, putObject } from "@play/storage";
import type { CaptionJobData } from "../queue";

const execFileAsync = promisify(execFile);

const WHISPER_PATH = process.env.WHISPER_PATH ?? "/usr/local/bin/whisper-cli";
const WHISPER_MODEL = process.env.WHISPER_MODEL ?? "/models/ggml-small.bin";

// Converts whisper plain-text output (with timestamps) to VTT format.
// whisper-cli --output-vtt writes a .vtt file directly — we just use that.
// This helper converts the intermediate .txt in case --output-vtt is unavailable.
function parsePlainToVtt(text: string): string {
  const lines = text.split("\n");
  const vttLines = ["WEBVTT", ""];
  let cueIdx = 1;
  for (const line of lines) {
    // whisper default format: [HH:MM:SS.mmm --> HH:MM:SS.mmm]  text
    const m = line.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s+(.+)$/);
    if (!m) continue;
    const [, start, end, cue] = m;
    vttLines.push(`${cueIdx++}`);
    vttLines.push(`${start!.replace(".", ",")} --> ${end!.replace(".", ",")}`);
    vttLines.push(cue!.trim());
    vttLines.push("");
  }
  return vttLines.join("\n");
}

export async function runCaptionJob(job: Job<CaptionJobData>): Promise<void> {
  if (!process.env.AUTO_CAPTIONS_ENABLED || process.env.AUTO_CAPTIONS_ENABLED === "0") {
    console.log(`[caption] AUTO_CAPTIONS_ENABLED not set — skip job=${job.id}`);
    return;
  }

  const { videoId, hlsKey, language = "de" } = job.data;
  const workDir = path.join(tmpdir(), `play-caption-${videoId}`);
  const inputPath = path.join(workDir, "input.mp4");

  try {
    // 1. Check if auto-caption already exists (unique on videoId+language)
    const existing = await prisma.videoCaption.findUnique({
      where: { videoId_language: { videoId, language } },
      select: { id: true },
    });
    if (existing) {
      console.log(`[caption] Auto-caption already exists for videoId=${videoId} lang=${language} — skip.`);
      return;
    }

    await mkdir(workDir, { recursive: true });

    // 2. Download the first HLS segment for transcription
    // Strategy: download the master.m3u8, parse first variant, download first few ts/m4s
    // For simplicity we download the full source if available via raw-bucket
    // Fallback: use hlsKey (master.m3u8 path) and download the playlist + first segments
    await job.updateProgress(5);

    // Try to get video row for rawKey fallback
    const videoRow = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true },
    });
    if (!videoRow) throw new Error(`Video ${videoId} not found`);

    // Download via HLS stream — we take the lowest-quality variant to keep it fast
    const masterStream = await getObject(config.buckets.videos, `${hlsKey}/master.m3u8`);
    const masterChunks: Buffer[] = [];
    for await (const chunk of masterStream) {
      masterChunks.push(chunk as Buffer);
    }
    const masterContent = Buffer.concat(masterChunks).toString("utf8");

    // Parse the first variant playlist URL from master.m3u8
    const playlistLine = masterContent
      .split("\n")
      .find((l) => l.trim().endsWith(".m3u8") && !l.startsWith("#"));

    if (!playlistLine) {
      throw new Error("No variant playlist found in master.m3u8");
    }

    // Build a concat URL: download the first N segments and concatenate to a single mp4
    const variantKey = `${hlsKey}/${playlistLine.trim()}`;
    const variantStream = await getObject(config.buckets.videos, variantKey);
    const variantChunks: Buffer[] = [];
    for await (const chunk of variantStream) {
      variantChunks.push(chunk as Buffer);
    }
    const variantContent = Buffer.concat(variantChunks).toString("utf8");

    // Take first 6 segments (usually ~30-90s at lowest quality)
    const segmentKeys = variantContent
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"))
      .slice(0, 6)
      .map((l) => `${hlsKey}/${path.dirname(playlistLine.trim())}/${l.trim()}`
        .replace(/\/\.\//g, "/")
        .replace(/\/+/g, "/"));

    // Write segments to a temporary file list for ffmpeg concat
    const segDir = path.join(workDir, "segs");
    await mkdir(segDir, { recursive: true });

    const segPaths: string[] = [];
    for (let i = 0; i < segmentKeys.length; i++) {
      const segKey = segmentKeys[i]!;
      const segPath = path.join(segDir, `seg${i}.ts`);
      const segStream = await getObject(config.buckets.videos, segKey);
      await pipeline(segStream, createWriteStream(segPath));
      segPaths.push(segPath);
    }

    // Concat segments to a single audio-only mp3 for faster whisper processing
    const concatListPath = path.join(workDir, "concat.txt");
    await (await import("node:fs/promises")).writeFile(
      concatListPath,
      segPaths.map((p) => `file '${p}'`).join("\n"),
    );

    const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";
    await execFileAsync(ffmpegPath, [
      "-f", "concat", "-safe", "0", "-i", concatListPath,
      "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
      inputPath,
    ]);
    await job.updateProgress(30);

    // 3. Run whisper-cli
    const outputBasePath = path.join(workDir, "output");
    await execFileAsync(WHISPER_PATH, [
      "-m", WHISPER_MODEL,
      "-f", inputPath,
      "-l", language,
      "--output-vtt",
      "-of", outputBasePath,
      "--no-prints",
    ]);
    await job.updateProgress(80);

    // 4. Read VTT output
    const vttPath = `${outputBasePath}.vtt`;
    let vttContent: string;
    try {
      vttContent = await readFile(vttPath, "utf8");
    } catch {
      // Fallback: try plain text output
      const txtPath = `${outputBasePath}.txt`;
      const plainContent = await readFile(txtPath, "utf8");
      vttContent = parsePlainToVtt(plainContent);
    }

    if (!vttContent.startsWith("WEBVTT")) {
      throw new Error("whisper output is not valid VTT");
    }

    // 5. Upload VTT to MinIO play-assets/captions bucket
    const captionsKey = `captions/${videoId}/auto-${language}.vtt`;
    const vttBuffer = Buffer.from(vttContent, "utf8");
    await putObject(
      config.buckets.assets,
      captionsKey,
      vttBuffer as unknown as Buffer,
      { "Content-Type": "text/vtt; charset=utf-8", "Content-Length": String(vttBuffer.length) },
    );
    await job.updateProgress(90);

    // 6. Persist VideoCaption row in DB
    await prisma.videoCaption.create({
      data: {
        videoId,
        language,
        label: "Auto (Whisper)",
        assetKey: captionsKey,
        isAutoGenerated: true,
      },
    });

    await job.updateProgress(100);
    console.log(`[caption] Auto-caption done videoId=${videoId} key=${captionsKey}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[caption] FAILED videoId=${videoId}: ${msg}`);
    // Non-fatal: caption failure should not affect the video itself
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
