#!/usr/bin/env bash
#
# Unraid Clean Re-Install via GHCR
#
# - Stoppt + entfernt bestehenden itsweber-play Container
# - Sichert /mnt/user/appdata/itsweber-play-data → timestamped Backup-Dir
# - Pullt ghcr.io/itsweber-official/itsweber-play:latest
# - Startet Container neu mit Env aus $APPDATA/.env
# - Healthcheck + /setup HTTP-Test
#
# Erwartet auf Unraid: /mnt/user/appdata/itsweber-play-data/.env
# Ausführen via:  ssh unraid 'bash -s' < scripts/unraid-clean-install.sh
#
set -euo pipefail

CONTAINER=itsweber-play
IMAGE=ghcr.io/itsweber-official/itsweber-play:latest
APPDATA=/mnt/user/appdata/itsweber-play-data
DATA_DIR="$APPDATA/data"
ENV_FILE="$APPDATA/.env"
NETWORK=br1
IP=10.10.8.51
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

echo "==> 3/6 Pull latest image from GHCR"
docker pull "$IMAGE"

echo "==> 4/6 Start new container"
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  --network "$NETWORK" --ip "$IP" \
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

echo "==> 6/6 HTTP test"
curl -sSfo /dev/null -w "   /         HTTP %{http_code}\n" "http://$IP:3000/" || true
curl -sSfo /dev/null -w "   /setup    HTTP %{http_code}\n" "http://$IP:3000/setup" || true

echo "==> DONE. Image: $(docker inspect $CONTAINER --format '{{.Image}}')"
