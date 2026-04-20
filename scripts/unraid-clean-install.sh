#!/usr/bin/env bash
#
# Play — Clean Re-Install via GHCR (All-in-One)
#
# - Stoppt + entfernt bestehenden Container
# - Sichert das alte data-Verzeichnis unter data.bak-<timestamp>
# - Pullt das Image von GHCR
# - Startet Container neu mit Env aus $APPDATA/.env.production
# - Healthcheck + /setup HTTP-Test
#
# Erforderliche Env-Variablen beim Aufruf (sonst Defaults):
#   APPDATA         Pfad zum AppData-Verzeichnis (enthält .env.production und data/)
#   CONTAINER       Container-Name (Default: play)
#   IMAGE           Voll-qualifiziertes Image (Default: ghcr.io/itsweber-official/itsweber-play:main)
#   NETWORK         Docker-Netzwerk (optional, z. B. macvlan-Name)
#   IP              statische Container-IP (optional, nur mit NETWORK)
#   PORT            Host-Port (Default: 3000) — ignoriert wenn NETWORK+IP gesetzt
#
# Beispiel (generisch):
#   APPDATA=/srv/play-data scripts/unraid-clean-install.sh
#
set -euo pipefail

CONTAINER="${CONTAINER:-play}"
IMAGE="${IMAGE:-ghcr.io/itsweber-official/itsweber-play:main}"
APPDATA="${APPDATA:?APPDATA env-var not set}"
DATA_DIR="$APPDATA/data"
ENV_FILE="$APPDATA/.env.production"
PORT="${PORT:-3000}"
TS=$(date +%Y%m%d-%H%M%S)

if [ ! -f "$ENV_FILE" ]; then
  echo "FATAL: $ENV_FILE fehlt. Bitte upload vor Ausführung." >&2
  exit 2
fi

echo "==> 1/6 Stop + remove container"
docker stop "$CONTAINER" 2>/dev/null || true
docker rm "$CONTAINER" 2>/dev/null || true

echo "==> 2/6 Backup existing data dir to $APPDATA/data.bak-$TS"
if [ -d "$DATA_DIR" ] && [ -n "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
  mv "$DATA_DIR" "$APPDATA/data.bak-$TS"
fi
mkdir -p "$DATA_DIR"

echo "==> 3/6 Pull image from $IMAGE"
docker pull "$IMAGE"

echo "==> 4/6 Start new container"
NET_ARGS=()
if [ -n "${NETWORK:-}" ]; then
  NET_ARGS+=(--network "$NETWORK")
  [ -n "${IP:-}" ] && NET_ARGS+=(--ip "$IP")
else
  NET_ARGS+=(-p "${PORT}:3000")
fi

docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  "${NET_ARGS[@]}" \
  -v "$DATA_DIR":/data \
  --env-file "$ENV_FILE" \
  "$IMAGE"

echo "==> 5/6 Wait for healthy (max 5 min)"
for i in $(seq 1 60); do
  status=$(docker inspect "$CONTAINER" --format '{{.State.Health.Status}}' 2>/dev/null || echo "none")
  echo "  [$i/60] health=$status"
  if [ "$status" = "healthy" ]; then break; fi
  sleep 5
done

echo "==> 6/6 HTTP test (container-internal)"
docker exec "$CONTAINER" wget -qO- -T 3 http://127.0.0.1:3000/health || true

echo "==> DONE. Image: $(docker inspect $CONTAINER --format '{{.Image}}')"
