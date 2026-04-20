# Demo Assets — GH Release Download & Seed Pipeline

Demo videos are pre-rendered Remotion compositions. They are NOT baked into the Docker image. Instead, they are downloaded at deploy-time from a GitHub Release.

## How it works

1. `pnpm seed` (packages/db) creates 4 video rows in `FAILED` state with a clear `failureReason`.
2. `scripts/seed-demo-videos.sh` downloads the MP4s and triggers transcoding.

## Running the pipeline

```bash
# Default: download from GH Release v0.4.0
bash scripts/seed-demo-videos.sh

# Custom URL
DEMO_ASSETS_URL=https://my-cdn.example.com bash scripts/seed-demo-videos.sh

# Custom MinIO alias (default: "play")
MINIO_ALIAS=myminio bash scripts/seed-demo-videos.sh
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DEMO_ASSETS_URL` | GH Release v0.4.0 | Base URL for MP4 downloads |
| `MINIO_ALIAS` | `play` | `mc` alias pointing at MinIO instance |
| `DATABASE_URL` | from `.env` | Prisma connection string |
| `REDIS_URL` | from `.env` | BullMQ connection |

## Expected GH Release structure

```
https://.../v0.4.0/WelcomeLong.mp4
https://.../v0.4.0/StudioTourLong.mp4
https://.../v0.4.0/ShortsFeatureShort.mp4
https://.../v0.4.0/AccessibilityShort.mp4
```

## Troubleshooting

- **Video stuck in FAILED** — run `bash scripts/seed-demo-videos.sh` and watch worker logs.
- **mc not found** — the script falls back to `curl` for upload. MinIO Client is optional.
- **Video exists but no HLS** — the transcode job may have failed; check `docker compose logs worker`.

## Re-rendering demo assets

```bash
cd apps/remotion
pnpm render                         # all 4 compositions
pnpm render -- --composition WelcomeLong  # single
```

Upload the output MP4s to your GH Release `v0.4.0` (or update `DEMO_ASSETS_URL`).
