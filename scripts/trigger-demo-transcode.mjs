#!/usr/bin/env node
/**
 * Enqueues a transcode job for a demo video that already has a raw-file in MinIO.
 * Usage: node trigger-demo-transcode.mjs <rawKey> <videoSlug>
 *
 * Reads REDIS_HOST / REDIS_PORT from env (or .env file).
 */
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

// Load .env manually (no dotenv dep in scripts)
const envPath = resolve(PROJECT_ROOT, ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const [rawKey, videoSlug] = process.argv.slice(2);
if (!rawKey || !videoSlug) {
  console.error("Usage: trigger-demo-transcode.mjs <rawKey> <videoSlug>");
  process.exit(1);
}

const redis = new IORedis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
});

const queue = new Queue("transcode", { connection: redis });
const prisma = new PrismaClient();

try {
  const video = await prisma.video.findUnique({
    where: { slug: videoSlug },
    select: { id: true, status: true },
  });

  if (!video) {
    console.error(`[trigger] Video not found: ${videoSlug}`);
    process.exit(1);
  }

  if (video.status === "PROCESSING") {
    console.log(`[trigger] ${videoSlug} is already PROCESSING — skip.`);
    process.exit(0);
  }

  await prisma.video.update({
    where: { id: video.id },
    data: { status: "PROCESSING", failureReason: null },
  });

  await queue.add(
    "transcode",
    { videoId: video.id, rawKey, sourceType: "UPLOAD" },
    { attempts: 2, backoff: { type: "exponential", delay: 5000 } },
  );

  console.log(`[trigger] Enqueued transcode for ${videoSlug} (videoId=${video.id}, rawKey=${rawKey})`);
} finally {
  await prisma.$disconnect();
  await redis.quit();
}
