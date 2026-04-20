#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  seed-demo-videos.sh — Demo-Asset-Pipeline für ITSWEBER Play
#
#  Was dieses Skript tut:
#  1. Lädt 4 Remotion-gerenderte MP4s aus einem GitHub-Release (URL konfigurierbar)
#  2. Lädt sie in den MinIO play-raw-Bucket hoch
#  3. Enqueued den Transcode-Job für jedes Video via Node.js helper
#  4. Idempotent — bei erneutem Lauf werden bereits vorhandene MinIO-Keys übersprungen
#
#  Voraussetzungen:
#  - .env muss gesetzt sein (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, REDIS_HOST)
#  - Docker-Stack läuft (play-minio + play-redis)
#  - Mindestens ein ADMIN-User + SEED_DEMO=1 ausgeführt (DB hat Video-Rows)
#
#  Aufruf:
#    scripts/seed-demo-videos.sh [--gh-release <TAG>]
#
#  Platzhalter-URL (wird bei Release durch echten GH-Release-Tag ersetzt):
#    GH_RELEASE_TAG (default: v0.4.0)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Env laden ────────────────────────────────────────────────────────────────
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "${PROJECT_ROOT}/.env" | grep -v '^\s*$' | xargs)
fi

# ── Konfiguration ─────────────────────────────────────────────────────────────
GH_RELEASE_TAG="${GH_RELEASE_TAG:-v0.4.0}"
GH_REPO="${GH_REPO:-itsweber/play}"
# Wenn DEMO_ASSETS_URL gesetzt, wird dieser Basis-URL statt GH-Release genutzt
DEMO_ASSETS_URL="${DEMO_ASSETS_URL:-https://github.com/${GH_REPO}/releases/download/${GH_RELEASE_TAG}}"

S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-minioadmin}"
S3_SECRET_KEY="${S3_SECRET_KEY:-minioadmin}"
RAW_BUCKET="${S3_BUCKET_RAW:-play-raw}"
THUMBS_BUCKET="${S3_BUCKET_THUMBS:-play-thumbs}"

WORK_DIR="${TMPDIR:-/tmp}/play-demo-assets"

# Parse --gh-release argument
while [[ $# -gt 0 ]]; do
  case "$1" in
    --gh-release) GH_RELEASE_TAG="$2"; shift 2 ;;
    *) echo "Unbekanntes Argument: $1" >&2; exit 1 ;;
  esac
done

# ── Tools prüfen ──────────────────────────────────────────────────────────────
for tool in curl node; do
  if ! command -v "$tool" &>/dev/null; then
    echo "ERROR: '$tool' nicht gefunden." >&2
    exit 1
  fi
done

# mc (MinIO-Client) — optional, fallback auf curl/aws
MC=""
if command -v mc &>/dev/null; then
  MC="mc"
elif command -v mcli &>/dev/null; then
  MC="mcli"
fi

echo "[demo-seed] GH-Release: ${GH_RELEASE_TAG} (${DEMO_ASSETS_URL})"
echo "[demo-seed] MinIO: ${S3_ENDPOINT} / ${RAW_BUCKET}"
mkdir -p "${WORK_DIR}"

# ── Asset-Definitionen ─────────────────────────────────────────────────────────
# Format: "composition_id:raw_key:thumb_key:video_slug"
declare -a ASSETS=(
  "WelcomeLong:demo-assets/WelcomeLong.mp4:demo-assets/WelcomeLong-thumb.webp:demo-itsweber-play-welcome"
  "StudioTourLong:demo-assets/StudioTourLong.mp4:demo-assets/StudioTourLong-thumb.webp:demo-itsweber-studio-tour"
  "ShortsFeatureShort:demo-assets/ShortsFeatureShort.mp4:demo-assets/ShortsFeatureShort-thumb.webp:demo-itsweber-shorts-feature"
  "AccessibilityShort:demo-assets/AccessibilityShort.mp4:demo-assets/AccessibilityShort-thumb.webp:demo-itsweber-barrierefrei"
)

# ── mc konfigurieren (falls verfügbar) ────────────────────────────────────────
if [[ -n "$MC" ]]; then
  $MC alias set play-minio "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" --api S3v4 2>/dev/null || true
fi

