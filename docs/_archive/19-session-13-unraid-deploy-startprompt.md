# Session 13 — Startprompt: Unraid-Deploy

Lies zuerst:
1. `CLAUDE.md` — Projektübersicht
2. `docs/11-progress.md` — aktueller Stand (Sessions 1–12)

## Kontext

Session 12 hat alle 11 E2E-Punkte auf dem lokalen Windows-PC grün bestanden.
Kein einziger Bug. Prod-Images (`play-api`, `play-web`, `play-worker`) sind
aus Session 11 fertig gebaut und smoke-getestet. Der nächste Schritt ist der
echte Unraid-Deploy auf **ITSWEBER-CORE** (`192.168.0.10`).

## Ziel dieser Session

Vollständiger Produktions-Deploy auf Unraid 7.2.0. Am Ende soll
`https://play.itsweber.net` von einem Browser im LAN erreichbar sein und der
komplette Upload→Transcode→Watch-Flow einmalig End-to-End auf echter Hardware
laufen.

## Infrastruktur

- **Unraid-Host:** `192.168.0.10` (ITSWEBER-CORE, Unraid 7.2.0)
- **Docker-VLAN:** `br1` / `10.10.8.0/24`
- **Reservierte IPs:**
  - `10.10.8.50` — play-web (Next.js)
  - `10.10.8.51` — play-api (Fastify)
  - `10.10.8.52` — play-postgres
  - `10.10.8.53` — play-redis
  - `10.10.8.54` — play-minio
  - `10.10.8.55` — play-worker
- **NPM (Nginx Proxy Manager):** `192.168.0.2`
  - Docs zur NPM-Konfiguration: `config/npm-proxy-host.md`
- **Domain:** `play.itsweber.net` (LAN-intern, kein öffentliches Cert nötig)
- **Authentik** (`10.10.8.13`): gestoppt, OIDC-Login kommt post-MVP

## Vor dem Start: User muss bereitstellen

1. **SSH-Zugangsdaten** für ITSWEBER-CORE (User + Key oder Passwort)
2. **Bestätigung**: Ist `br1` macvlan auf Unraid bereits konfiguriert?
   (sollte laut Serverdoku vorhanden sein — kurz prüfen)
3. **`.env.prod` CHANGE-ME-Werte** ausfüllen (DB-Passwort, MinIO-Passwort,
   Admin-Passwort). Die Datei liegt unter `c:/Users/itswe/Documents/ITSWEBER/Projekte/ITSWEBER Play Docker/.env.prod`.
   Offene Felder:
   - `INITIAL_ADMIN_PASSWORD=CHANGE-ME-STRONG-PASSWORD`
   - `POSTGRES_PASSWORD=CHANGE-ME-DB-PASSWORD`
   - `DATABASE_URL=postgresql://play:CHANGE-ME-DB-PASSWORD@...`
   - `MINIO_ROOT_PASSWORD=CHANGE-ME-MINIO-PASSWORD`
   - `S3_SECRET_KEY=CHANGE-ME-MINIO-PASSWORD`

## Deploy-Plan

### Schritt 1 — Images auf Unraid übertragen

Option A (docker save/load via SSH — kein Registry nötig):
```bash
# Auf Windows-PC (Git Bash / PowerShell):
docker save play-api:latest play-web:latest play-worker:latest \
  | gzip | ssh root@192.168.0.10 'gunzip | docker load'
```

Option B (falls Netz zu langsam): Images auf USB-Stick, dann auf Unraid laden.

### Schritt 2 — Appdata-Verzeichnis vorbereiten

```bash
ssh root@192.168.0.10
mkdir -p /mnt/user/appdata/itsweber-play/{postgres,redis,minio}
```

### Schritt 3 — `.env` auf Unraid ablegen

```bash
# Vom Windows-PC:
scp .env.prod root@192.168.0.10:/mnt/user/appdata/itsweber-play/.env
```

### Schritt 4 — `docker-compose.yml` auf Unraid

```bash
scp docker-compose.yml root@192.168.0.10:/mnt/user/appdata/itsweber-play/
```

### Schritt 5 — Stack starten

```bash
ssh root@192.168.0.10
cd /mnt/user/appdata/itsweber-play
docker compose up -d play-postgres play-redis play-minio
# Kurz warten bis DB bereit
sleep 10
docker compose up -d play-api
# Migrations + Seed
docker exec play-api npx prisma migrate deploy
docker exec play-api npx tsx packages/db/src/seed.ts
docker compose up -d play-web play-worker
```

### Schritt 6 — NPM-Proxy konfigurieren

Laut `config/npm-proxy-host.md`:

- `play.itsweber.net` → `http://10.10.8.50:3000`
- `api.play.itsweber.net` → `http://10.10.8.51:4000`
  - SSE: `Connection: ''` + `chunked_transfer_encoding: on`

### Schritt 7 — Smoke-Test auf Unraid

```bash
curl https://play.itsweber.net/
curl https://api.play.itsweber.net/health
```

Dann im Browser:
- `https://play.itsweber.net/` → Startseite
- Admin-Login mit den Prod-Credentials
- Ein Video hochladen → Transcode → Watch

## Bekannte Stolpersteine

- **macvlan + Docker-Host:** Container auf macvlan können den Unraid-Host
  nicht direkt via Host-IP erreichen. Falls API→MinIO via `10.10.8.54`
  konfiguriert ist, muss MinIO auf dieser IP lauschen (nicht über localhost).
- **Prisma OpenSSL:** In `node:22-slim` muss `openssl libssl-dev` installiert
  sein — ist in Session-11-Dockerfiles bereits drin.
- **yt-dlp Static Binary:** Im Worker-Image via `RUN curl -L ... -o /usr/local/bin/yt-dlp`.
  Nach Erststart prüfen: `docker exec play-worker yt-dlp --version`.
- **NEXT_PUBLIC_*-Vars:** Diese Vars werden zur Build-Zeit eingebacken.
  Die Images aus Session 11 haben `NEXT_PUBLIC_API_URL=http://localhost:4001`
  (vom lokalen Smoke-Test). **Für Unraid müssen die Images neu gebaut werden**
  mit den korrekten Prod-URLs:
  - `NEXT_PUBLIC_API_URL=https://api.play.itsweber.net`
  - `NEXT_PUBLIC_SITE_URL=https://play.itsweber.net`
  - `NEXT_PUBLIC_S3_PUBLIC_URL=http://10.10.8.54:9000`

  Rebuild auf dem Windows-PC:
  ```bash
  docker compose -f docker-compose.yml build play-web
  ```
  Dann erneut übertragen.

## Technische Regeln

- Domain: `play.itsweber.net` (nicht `.de`)
- SVG statt Emoji überall
- Kein GitHub-Commit vor Session 15 (nach 48h Prod-Stabilität)
- Modell-Empfehlung: **Sonnet 4.6**
