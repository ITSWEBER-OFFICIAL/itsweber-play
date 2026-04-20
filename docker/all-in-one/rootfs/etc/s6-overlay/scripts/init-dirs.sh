#!/bin/bash
# Legt /data-Struktur + Berechtigungen an. Idempotent.
set -euo pipefail

echo "[init-dirs] bootstrap /data"

mkdir -p /data/postgres
mkdir -p /data/redis
mkdir -p /data/minio
mkdir -p /data/minio-config
mkdir -p /data/logs
mkdir -p /run/nginx

# postgres-Debian-Package legt /var/lib/postgresql an; wir verlegen auf
# /data/postgres (persistentes Volume). Ownership nur setzen, wenn leer —
# sonst überschreiben wir nach einem Upgrade ggf. Rechte auf Sub-Verzeichnissen.
chown -R postgres:postgres /data/postgres
chmod 700 /data/postgres

# redis + minio dürfen als root laufen; Ownership ist trotzdem ordentlich.
id redis >/dev/null 2>&1 && chown -R redis:redis /data/redis || true

# Logs lesbar fürs s6-Logger
chmod 755 /data/logs

echo "[init-dirs] done"
