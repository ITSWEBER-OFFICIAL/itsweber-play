# Play — All-in-One Container

Ein einziger Docker-Container mit allen Services hinter `s6-overlay`:

| Service | Port (intern) | Beschreibung |
|---|---|---|
| Nginx | **3000** (exposed) | Port-Multiplexer: `/api/*` → API, `/s3/*` → MinIO, `/` → Next.js |
| Next.js Web | 3001 | App-Router, Standalone-Build |
| Fastify API | 4000 | tRPC + Better-Auth + Uploads |
| BullMQ Worker | — | Transcode (FFmpeg), Import (yt-dlp), Caption (whisper.cpp), Scheduler |
| PostgreSQL 16 | 5432 | via PGDG, Data in `/data/postgres` |
| Redis 7 | 6379 | AOF-Persistenz in `/data/redis` |
| MinIO | 9000 (9001 console) | S3-kompatibel, Data in `/data/minio` |

Single Exposed Port = **3000**. Single Volume = **/data**.

## Build

```bash
docker build -t play:dev -f docker/all-in-one/Dockerfile .
```

Dauert ~8-15 min beim ersten Lauf (pnpm install, Next-Build, whisper.cpp-Compile).

## Run

```bash
cp .env.all-in-one.example .env.all-in-one
# Secrets editieren (AUTH_SECRET, POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD)

docker run -d \
  --name play \
  -p 3000:3000 \
  -v play-data:/data \
  --env-file .env.all-in-one \
  play:dev
```

Oder per Compose:

```bash
docker compose -f docker-compose.all-in-one.yml up -d --build
```

## Smoke-Test

```bash
curl http://localhost:3000/health          # → "ok"
curl http://localhost:3000/api/health      # → {"ok":true, ...}
curl -I http://localhost:3000/             # → 200 OK + HTML
```

## Logs

```bash
docker logs -f play                        # s6 aggregiert alle Services
docker exec play s6-rc-db list             # listet alle services
docker exec play s6-svstat /run/service/api
```

## Admin anlegen

Beim ersten Aufruf redirected die Middleware nach `/setup` — der
First-Run-Wizard legt Admin, Branding, SMTP und Legal an. Alternativ
registriert sich der erste Nutzer mit der in `INITIAL_ADMIN_EMAIL`
gesetzten Adresse über `/register` und wird automatisch auf Rolle
`ADMIN` elevated (siehe `apps/api/src/auth.ts` → `databaseHooks`).

## Backup

Der Container hat alle Binaries an Bord:

```bash
# Postgres-Dump
docker exec -u postgres play \
  pg_dump -Fc itsweber_play > backup-$(date +%F).dump

# MinIO-Daten direkt aus dem Volume
docker run --rm -v play-data:/data -v "$PWD":/out \
  debian:bookworm-slim \
  tar czf /out/minio-$(date +%F).tar.gz -C /data minio
```

## Reverse-Proxy

Beispiel Nginx (vor dem Container):

```nginx
server_name  play.example.com;
proxy_pass   http://<CONTAINER-HOST>:3000;
client_max_body_size 8g;
# WebSocket + SSE:
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 600s;
```

Traefik / Caddy / Nginx Proxy Manager analog. Wichtig: WebSocket-Upgrade
durchreichen, `client_max_body_size` ≥ `MAX_UPLOAD_SIZE_MB`.

## Troubleshooting

- **Container startet nicht / stirbt sofort:** `docker logs play` —
  meist fehlt eine required env (z. B. `MINIO_ROOT_PASSWORD`).
- **Postgres-Init failed:** Volume zurücksetzen (`docker volume rm play-data`)
  und Container neu starten. Passiert bei Upgrade von PG-Versionen.
- **`/health` antwortet, aber `/` gibt 502:** Web-Service hat noch nicht
  fertig gestartet. 90 s abwarten oder `docker exec ... s6-svstat /run/service/web`.
- **MinIO-Policy-Fehler beim Upload:** API-Service hat beim ersten Call die
  Public-Read-Policy auf die Buckets gesetzt. Einmal Upload-Mutation
  triggern, danach stabil.
