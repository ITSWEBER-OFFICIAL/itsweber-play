import { Queue, QueueEvents, Worker } from "bullmq";
import IORedis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);

// BullMQ erwartet maxRetriesPerRequest=null für Worker (damit lange
// blpop-Calls nicht vorzeitig abbrechen).
export const redisConnection = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
});

export const TRANSCODE_QUEUE = "transcode";
export const IMPORT_QUEUE = "import";
export const TRIM_QUEUE = "trim";
export const CAPTION_QUEUE = "caption-generate";
export const MODERATE_COMMENT_QUEUE = "moderate-comment";
export const SCHEDULE_CHECK_QUEUE = "video-schedule-check";
export const DIGEST_MAIL_QUEUE = "digest-mail";

export interface TranscodeJobData {
  videoId: string;
  rawKey: string; // Key im `play-raw`-Bucket
  sourceType: "UPLOAD" | "EXTERNAL";
  // User-Intent vom Upload-/Import-Flow. Wenn gesetzt, überschreibt der
  // Worker die automatische Aspect-Ratio/Dauer-Klassifikation.
  formatHint?: "LONG" | "SHORT";
}

export interface ImportJobData {
  videoId: string;
  url: string;
  formatHint?: "LONG" | "SHORT";
}

export interface TrimJobData {
  videoId: string;
  rawKey: string;
  startSec: number;
  endSec: number;
}

export interface CaptionJobData {
  videoId: string;
  // HLS-master-key in play-videos bucket; worker streams the first segment
  hlsKey: string;
  // BCP-47 language hint, defaults to "de" (multilingual model handles both)
  language?: string;
}

export const transcodeQueue = new Queue<TranscodeJobData>(TRANSCODE_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: false,
  },
});

// Priorität niedriger als Upload-Transcodes (per defaultJobOptions.priority
// beim Enqueue steuern — s. upload.ts). yt-dlp kann lange laufen, soll aber
// nicht Upload-Jobs blockieren.
export const importQueue = new Queue<ImportJobData>(IMPORT_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: false,
  },
});

export const trimQueue = new Queue<TrimJobData>(TRIM_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1, // Trim ist schnell; bei Fehler lieber User-Feedback.
    removeOnComplete: { age: 3600 },
    removeOnFail: false,
  },
});

export const captionQueue = new Queue<CaptionJobData>(CAPTION_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail: false,
  },
});

export interface ModerateCommentJobData {
  commentId: string;
}

export const moderateCommentQueue = new Queue<ModerateCommentJobData>(
  MODERATE_COMMENT_QUEUE,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 3600 * 24 },
      removeOnFail: { age: 3600 * 24 * 7 },
    },
  },
);

export const scheduleCheckQueue = new Queue(SCHEDULE_CHECK_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: { count: 20 },
  },
});

export const digestMailQueue = new Queue(DIGEST_MAIL_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 3600 * 24 * 7 },
    removeOnFail: { count: 20 },
  },
});

export const transcodeQueueEvents = new QueueEvents(TRANSCODE_QUEUE, {
  connection: redisConnection.duplicate(),
});

export { Worker };