# ── Helper: MinIO-Key existiert? ───────────────────────────────────────────────
key_exists() {
  local bucket="$1"
  local key="$2"
  if [[ -n "$MC" ]]; then
    $MC stat "play-minio/${bucket}/${key}" &>/dev/null
  else
    # Fallback: HEAD über AWS S3-kompatible API via curl
    local url="${S3_ENDPOINT}/${bucket}/${key}"
    curl -s -o /dev/null -w "%{http_code}" \
      --aws-sigv4 "aws:amz:us-east-1:s3" \
      --user "${S3_ACCESS_KEY}:${S3_SECRET_KEY}" \
      -I "$url" | grep -q "^200"
  fi
}

# ── Helper: Datei nach MinIO hochladen ─────────────────────────────────────────
upload_file() {
  local local_path="$1"
  local bucket="$2"
  local key="$3"
  local content_type="${4:-application/octet-stream}"

  if [[ -n "$MC" ]]; then
    $MC cp "$local_path" "play-minio/${bucket}/${key}" --attr "content-type=${content_type}"
  else
    # curl-Fallback (benötigt AWS-SigV4-Unterstützung)
    curl -s -X PUT \
      --aws-sigv4 "aws:amz:us-east-1:s3" \
      --user "${S3_ACCESS_KEY}:${S3_SECRET_KEY}" \
      -H "Content-Type: ${content_type}" \
      --upload-file "$local_path" \
      "${S3_ENDPOINT}/${bucket}/${key}"
  fi
}

# ── Haupt-Loop ─────────────────────────────────────────────────────────────────
ENQUEUE_ARGS=()

for asset in "${ASSETS[@]}"; do
  IFS=':' read -r comp_id raw_key thumb_key video_slug <<< "$asset"

  echo ""
  echo "[demo-seed] === ${comp_id} ==="

  # MP4 hochladen
  if key_exists "${RAW_BUCKET}" "${raw_key}"; then
    echo "[demo-seed] RAW-Key bereits vorhanden: ${raw_key} — skip Download"
  else
    mp4_file="${WORK_DIR}/${comp_id}.mp4"
    if [[ ! -f "$mp4_file" ]]; then
      download_url="${DEMO_ASSETS_URL}/${comp_id}.mp4"
      echo "[demo-seed] Download: ${download_url}"
      curl -fL --progress-bar -o "$mp4_file" "$download_url" || {
        echo "[demo-seed] WARN: Download fehlgeschlagen für ${comp_id} — überspringe."
        continue
      }
    else
      echo "[demo-seed] Bereits heruntergeladen: ${mp4_file}"
    fi
    echo "[demo-seed] Upload MP4 → ${RAW_BUCKET}/${raw_key}"
    upload_file "$mp4_file" "${RAW_BUCKET}" "${raw_key}" "video/mp4"
  fi

  # WebP-Thumbnail hochladen (optional — wird durch Transcode neu generiert)
  webp_file="${WORK_DIR}/${comp_id}-thumb.webp"
  if [[ -f "$webp_file" ]] && ! key_exists "${THUMBS_BUCKET}" "${thumb_key}"; then
    echo "[demo-seed] Upload Thumbnail → ${THUMBS_BUCKET}/${thumb_key}"
    upload_file "$webp_file" "${THUMBS_BUCKET}" "${thumb_key}" "image/webp"
  fi

  ENQUEUE_ARGS+=("${raw_key}:${video_slug}")
done

# ── Transcode-Jobs via Node.js enqueuen ───────────────────────────────────────
echo ""
echo "[demo-seed] Enqueue Transcode-Jobs…"

TRIGGER_SCRIPT="${SCRIPT_DIR}/trigger-demo-transcode.mjs"
if [[ -f "$TRIGGER_SCRIPT" ]]; then
  for entry in "${ENQUEUE_ARGS[@]}"; do
    IFS=':' read -r raw_key video_slug <<< "$entry"
    echo "[demo-seed]   → ${video_slug} (${raw_key})"
    node "$TRIGGER_SCRIPT" "${raw_key}" "${video_slug}" || {
      echo "[demo-seed] WARN: Enqueue fehlgeschlagen für ${video_slug}"
    }
  done
else
  echo "[demo-seed] WARN: ${TRIGGER_SCRIPT} nicht gefunden — Transcode-Jobs müssen manuell gestartet werden."
  echo "[demo-seed]       Alternativ: Admin-Panel → Videos → Transcode-Button."
fi

echo ""
echo "[demo-seed] ✓ Demo-Asset-Pipeline abgeschlossen."
echo "[demo-seed]   Warte ~2-5 min auf Transcode-Abschluss, dann sind die Videos abspielbar."
echo "[demo-seed]   Status prüfen: docker compose logs -f play-worker"
