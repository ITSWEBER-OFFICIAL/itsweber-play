#!/usr/bin/env bash
# ITSWEBER Play — Backup Script
# Auf Unraid als Cronjob einrichten:  0 3 * * * /mnt/user/appdata/itsweber-play-src/scripts/backup.sh

set -euo pipefail

BACKUP_ROOT="/mnt/user/Backup/itsweber-play"
DATE=$(date +%Y-%m-%d)
TARGET="${BACKUP_ROOT}/${DATE}"
RETENTION_DAYS=30

mkdir -p "$TARGET"

echo "[$(date)] Backup startet → $TARGET"

# 1. Postgres-Dump
docker compose exec -T play-postgres pg_dump \
  -U "${POSTGRES_USER:-play}" \
  -d "${POSTGRES_DB:-itsweber_play}" \
  --format=custom --compress=9 \
  > "${TARGET}/postgres.dump"
echo "  ✓ postgres.dump ($(du -h "${TARGET}/postgres.dump" | cut -f1))"

# 2. MinIO-Daten (rsync statt mc — simpler auf Unraid)
rsync -a --delete \
  /mnt/user/appdata/itsweber-play/minio/ \
  "${TARGET}/minio/"
echo "  ✓ minio-data ($(du -sh "${TARGET}/minio" | cut -f1))"

# 3. Config-Snapshot (.env ohne Secrets? → NEIN, wir brauchen sie zum Restore)
cp -a /mnt/user/appdata/itsweber-play-src/.env "${TARGET}/.env.snapshot"
cp -a /mnt/user/appdata/itsweber-play-src/docker-compose.yml "${TARGET}/"
echo "  ✓ config"

# 4. Rotation
find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} +
echo "  ✓ Rotation (älter als ${RETENTION_DAYS} Tage entfernt)"

echo "[$(date)] Backup fertig"
