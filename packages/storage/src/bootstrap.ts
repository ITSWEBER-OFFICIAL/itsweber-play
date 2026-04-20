import { s3, config } from "./client";

// Idempotente Bucket-Initialisierung. Wird beim ersten Worker-/API-Start
// aufgerufen — legt fehlende Buckets an und setzt die öffentlichen Buckets
// (videos, thumbs, assets) auf anonyme Lesezugriffe, damit HLS/Thumbs/Logos
// direkt vom Browser ladbar sind. play-raw bleibt privat (Original-Uploads).

const PUBLIC_READ_POLICY = (bucket: string) =>
  JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });

export async function ensureBuckets(): Promise<void> {
  const all = Object.values(config.buckets);
  for (const name of all) {
    const exists = await s3.bucketExists(name).catch(() => false);
    if (!exists) {
      await s3.makeBucket(name, config.region);
      console.log(`[@play/storage] bucket created: ${name}`);
    }
  }

  // Nur die „public"-Buckets erhalten den Anonymous-Read-Policy.
  for (const name of [
    config.buckets.videos,
    config.buckets.thumbs,
    config.buckets.assets,
  ] as const) {
    try {
      await s3.setBucketPolicy(name, PUBLIC_READ_POLICY(name));
    } catch (err) {
      console.warn(`[@play/storage] setBucketPolicy(${name}) failed:`, err);
    }
  }
}
