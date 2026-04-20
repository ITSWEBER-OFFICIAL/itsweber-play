import { Client as MinioClient } from "minio";
import type { Readable } from "node:stream";

// MinIO-Endpoint-URL wird aus S3_ENDPOINT zusammengestellt. Wir parsen nur
// Protocol/Host/Port — die minio-SDK nimmt Host + Port + useSSL separat.
function parseEndpoint(
  endpoint: string,
): { endPoint: string; port: number; useSSL: boolean } {
  const url = new URL(endpoint);
  return {
    endPoint: url.hostname,
    port: url.port
      ? Number(url.port)
      : url.protocol === "https:"
        ? 443
        : 80,
    useSSL: url.protocol === "https:",
  };
}

const {
  S3_ENDPOINT,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_REGION,
  S3_BUCKET_VIDEOS,
  S3_BUCKET_THUMBS,
} = process.env;

export const config = {
  endpoint: S3_ENDPOINT ?? "http://localhost:9000",
  region: S3_REGION ?? "us-east-1",
  buckets: {
    videos: S3_BUCKET_VIDEOS ?? "play-videos",
    thumbs: S3_BUCKET_THUMBS ?? "play-thumbs",
    raw: "play-raw",
    assets: "play-assets",
  },
} as const;

if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
  // Non-fatal at module-load — manche Scripts (typecheck, build) brauchen
  // das Modul nur als Type-Quelle. Echte API-Calls werfen beim Client-Aufruf.
  console.warn(
    "[@play/storage] S3_ACCESS_KEY / S3_SECRET_KEY fehlen in env — MinIO-Calls werden fehlschlagen.",
  );
}

const parsed = parseEndpoint(config.endpoint);

export const s3 = new MinioClient({
  endPoint: parsed.endPoint,
  port: parsed.port,
  useSSL: parsed.useSSL,
  accessKey: S3_ACCESS_KEY ?? "",
  secretKey: S3_SECRET_KEY ?? "",
  region: config.region,
});

// ─── High-level helpers ───────────────────────────────────────────────────

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer | Readable,
  metadata: Record<string, string> = {},
): Promise<void> {
  const size = Buffer.isBuffer(body) ? body.length : undefined;
  await s3.putObject(bucket, key, body, size, metadata);
}

export async function getObject(bucket: string, key: string): Promise<Readable> {
  return s3.getObject(bucket, key);
}

export async function statObject(bucket: string, key: string) {
  return s3.statObject(bucket, key);
}

export async function removeObject(bucket: string, key: string): Promise<void> {
  await s3.removeObject(bucket, key);
}
