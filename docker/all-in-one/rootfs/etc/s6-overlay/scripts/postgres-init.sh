#!/bin/bash
# First-Run: initdb + User/DB anlegen gemäß $POSTGRES_USER / $POSTGRES_DB /
# $POSTGRES_PASSWORD. Re-Runs erkennen bestehenden Cluster und überspringen.
set -euo pipefail

PGDATA=/data/postgres
PGBIN=/usr/lib/postgresql/16/bin
BOOTSTRAP_MARKER="${PGDATA}/.play-bootstrap-done"

PG_USER=${POSTGRES_USER:-play}
PG_DB=${POSTGRES_DB:-itsweber_play}
PG_PASS=${POSTGRES_PASSWORD:-play-dev-password}

echo "[postgres-init] PGDATA=${PGDATA}"

# Marker-Datei trennt initdb-Phase vom User-Bootstrap. Falls Container in den
# Sekunden zwischen initdb und CREATE USER stirbt, läuft der Bootstrap beim
# nächsten Boot zu Ende — sonst säße man auf einem leeren Cluster ohne App-User.
if [ ! -s "${PGDATA}/PG_VERSION" ]; then
  echo "[postgres-init] frischer Cluster → initdb"
  s6-setuidgid postgres "${PGBIN}/initdb" \
    --auth-local=trust \
    --auth-host=scram-sha-256 \
    --encoding=UTF8 \
    --locale=C.UTF-8 \
    -D "${PGDATA}"

  sed -i "s/^#listen_addresses.*/listen_addresses = '127.0.0.1'/" "${PGDATA}/postgresql.conf"
fi

if [ ! -f "${BOOTSTRAP_MARKER}" ]; then
  echo "[postgres-init] App-User + DB anlegen"

  # Unix-Socket in /tmp, weil /var/run/postgresql nicht garantiert beschreibbar
  # ist und wir den initialen psql-Aufruf NICHT über TCP machen wollen — auf
  # TCP gilt scram-sha-256 (kein Passwort gesetzt → Auth schlägt fehl).
  # auth-local=trust erlaubt den passwortlosen Socket-Connect für das Bootstrap.
  s6-setuidgid postgres "${PGBIN}/pg_ctl" -D "${PGDATA}" \
    -o "-p 5432 -k /tmp -c listen_addresses=" \
    -w -l /tmp/postgres-init.log start

  s6-setuidgid postgres "${PGBIN}/psql" -v ON_ERROR_STOP=1 -h /tmp -p 5432 postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${PG_USER}') THEN
    CREATE ROLE "${PG_USER}" LOGIN PASSWORD '${PG_PASS}' CREATEDB;
  ELSE
    ALTER ROLE "${PG_USER}" WITH LOGIN PASSWORD '${PG_PASS}' CREATEDB;
  END IF;
END
\$\$;
SQL

  if ! s6-setuidgid postgres "${PGBIN}/psql" -v ON_ERROR_STOP=1 -h /tmp -p 5432 -tAc \
      "SELECT 1 FROM pg_database WHERE datname = '${PG_DB}'" postgres | grep -q 1; then
    s6-setuidgid postgres "${PGBIN}/psql" -v ON_ERROR_STOP=1 -h /tmp -p 5432 postgres <<SQL
CREATE DATABASE "${PG_DB}" OWNER "${PG_USER}" TEMPLATE template0 ENCODING 'UTF8';
SQL
  fi

  s6-setuidgid postgres "${PGBIN}/pg_ctl" -D "${PGDATA}" -m fast -w stop

  touch "${BOOTSTRAP_MARKER}"
  chown postgres:postgres "${BOOTSTRAP_MARKER}"
  echo "[postgres-init] Bootstrap fertig"
else
  echo "[postgres-init] bereits initialisiert, nichts zu tun"
fi
