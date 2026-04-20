#!/usr/bin/env bash
# Play — Backup Script (All-in-One Variante)
#
# Cronjob-Beispiel:
#   0 3 * * * APPDATA=/path/to/appdata BACKUP_ROOT=/path/to/backups /path/to/scripts/backup-all-in-one.sh
#
# Erwartet einen laufenden All-in-One-Container. Daten liegen im
# bind-mount ${APPDATA}/data bzw. im docker-volume `play-data:/data`.

set -euo pipefail

CONTAINER=${CONTAINER:-play}
APPDATA=${APPDATA:-}
BACKUP_ROOT=${BACKUP_ROOT:-./backups}
DATE=$(date +%Y-%m-%d_%H%M)
TARGET="${BACKUP_ROOT}/${DATE}"
RETENTION_DAYS=${RETENTION_DAYS:-30}

mkdir -p "$TARGET"

echo "[$(date)] Backup startet → $TARGET"

# 1. Postgres-Dump aus dem Container heraus (custom-format, compress=9).
# Der Container exposed Postgres nicht — wir gehen über `docker exec` und
# den lokalen Unix-Socket innerhalb des Containers.
docker exec "$CONTAINER" su - postgres -c \
  "pg_dump -U play -d itsweber_play --format=custom --compress=9" \
  > "${TARGET}/postgres.dump"
echo "  ✓ postgres.dump ($(du -h "${TARGET}/postgres.dump" | cut -f1))"

# 2. MinIO-Daten (Rohdaten unter /data/minio im Container = appdata/.../data/minio).
rsync -a --delete \
  "${APPDATA}/data/minio/" \
  "${TARGET}/minio/"
echo "  ✓ minio-data ($(du -sh "${TARGET}/minio" | cut -f1))"

# 3. Redis-AOF (BullMQ-Queue + Sessions). Klein, aber für Job-Restart wichtig.
rsync -a "${APPDATA}/data/redis/" "${TARGET}/redis/" 2>/dev/null || true
echo "  ✓ redis-aof"

# 4. Config-Snapshot (Secrets enthalten — Backup-Verzeichnis schützen!)
cp -a "${APPDATA}/.env.production" "${TARGET}/.env.production"
echo "  ✓ env-snapshot"

# 5. Rotation
find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} +
echo "  ✓ Rotation (älter als ${RETENTION_DAYS} Tage entfernt)"

echo "[$(date)] Backup fertig — $(du -sh "${TARGET}" | cut -f1)"
