# 02 — Deployment auf Unraid (All-in-One)

**Zielhost:** `ITSWEBER-CORE` (Unraid 7.2.0, `192.168.0.10`)
**Docker-Netzwerk:** `br1` (macvlan, `10.10.8.0/24`)
**Container-IP:** `10.10.8.51` (reserviert für Play)
**Domain Dev:** `play-next.itsweber.net` → DNS-Cutover später auf `play.itsweber.net`

> **All-in-One-Architektur:** Ein einzelner Container bündelt Postgres 16, Redis 7,
> MinIO, Nginx, Next.js Web, Fastify API, BullMQ Worker, FFmpeg, yt-dlp und whisper-cli
> unter s6-overlay. Einziger exponierter Port: **3000**. Nginx multiplext intern.

## 1. Image auf Unraid übertragen

```bash
# Auf Dev-Rechner (Windows):
docker save itsweber-play:all-in-one | gzip -1 | ssh root@ITSWEBER-CORE 'docker load'
```

> **Wichtig:** `gzip` muss auf der Source-Seite laufen. `ssh remote 'gunzip | docker load'`
> ist kaputt — gunzip konsumiert stdin, docker load bekommt nichts.

## 2. AppData + Secrets anlegen

```bash
ssh root@ITSWEBER-CORE
mkdir -p /mnt/user/appdata/itsweber-play-data/data

# Secrets generieren
cat > /mnt/user/appdata/itsweber-play-data/.env.production << EOF
NODE_ENV=production
PUBLIC_URL=https://play-next.itsweber.net
AUTH_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=$(openssl rand -hex 24)
INITIAL_ADMIN_EMAIL=info@itsweber.de
NEXT_PUBLIC_S3_PUBLIC_URL=/s3
S3_PUBLIC_URL=/s3
EOF
chmod 600 /mnt/user/appdata/itsweber-play-data/.env.production
```

## 3. Container starten

```bash
docker run -d \
  --name itsweber-play \
  --network br1 --ip 10.10.8.51 \
  --hostname itsweber-play \
  --restart unless-stopped \
  --env-file /mnt/user/appdata/itsweber-play-data/.env.production \
  -v /mnt/user/appdata/itsweber-play-data/data:/data \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  itsweber-play:all-in-one
```

**Oder:** Unraid Docker-UI → das Template `my-ITSWEBER-Play.xml` unter
`/boot/config/plugins/dockerMan/templates-user/` erscheint automatisch in
"Add Container" → "User Templates". Dort IP und PUBLIC_URL prüfen, dann starten.

## 4. Smoke-Test

```bash
# Health (Nginx antwortet direkt)
curl http://10.10.8.51:3000/health    # → "ok"

# Logs beobachten
docker logs -f itsweber-play

# Alle s6-Services laufen?
docker exec itsweber-play s6-rc -a list
```

## 5. NPM Proxy Host einrichten

**Genau ein Host** nötig (Details in `config/npm-proxy-host.md`):

- Domain: `play-next.itsweber.net`
- Forward: `10.10.8.51:3000`
- Force SSL + WebSocket + `client_max_body_size 8g`

Der Container-Nginx übernimmt das komplette Routing intern:

| Externer Pfad | Intern |
|---|---|
| `/` | Next.js :3001 |
| `/api/trpc/*` | Fastify :4000/trpc/ (Prefix-Strip) |
| `/api/*` | Fastify :4000 (kein Strip) |
| `/s3/*` | MinIO :9000 (Prefix-Strip) |
| `/health` | 200 OK (Healthcheck) |

## 6. Erstes Sign-Up (Admin anlegen)

1. `https://play-next.itsweber.net/register` aufrufen
2. Mit `INITIAL_ADMIN_EMAIL` (`info@itsweber.de`) + **echtem** Wunsch-Passwort registrieren
3. Better-Auth-Hook (`apps/api/src/auth.ts` → `databaseHooks.user.create.after`)
   setzt automatisch Rolle `ADMIN`

> **Einmalig!** Das Passwort wird beim Sign-Up gehasht und ist nur noch per
> Reset-Flow änderbar. Keinen Dummy-Account anlegen.

## 7. Backup aktivieren

```bash
# Backup-Skript auf Unraid deployen
scp scripts/backup-all-in-one.sh root@ITSWEBER-CORE:/mnt/user/appdata/itsweber-play-data/backup.sh
ssh root@ITSWEBER-CORE "chmod +x /mnt/user/appdata/itsweber-play-data/backup.sh"

# Cronjob (täglich 03:00)
ssh root@ITSWEBER-CORE "(crontab -l 2>/dev/null; echo '0 3 * * * /mnt/user/appdata/itsweber-play-data/backup.sh') | crontab -"
```

Backup landet unter `/mnt/user/Backup/itsweber-play/YYYY-MM-DD_HHMM/`.
Retention: 30 Tage (konfigurierbar via `RETENTION_DAYS`).

## 8. DNS-Cutover (später)

Wenn stabil auf `play-next.itsweber.net`:

1. DNS TTL für `play.itsweber.net` auf 60s senken (24h vorher)
2. NPM-Host `play.itsweber.net` von MediaCMS (`192.168.0.10:8200`) auf `10.10.8.51:3000` umstellen
3. MediaCMS-Container weiter laufen lassen (read-only) bis Content migriert

Rollback: NPM-Host zurückstellen → sofort aktiv.

## Troubleshooting

| Symptom | Prüfung |
|---|---|
| Container startet nicht | `docker logs itsweber-play` — s6-Init-Fehler? |
| Postgres startet nicht | `docker exec itsweber-play cat /tmp/postgres-init.log` |
| Migrations schlagen fehl | `docker exec itsweber-play cat /data/logs/migrate.log` |
| 502 von NPM | macvlan-Routing: NPM (192.168.0.2) erreicht br1 per L3, sollte klappen |
| Upload bricht ab | `client_max_body_size 8g` in NPM-Custom-Config gesetzt? |
| Videos bleiben in `processing` | `docker logs itsweber-play \| grep worker` — FFmpeg-Fehler? |

## Bekannte Fallstricke

- **Macvlan**: Container-IP vom Unraid-Host selbst nicht pingbar (normales Macvlan-Verhalten).
  NPM auf anderer IP erreicht den Container problemlos.
- **Postgres Unix-Socket-Bootstrap**: Init läuft über `-h /tmp` (auth-local=trust),
  nicht TCP. Wichtig für idempotenten Re-Run (Marker `.play-bootstrap-done`).
- **Prisma binaryTargets**: Schema muss `["native", "debian-openssl-3.0.x"]` enthalten,
  sonst crasht der Container mit `PrismaClientInitializationError`.
- **IP-Belegung br1** (Stand 2026-04-19): .50=JDownloader, .51=Play✓, .52=frei,
  .53–.55=belegt, .56+=frei.
