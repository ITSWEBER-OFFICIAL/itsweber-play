#!/bin/bash
# Wartet auf Postgres-Readiness und führt dann Prisma-Migrations aus.
# Ist oneshot — migriert bei jedem Container-Boot idempotent.
set -euo pipefail

PG_USER=${POSTGRES_USER:-play}
PG_DB=${POSTGRES_DB:-itsweber_play}

echo "[migrate] warte auf Postgres..."
for i in $(seq 1 60); do
  if pg_isready -h 127.0.0.1 -p 5432 -U "${PG_USER}" -d "${PG_DB}" >/dev/null 2>&1; then
    echo "[migrate] Postgres bereit nach ${i}s"
    break
  fi
  sleep 1
  if [ "${i}" = "60" ]; then
    echo "[migrate] FEHLER: Postgres nicht erreichbar nach 60s"
    exit 1
  fi
done

cd /app/packages/db
echo "[migrate] prisma migrate deploy"
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
echo "[migrate] done"
