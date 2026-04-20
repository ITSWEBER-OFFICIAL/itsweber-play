import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import type { Job } from "bullmq";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { prisma } from "@play/db";
import { config, putObject } from "@play/storage";
import { transcodeQueue, type ImportJobData } from "../queue";

// youtube-dl-exec scheitert unter Windows, wenn der yt-dlp-Pfad Leerzeichen
// enthält (shell: true + execa-Quoting-Bug). Wir spawnen selbst mit
// shell: false — damit sind Argumente sauber arrays-isoliert.
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

// Resolver: YT_DLP_PATH gewinnt (Prod-Container: /usr/local/bin/yt-dlp).
// Im Dev fallen wir auf das mit youtube-dl-exec mitgelieferte Binary zurück.
function resolveYtDlp(): string {
  if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH;
  // package.json ist garantiert exported — path.dirname → package root,
  // Binary liegt unter bin/yt-dlp[.exe].
  const pkgJson = require.resolve("youtube-dl-exec/package.json");
  const pkgDir = path.dirname(pkgJson);
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(pkgDir, "bin", `yt-dlp${ext}`);
}

const YT_DLP_PATH = resolveYtDlp();
const FFMPEG_LOCATION = process.env.FFMPEG_PATH || ffmpegInstaller.path;

interface YtDlpInfo {
  title?: string;
  description?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  webpage_url?: string;
  upload_date?: string;
}

export async function runImportJob(job: Job<ImportJobData>): Promise<void> {
  const { videoId, url } = job.data;
  const workDir = path.join(tmpdir(), `play-import-${videoId}`);

  try {
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "PROCESSING", failureReason: null },
    });

    await mkdir(workDir, { recursive: true });
    await job.updateProgress(5);

    const outputTemplate = path.join(workDir, `${videoId}.%(ext)s`);

    const args = [
      url,
      "--format",
      "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/best[height<=1080]",
      "--merge-output-format",
      "mp4",
      "--no-playlist",
      "--write-info-json",
      "--no-progress",
      "--output",
      outputTemplate,
      "--ffmpeg-location",
      FFMPEG_LOCATION,
    ];

    // maxBuffer großzügig — yt-dlp kann bei langen Videos viel stdout
    // (Info-Dump) produzieren. Timeout 10 min als harte Grenze.
    await execFileAsync(YT_DLP_PATH, args, {
      maxBuffer: 64 * 1024 * 1024,
      timeout: 10 * 60 * 1000,
    });

    await job.updateProgress(75);

    const files = await readdir(workDir);
    const infoFile = files.find((f) => f.endsWith(".info.json"));
    const videoFile = files.find(
      (f) =>
        !f.endsWith(".info.json") &&
        !f.endsWith(".part") &&
        !f.endsWith(".temp"),
    );
    if (!videoFile) {
      throw new Error("yt-dlp lieferte keine Video-Datei zurück.");
    }

    let info: YtDlpInfo = {};
    if (infoFile) {
      try {
        info = JSON.parse(
          await readFile(path.join(workDir, infoFile), "utf8"),
        ) as YtDlpInfo;
      } catch {
        // best-effort
      }
    }

    const localVideoPath = path.join(workDir, videoFile);
    const ext = path.extname(videoFile).slice(1) || "mp4";
    const rawKey = `${videoId}.${ext}`;
    const size = (await stat(localVideoPath)).size;

    await putObject(
      config.buckets.raw,
      rawKey,
      createReadStream(localVideoPath) as unknown as Buffer,
      {
        "Content-Type": `video/${ext === "mp4" ? "mp4" : "octet-stream"}`,
        "Content-Length": String(size),
      },
    );
    await job.updateProgress(90);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        title: info.title ?? undefined,
        description:
          info.description ??
          (info.webpage_url ? `Source: ${info.webpage_url}` : undefined),
      },
    });

    await transcodeQueue.add(
      "transcode",
      {
        videoId,
        rawKey,
        sourceType: "EXTERNAL",
        formatHint: job.data.formatHint,
      },
      { jobId: `transcode-${videoId}` },
    );

    await job.updateProgress(100);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", failureReason: `Import: ${message}` },
    });
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
