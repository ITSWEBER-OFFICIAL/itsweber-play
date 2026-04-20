// Browser-seitige Helper für die öffentlichen MinIO-URLs.
// Secrets gehören nicht ins Bundle — wir verwenden nur den Read-Endpoint.

// Gleiche Strategie wie API_URL in trpc.ts: Browser nutzt same-origin
// (`/s3`, wird von Nginx zu MinIO proxied), Server/Build nutzt absolute URL.
const S3_PUBLIC =
  typeof window !== "undefined"
    ? `${window.location.origin}/s3`
    : (process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "http://127.0.0.1:9000");

export function videoHlsUrl(videoId: string): string {
  return `${S3_PUBLIC}/play-videos/${videoId}/master.m3u8`;
}

export function thumbnailUrl(thumbKey: string): string {
  return `${S3_PUBLIC}/play-thumbs/${thumbKey}`;
}

// Channel-Assets (Avatar/Banner) und Logo liegen im play-assets-Bucket.
// Keys wie "avatar/<id>.png" / "banner/<id>.png" / "logo/<uuid>.png".
export function assetUrl(key: string): string {
  return `${S3_PUBLIC}/play-assets/${key}`;
}

export function captionUrl(key: string): string {
  return `${S3_PUBLIC}/play-assets/${key}`;
}

