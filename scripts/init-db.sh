#!/usr/bin/env bash
# Wird im Entrypoint von play-api ausgeführt (vor dem Serverstart).
set -euo pipefail

echo "[init-db] warte auf Postgres..."
until pg_isready -h "${POSTGRES_HOST}" -U "${POSTGRES_USER}" >/dev/null 2>&1; do
  sleep 1
done

echo "[init-db] Prisma migrate deploy"
pnpm --filter @play/db migrate:deploy

echo "[init-db] Seed (idempotent)"
pnpm --filter @play/db seed

echo "[init-db] fertig"
