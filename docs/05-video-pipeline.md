# 05 — Video-Pipeline

## Stufen

```
 Upload / External Link
      │
      ▼
  [ 1. Intake ]  → speichert Originaldatei in MinIO (`play-raw/<videoId>.<ext>`)
      │
      ▼
  [ 2. Probe ]   → ffprobe: Dauer, Auflösung, Codec, Bitrate → DB
      │
      ▼
  [ 3. Thumbs ]  → 5 Kandidaten-Frames bei 10%, 25%, 50%, 75%, 90%
      │            → MinIO (`play-thumbs/<videoId>-<n>.webp`)
      │            → User wählt im Studio einen als Hauptthumbnail
      ▼
  [ 4. Transcode ] → FFmpeg erzeugt 3-4 HLS-Varianten:
      │                1080p @ 5 Mbps  (nur wenn Source ≥ 1080p)
      │                 720p @ 2.8 Mbps
      │                 480p @ 1.2 Mbps
      │                 360p @ 0.6 Mbps
      │            → HLS (fmp4-Segmente, 4s) + master.m3u8
      │            → MinIO (`play-videos/<videoId>/master.m3u8` + Segmente)
      ▼
  [ 5. Finalize ] → DB-Status: `processing` → `live`
                 → WS-Event an Owner: „Dein Video ist bereit"
```

## Queue / Worker

- **BullMQ** Queue `transcode-jobs` (Priorität: User-Uploads > External-Imports)
- `play-worker` konsumiert, läuft FFmpeg als Subprocess
- Concurrency: 2 (CPU-bound, muss zu Unraid-CPU passen)
- Retry: 2× bei transient errors (disk full, S3 timeout)
- Fehler bleiben als `status=failed` mit `failure_reason` in DB sichtbar

## FFmpeg-Command (vereinfacht)

```bash
ffmpeg -i <input> \
  -map 0:v -map 0:a \
  -c:v libx264 -preset medium -crf 22 \
  -c:a aac -b:a 128k \
  -f hls \
  -hls_time 4 -hls_playlist_type vod \
  -hls_segment_type fmp4 \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0,name:1080p v:1,a:0,name:720p ..." \
  /tmp/out/%v/playlist.m3u8
```

Konkrete Varianten pro Qualität via `-b:v` und `-s`.

## External Import (`yt-dlp`)

```bash
yt-dlp \
  --format "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/best[height<=1080]" \
  --merge-output-format mp4 \
  --no-playlist \
  --write-info-json \
  -o "<videoId>.%(ext)s" \
  <url>
```

- Metadata (Titel, Beschreibung, Uploader) werden als Vorbefüllung für das Studio-Formular übernommen
- Default `visibility=private` bei externen Quellen (rechtlicher Safe-Guard)
- Hinweis-Banner im UI: „Du bist verantwortlich für Urheberrechte importierter Inhalte"

## Storage-Layout (MinIO-Buckets)

```
play-raw/
  <videoId>.<ext>             # Original-Upload (optional Retention 7 Tage)

play-videos/
  <videoId>/
    master.m3u8
    1080p/
      init.mp4
      seg-000.m4s
      ...
    720p/
    480p/

play-thumbs/
  <videoId>-candidate-1.webp   # 5 Kandidaten
  ...
  <videoId>-main.webp          # vom User ausgewählt

play-assets/
  logo.png
  favicon.ico
  hero-bg-<id>.jpg
```

## Retention

- `play-raw/`: default 7 Tage nach erfolgreichem Transcode (Admin-Setting 0=keep forever)
- `play-videos/`, `play-thumbs/`: bleiben bis Video gelöscht wird
- Gelöschte Videos: 30 Tage Soft-Delete (Papierkorb im Studio), dann harte Entfernung

## GPU-Support (später)

Wenn eine GPU dediziert für Transcoding verfügbar ist:
```bash
ffmpeg -hwaccel cuda -c:v h264_cuvid -i <input> ... -c:v h264_nvenc -preset p4 ...
```
Toggle via `TRANSCODE_USE_GPU=1` in `.env`. Worker-Image benötigt NVIDIA-
bzw. VAAPI-Runtime auf dem Host.
