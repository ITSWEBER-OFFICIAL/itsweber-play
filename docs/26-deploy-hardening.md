# 26 — Deploy-Hardening

## Überblick

Ursprünglich war `docker-compose.yml` ein STUB: keine Healthchecks, MinIO unpinned, Worker hing auf der API, keine Ressource-Limits, Migration im API-Entrypoint. Der hier beschriebene Pass macht den Stack deploy-ready für einen unbetreuten Unraid-Host.

## Compose-Änderungen

### Healthchecks + Startup-Reihenfolge

Jeder Service hat jetzt einen eigenen Healthcheck:

| Service | Probe | Intervall | Grace |
|---|---|---|---|
| `play-postgres` | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` | 10 s | 30 s |
| `play-redis` | `redis-cli ping \| grep -q PONG` | 10 s | 10 s |
| `play-minio` | `mc ready local` (schipit mit MinIO-Image) | 15 s | 20 s |
| `play-api` | HTTP GET `/health` auf 127.0.0.1:4000 | 20 s | 30 s |
| `play-web` | HTTP GET `/` auf 127.0.0.1:3000 | 30 s | 45 s |

`depends_on` nutzt überall `condition: service_healthy` (oder `service_completed_successfully` für den Migrate-Step). Damit startet `play-api` garantiert erst, wenn Postgres/Redis/MinIO wirklich Requests annehmen.

### Neuer One-Shot `play-migrate`

Statt die Migration in den API-Entrypoint zu hängen (die fuhr beim zweiten Boot manchmal zweifach), läuft Prisma jetzt als separater One-Shot:

```yaml
play-migrate:
  restart: "no"
  command: pnpm --filter @play/db exec prisma migrate deploy --schema prisma/schema.prisma
  depends_on:
    play-postgres:
      condition: service_healthy
```

`play-api` und `play-worker` warten via `service_completed_successfully` auf diesen Service. Ein Migrations-Fehler verhindert damit, dass API/Worker mit falschem Schema booten.

### MinIO gepinnt

`minio/minio:latest` ist raus — jetzt `minio/minio:RELEASE.2026-01-07T22-48-43Z`. Bei Release-Upgrade gezielt im Compose hochziehen, nicht per stale Tag einfangen.

### Worker-depends gefixt

Worker hing fälschlich auf `play-api`. Korrekt: nur Redis (BullMQ-Queue) + Postgres (Job-Finalize schreibt Video-Row) + MinIO (Raw-Download/HLS-Upload).

### Resource-Limits

Als Default-Annahme für Unraid mit 8-16 Cores / 32+ GB RAM:

| Service | CPU-Limit | Memory-Limit |
|---|---|---|
| `play-worker` | 4.0 | 6 G |
| `play-api` | 2.0 | 2 G |
| `play-web` | 2.0 | 1 G |
| `play-postgres` | 2.0 | 2 G |
| `play-minio` | 1.0 | 1 G |
| `play-redis` | 0.5 | 512 M |

Worker bekommt den Löwenanteil — Transcode + Import sind die einzigen echten CPU-Verbraucher. Override via `docker-compose.override.yml`, falls der Host anders dimensioniert ist.

### init: true auf Worker

`init: true` setzt einen `tini`-ähnlichen PID-1-Reaper. Ohne das bleiben bei `docker rm play-worker` FFmpeg-Kinder als Zombies zurück, besonders wenn ein Transcode-Job mitten im Lauf unterbrochen wird.

### Logging-Driver

Einheitlich `json-file` mit `max-size: 10m` + `max-file: 3` — deckelt den Plattenverbrauch pro Container auf ~30 MB. Ohne das explodieren die Logs (v. a. Worker) nach Monaten.

### Strict-Env-Gates

Alle kritischen Env-Vars (`POSTGRES_*`, `MINIO_ROOT_*`, `NEXT_PUBLIC_*`) sind jetzt via `${VAR:?message}` markiert — Compose bricht früh mit klarer Fehlermeldung ab, wenn `.env` unvollständig ist. Kein Silent-Fallback auf `http://localhost:…` mehr, der in Prod-Bundles eingefroren wäre.

## Fastify-Härtung

- `trustProxy: true` — `X-Forwarded-For` wird von NPM durchgereicht, `request.ip` spiegelt echte Client-IP (wichtig für Rate-Limit).
- `@fastify/helmet` mit restriktiver CSP (`default-src 'self'`, MinIO-Origin als einzige Image/Media-Allow-List).
- `@fastify/rate-limit` (Redis-backed) — `/api/auth/*` 20/min, `/api/upload` 10/min.
- `@fastify/sensible` für standardisierte HTTP-Error-Helper (`app.httpErrors.badRequest(...)` etc.).

## Magic-Bytes-Check

Alle Upload-Handler (`upload.ts`, `logo-upload.ts`, `channel-assets-upload.ts`, `video-assets-upload.ts`) prüfen jetzt via `file-type` die echten Magic-Bytes. `Content-Type`-Header allein wird nicht mehr getraut. Details in [27-security-baseline.md](27-security-baseline.md).

## AV1/VP9-Profil

`TRANSCODE_EXTRA_CODECS=av1,vp9` aktiviert zusätzliche HLS-Varianten pro Auflösung. Default leer (CPU-Kosten). Master-Playlist bekommt `CODECS`-Attribute, moderne Player wählen automatisch.

## Subscription-Composite-Indizes

Migration `20260419000000_add_subscription_composite_index` fügt zwei Indizes hinzu:

- `(channelId, notify)` — deckt den Notification-Lookup beim Transcode-Finalize ab
- `(subscriberId, createdAt)` — deckt den `/subs`-Feed ab (neueste Abos zuerst)

Der bestehende PK `(subscriberId, channelId)` bleibt bestehen.

## Troubleshooting

| Symptom | Prüfung |
|---|---|
| `play-migrate` endet mit Exit 1 | `docker compose logs play-migrate` — Prisma zeigt die problematische Migration mit SQL-Statement |
| Keine Container starten | `docker compose config` zeigt Env-Var-Fehler (die `:?`-Gates melden, was fehlt) |
| `play-api` bootet, aber `/health` antwortet nicht | Healthcheck wartet 30 s — im Zweifel `docker compose logs play-api` prüfen, ob der `tsx`-Start hängt |
| Worker-Container OOM (gekillt) | Memory-Limit zu tief. Override via `docker-compose.override.yml` ändern (z. B. 8 G) |
| Upload-502 auf NPM | `client_max_body_size 8g` in der Advanced-Config des Reverse-Proxy setzen (NPM-UI → Advanced → „Custom Nginx Configuration") |
| MinIO-Healthcheck rot | `docker compose exec play-minio mc ready local` — zeigt, ob Disk oder Quorum wackelt |

## CDN-Ready-Hinweis

MinIO liefert Signed-URLs mit Default-TTL 7 Tagen (MinIO-Default). Für CDN-Caching über Cloudflare o. ä. die Presigned-TTL **auf 30 Tage erhöhen** (oder Public-Read-Policy auf `play-videos`/`play-thumbs`/`play-assets` legen) und Cache-Key auf `Host + Path + Signed-Args` setzen. Cloudflare-Cache-Level: "Cache Everything" für `/play-videos/*` und `/play-thumbs/*`. Original-Bucket `play-raw` bleibt privat — dort fließt keine Public-Request-Latenz rein.
