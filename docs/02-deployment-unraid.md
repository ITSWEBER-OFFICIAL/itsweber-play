# 02 — Deployment (All-in-One)

**Ziel:** All-in-One-Container auf einem beliebigen Docker-Host
(Unraid, Synology, Linux-VM, bare metal). Ein einzelner Container
bündelt Postgres 16, Redis 7, MinIO, Nginx, Next.js Web, Fastify API,
BullMQ Worker, FFmpeg, yt-dlp und whisper-cli unter s6-overlay.

Einziger exponierter Port: **3000**. Nginx multiplext intern.

## 1. Image beziehen

Empfohlen: offizielles Image aus der GitHub Container Registry:

```bash
docker pull ghcr.io/itsweber-official/itsweber-play:main
```

Alternativ selbst bauen:

```bash
docker build -t play:local -f docker/all-in-one/Dockerfile .
```

Für Luft-gapped Hosts: Image lokal bauen → `docker save | gzip | ssh HOST 'docker load'`.

> **Wichtig beim Transfer:** `gzip` muss auf der Source-Seite laufen.
> `ssh remote 'gunzip | docker load'` ist kaputt — gunzip konsumiert
> stdin, docker load bekommt nichts.

## 2. AppData + Secrets anlegen

Auf dem Ziel-Host:

```bash
# Beispiel-Pfad für Unraid — für andere Hosts beliebigen Pfad wählen
APPDATA=/mnt/user/appdata/play-data

mkdir -p "$APPDATA/data"

cat > "$APPDATA/.env.production" <<EOF
NODE_ENV=production
PUBLIC_URL=https://play.example.com
AUTH_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=$(openssl rand -hex 24)
INITIAL_ADMIN_EMAIL=admin@example.com
NEXT_PUBLIC_S3_PUBLIC_URL=/s3
S3_PUBLIC_URL=/s3
EOF

chmod 600 "$APPDATA/.env.production"
```

Siehe `.env.production.example` für alle verfügbaren Variablen.

## 3. Container starten

```bash
docker run -d \
  --name play \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file "$APPDATA/.env.production" \
  -v "$APPDATA/data":/data \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  ghcr.io/itsweber-official/itsweber-play:main
```

Auf einem Host mit eigenem Container-VLAN (z. B. macvlan) kann statt
`-p 3000:3000` eine dedizierte Container-IP verwendet werden
(`--network <macvlan-net> --ip <IP>`).

## 4. Smoke-Test

```bash
curl http://localhost:3000/health       # → "ok"
docker logs -f play
docker exec play s6-rc -a list           # alle s6-Services laufen?
```

## 5. Reverse-Proxy einrichten

Vor die Plattform gehört ein Reverse-Proxy (Nginx, Nginx Proxy Manager,
Traefik, Caddy), der TLS terminiert und zu `<host>:3000` weiterleitet.

Wichtig:

- TLS (Let's Encrypt)
- WebSocket-Upgrade durchreichen
- `client_max_body_size` ≥ `MAX_UPLOAD_SIZE_MB` (Default 8 GB)
- Nur einen einzigen Host — das interne Nginx routet alles weiter:

| Externer Pfad | Intern |
|---|---|
| `/` | Next.js :3001 |
| `/api/trpc/*` | Fastify :4000/trpc/ (Prefix-Strip) |
| `/api/*` | Fastify :4000 (kein Strip) |
| `/s3/*` | MinIO :9000 (Prefix-Strip) |
| `/health` | 200 OK (Healthcheck) |

Beispiel-Konfigurationen siehe `docs/reverse-proxy.md` (TBD).

## 6. Erstes Sign-Up (Admin anlegen)

Beim ersten Aufruf redirected die Middleware nach `/setup`
(First-Run-Wizard). Dort wird der Admin-Account mit der in
`INITIAL_ADMIN_EMAIL` gesetzten Adresse angelegt, Branding und Theme
konfiguriert. Danach ist die Plattform scharf.

Alternativ — wenn der Wizard übersprungen werden soll — kann der erste
Sign-Up-Flow direkt auf `/register` verwendet werden. Der Better-Auth-
Hook (`apps/api/src/auth.ts` → `databaseHooks.user.create.after`) setzt
den User mit `INITIAL_ADMIN_EMAIL` automatisch auf Rolle `ADMIN`.

> **Einmalig!** Das Passwort wird beim Sign-Up gehasht und ist nur noch
> per Reset-Flow änderbar. Keinen Dummy-Account anlegen.

## 7. Backup aktivieren

```bash
scp scripts/backup-all-in-one.sh <HOST>:"$APPDATA/backup.sh"
ssh <HOST> "chmod +x '$APPDATA/backup.sh'"
ssh <HOST> "(crontab -l 2>/dev/null; echo '0 3 * * * $APPDATA/backup.sh') | crontab -"
```

Retention: 30 Tage (konfigurierbar via `RETENTION_DAYS`).

## Troubleshooting

| Symptom | Prüfung |
|---|---|
| Container startet nicht | `docker logs play` — s6-Init-Fehler? |
| Postgres startet nicht | `docker exec play cat /tmp/postgres-init.log` |
| Migrations schlagen fehl | `docker exec play cat /data/logs/migrate.log` |
| 502 vom Reverse-Proxy | Erreicht der Proxy tatsächlich `<host>:3000`? |
| Upload bricht ab | `client_max_body_size` hoch genug? |
| Videos bleiben in `processing` | `docker logs play \| grep worker` — FFmpeg-Fehler? |

## Bekannte Fallstricke

- **Macvlan**: Container-IP vom Docker-Host selbst nicht pingbar
  (normales macvlan-Verhalten). Ein Proxy auf anderer IP erreicht den
  Container problemlos.
- **Postgres Unix-Socket-Bootstrap**: Init läuft über `-h /tmp`
  (auth-local=trust), nicht TCP. Wichtig für idempotenten Re-Run
  (Marker `.play-bootstrap-done`).
- **Prisma binaryTargets**: Schema muss
  `["native", "debian-openssl-3.0.x"]` enthalten, sonst crasht der
  Container mit `PrismaClientInitializationError`.
