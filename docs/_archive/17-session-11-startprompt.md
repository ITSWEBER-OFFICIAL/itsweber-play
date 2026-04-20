# Session 11 — Startprompt: Prod-Deploy auf Unraid

Wir deployen ITSWEBER Play auf den echten Host. Lies zuerst in dieser Reihenfolge:

1. `CLAUDE.md` — Projektübersicht + Konventionen
2. `docs/11-progress.md` — aktueller Stand bis Session 10 (Shorts + History)
3. `docs/13-gap-analysis-and-extended-plan.md` — Roadmap + Gate-Kriterien

## Stand vor Session 11

**v0.1 + v0.2 + Sessions 8–10 sind DONE.**

Kurzform Session 10:

- `WatchHistory` + `WatchLater` Schema (Composite-PK, Cascade-Delete, Indizes).
- Migration `20260417130000_add_watch_history_later` — **noch nicht deployed**.
- tRPC `history`: `add` / `list` / `clear` (alle protected).
- tRPC `watchLater`: `toggle` / `isSaved` / `list` (alle protected).
- `HlsPlayer` um Props `loop`, `autoPlay`, `muted` erweitert.
- `/shorts` — vollständiger vertikaler Swipe-Feed (scroll-snap, Autoplay,
  Keyboard ↑/↓, Lazy-Load nächste 3, Like/Mute/Kommentar-Overlay rechts,
  Bottom-Overlay Titel + Kanal).
- Watch-Client: `history.add` bei jedem LIVE-Watch (eingeloggt, dedupliziert per sessionStorage).
- `WatchLaterButton` in `VideoActions` (Bookmark-Icon, Toggle, Toast).
- `/library` — 4 Sections: Verlauf + Später ansehen + Abo-Feed + Eigene Uploads.
- Neue Icons: `volume-x`, `volume-2`, `bookmark`, `bookmark-filled`, `chevron-up`.

## Offene Pending-Migrationen (Session 9 + 10)

Beide müssen auf Prod laufen **bevor** der Stack startet:

```bash
# Im Container oder mit DB-URL gegen Prod-Postgres
cd packages/db
DATABASE_URL=postgresql://play:<pw>@<host>:5432/itsweber_play \
  npx prisma migrate deploy
```

Migrations-Queue:
- `20260417120000_add_static_pages` (Session 9)
- `20260417130000_add_watch_history_later` (Session 10)

Seed (nur beim Erststart):
```bash
DATABASE_URL=... npx tsx src/seed.ts
```

## Session 11 — Scope: Prod-Deploy auf Unraid

**Das ist der Launch-Blocker für den internen Betrieb.**

### Muss in dieser Session

1. **Docker-Images lokal bauen + smoke-testen:**
   - `docker compose -f docker-compose.yml build` (Prod-Compose)
   - Alle 3 Images: `play-web`, `play-api`, `play-worker`
   - Bekannte Arch-Quirks: `@ffmpeg-installer` im Worker-Image — auf
     `docker/worker/Dockerfile` prüfen ob der portable Binary korrekt gesetzt ist.
   - `.env`-Vorlage aus `.env.example` für Prod-Werte ausfüllen.

2. **NPM-Proxy-Dokumentation (`config/npm-proxy-host.md`):**
   - Host: `192.168.0.2`
   - Registry-URL, Auth-Methode, wie pnpm darauf zeigt.
   - Für den Build auf Unraid braucht der Docker-Daemon Zugriff.

3. **Unraid-Deploy:**
   - Images via `docker save | ssh unraid docker load` oder lokale Registry.
   - `docker compose -f docker-compose.yml up -d` auf ITSWEBER-CORE.
   - Prod-Env: `S3_PUBLIC_URL`, `REDIS_HOST`, `DATABASE_URL`, `API_URL`,
     `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_SECRET`.
   - MinIO: Bucket-Bootstrap via `@play/storage bootstrap.ts`.
   - Prisma migrate deploy (beide ausstehenden Migrations).
   - Seed (falls Fresh-Install).

4. **Smoke-Tests auf Prod:**
   - `GET /api/health` → `{ok: true}`
   - Startseite + Login + Upload (kleines Test-Video).
   - `/impressum`, `/datenschutz`, `/agb` → HTTP 200 mit Content.
   - `/shorts` → Feed lädt (leer OK, kein 500).
   - `/library` → nach Login, History-Section sichtbar.
   - Theme-Editor → Token-Change propagiert per SSE < 1 s.

5. **Reverse-Proxy via NPM (192.168.0.2):**
   - Host `play.itsweber.de` → `10.10.8.50:3000` (Web).
   - Host `api.play.itsweber.de` → `10.10.8.50:4000` (API) — oder API intern
     hinter Web-Proxy (je nach bisheriger NPM-Konfiguration).
   - SSL via Let's Encrypt in NPM.

### Muss NICHT in dieser Session

- GitHub-Push (Session 13 — nach 48h Prod-Stabilität).
- Unraid Community Store (Session 15).
- E-Mail / SMTP (war ursprünglich in einer früheren Session — falls noch
  ausstehend, klären ob Launch-Blocker).

## Technische Regeln

- SVG statt Emoji überall.
- Prisma-Migration-Flow: `migrate dev --create-only --name <x>` dann
  `migrate deploy`. Kein interaktiver Wizard in TTY-losen Shells.
- Keine GitHub-Commits vor Session 13.
- Modell-Empfehlung: **Sonnet 4.6**.

## Dev-Setup-Reminder

- Admin-Login: `admin@itsweber.de` / `play-dev-admin`
- Docker-Dev: `docker compose -f docker-compose.dev.yml up -d`
- Unraid-Host: `192.168.0.10` (ITSWEBER-CORE, Unraid 7.2.0)
- Docker-VLAN: `br1` / `10.10.8.0/24`, reserviert: `10.10.8.50–55`
- NPM-Proxy: `192.168.0.2`
- Serverdoku: `c:\Users\itswe\Documents\ITSWEBER\Projekte\Infrastruktur\ITSWEBER-CORE_Serverdoku.md`

## Nach Session 11

- `docs/11-progress.md` um Session 11 erweitern.
- 48h Monitoring vor Session 13 (Git-Setup).
- Session 12 (ursprünglich geplant als weiterer Feature-Block) ist durch die
  Verschiebungen optional — prüfen ob noch Scope offen ist.
- Startprompt Session 13 als `docs/18-session-13-startprompt.md` erstellen.
