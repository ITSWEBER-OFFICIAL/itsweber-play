#!/usr/bin/env bash
# Play — Backup Script (Multi-Container Stack)
#
# Ersetzt passende Pfade vor dem ersten Lauf:
#   PLAY_SRC=/path/to/compose-stack
#   MINIO_SRC=/path/to/minio-data          (bei Bind-Mount)
#   BACKUP_ROOT=/path/to/backup-target
#
# Cronjob-Beispiel:  0 3 * * * BACKUP_ROOT=/backups /path/to/scripts/backup.sh

set -euo pipefail

PLAY_SRC="${PLAY_SRC:-$(pwd)}"
MINIO_SRC="${MINIO_SRC:-}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

DATE=$(date +%Y-%m-%d)
TARGET="${BACKUP_ROOT}/${DATE}"

mkdir -p "$TARGET"

echo "[$(date)] Backup startet → $TARGET"

cd "$PLAY_SRC"

# 1. Postgres-Dump
docker compose exec -T play-postgres pg_dump \
  -U "${POSTGRES_USER:-play}" \
  -d "${POSTGRES_DB:-itsweber_play}" \
  --format=custom --compress=9 \
  > "${TARGET}/postgres.dump"
echo "  ✓ postgres.dump ($(du -h "${TARGET}/postgres.dump" | cut -f1))"

# 2. MinIO-Daten
if [ -n "$MINIO_SRC" ] && [ -d "$MINIO_SRC" ]; then
  rsync -a --delete "${MINIO_SRC%/}/" "${TARGET}/minio/"
  echo "  ✓ minio-data ($(du -sh "${TARGET}/minio" | cut -f1))"
else
  # Docker-Volume: mit tar aus dem Container ziehen
  docker run --rm -v play-minio-data:/data -v "${TARGET}":/out debian:bookworm-slim \
    tar -czf /out/minio.tar.gz -C /data .
  echo "  ✓ minio.tar.gz ($(du -h "${TARGET}/minio.tar.gz" | cut -f1))"
fi

# 3. Config-Snapshot
[ -f "$PLAY_SRC/.env" ]                && cp -a "$PLAY_SRC/.env" "${TARGET}/.env.snapshot"
[ -f "$PLAY_SRC/docker-compose.yml" ]  && cp -a "$PLAY_SRC/docker-compose.yml" "${TARGET}/"
echo "  ✓ config"

# 4. Rotation
find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} +
echo "  ✓ Rotation (älter als ${RETENTION_DAYS} Tage entfernt)"

echo "[$(date)] Backup fertig"
