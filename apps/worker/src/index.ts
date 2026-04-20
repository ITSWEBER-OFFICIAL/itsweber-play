import { Worker } from "bullmq";
import { ensureBuckets } from "@play/storage";
import {
  TRANSCODE_QUEUE,
  IMPORT_QUEUE,
  TRIM_QUEUE,
  CAPTION_QUEUE,
  MODERATE_COMMENT_QUEUE,
  SCHEDULE_CHECK_QUEUE,
  DIGEST_MAIL_QUEUE,
  redisConnection,
  scheduleCheckQueue,
  digestMailQueue,
  type TranscodeJobData,
  type ImportJobData,
  type TrimJobData,
  type CaptionJobData,
  type ModerateCommentJobData,
} from "./queue";
import { runTranscodeJob } from "./jobs/transcode";
import { runImportJob } from "./jobs/import";
import { runTrimJob } from "./jobs/trim";
import { runCaptionJob } from "./jobs/caption";
import { processModerateComment } from "./jobs/moderate-comment";
import { processScheduleCheck } from "./jobs/schedule-check";
import { processDigestMail } from "./jobs/digest-mail";

async function main() {
  await ensureBuckets();

  const transcodeWorker = new Worker<TranscodeJobData>(
    TRANSCODE_QUEUE,
    async (job) => {
      console.log(
        `[worker] transcode pick-up job=${job.id} video=${job.data.videoId}`,
      );
      await runTranscodeJob(job);
      console.log(`[worker] transcode done video=${job.data.videoId}`);
    },
    {
      connection: redisConnection,
      concurrency: Number(process.env.TRANSCODE_CONCURRENCY ?? 2),
    },
  );

  const importWorker = new Worker<ImportJobData>(
    IMPORT_QUEUE,
    async (job) => {
      console.log(
        `[worker] import pick-up job=${job.id} video=${job.data.videoId} url=${job.data.url}`,
      );
      await runImportJob(job);
      console.log(`[worker] import done video=${job.data.videoId}`);
    },
    {
      connection: redisConnection,
      // yt-dlp ist IO-bound, concurrency separat konfigurierbar.
      concurrency: Number(process.env.IMPORT_CONCURRENCY ?? 2),
    },
  );

  const trimWorker = new Worker<TrimJobData>(
    TRIM_QUEUE,
    async (job) => {
      console.log(
        `[worker] trim pick-up job=${job.id} video=${job.data.videoId} range=${job.data.startSec}-${job.data.endSec}`,
      );
      await runTrimJob(job);
      console.log(`[worker] trim done video=${job.data.videoId}`);
    },
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );

  const captionWorker = new Worker<CaptionJobData>(
    CAPTION_QUEUE,
    async (job) => {
      console.log(
        `[worker] caption pick-up job=${job.id} video=${job.data.videoId} lang=${job.data.language ?? "de"}`,
      );
      await runCaptionJob(job);
      console.log(`[worker] caption done video=${job.data.videoId}`);
    },
    {
      connection: redisConnection,
      concurrency: 1, // Whisper is CPU-heavy; one at a time
    },
  );

  const moderateCommentWorker = new Worker<ModerateCommentJobData>(
    MODERATE_COMMENT_QUEUE,
    async (job) => {
      await processModerateComment(job);
    },
    {
      connection: redisConnection,
      concurrency: Number(process.env.MODERATE_CONCURRENCY ?? 2),
    },
  );

  const scheduleWorker = new Worker(
    SCHEDULE_CHECK_QUEUE,
    async () => {
      const res = await processScheduleCheck();
      if (res.published > 0) {
        console.log(`[worker] schedule-check: published ${res.published}`);
      }
    },
    { connection: redisConnection, concurrency: 1 },
  );

  const digestWorker = new Worker(
    DIGEST_MAIL_QUEUE,
    async () => {
      // send-hook wird hier nicht injiziert — Produktion ruft /api/admin/cron/
      // digest stattdessen, mit echter Mailer-Instanz aus apps/api. Die Worker-
      // Variante loggt die Kandidaten zur Diagnose.
      const res = await processDigestMail();
      console.log(
        `[worker] digest-mail: candidates=${res.candidates} sent=${res.sent}`,
      );
    },
    { connection: redisConnection, concurrency: 1 },
  );

  // Cron-Registrierung — idempotent, greift auch nach Restart.
  await scheduleCheckQueue.add(
    "tick",
    {},
    { repeat: { pattern: "*/1 * * * *" }, jobId: "schedule-check-cron" },
  );
  await digestMailQueue.add(
    "tick",
    {},
    { repeat: { pattern: "0 18 * * *" }, jobId: "digest-mail-cron" },
  );

  for (const [name, worker] of [
    ["transcode", transcodeWorker],
    ["import", importWorker],
    ["trim", trimWorker],
    ["caption", captionWorker],
    ["moderate-comment", moderateCommentWorker],
    ["schedule-check", scheduleWorker],
    ["digest-mail", digestWorker],
  ] as const) {
    worker.on("failed", (job, err) => {
      const videoId = (job?.data as { videoId?: string } | undefined)?.videoId;
      console.error(
        `[worker] ${name} FAILED video=${videoId ?? "-"} attempts=${job?.attemptsMade}:`,
        err,
      );
    });
    worker.on("error", (err) => {
      console.error(`[worker] ${name} error:`, err);
    });
  }

  console.log(
    `[worker] ready — listening on queues: ${TRANSCODE_QUEUE}, ${IMPORT_QUEUE}, ${TRIM_QUEUE}, ${CAPTION_QUEUE}, ${MODERATE_COMMENT_QUEUE}, ${SCHEDULE_CHECK_QUEUE}, ${DIGEST_MAIL_QUEUE}`,
  );

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} — closing…`);
    await Promise.all([
      transcodeWorker.close(),
      importWorker.close(),
      trimWorker.close(),
      captionWorker.close(),
      moderateCommentWorker.close(),
      scheduleWorker.close(),
      digestWorker.close(),
    ]);
    await redisConnection.quit();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[worker] bootstrap failed:", err);
  process.exit(1);
});
