# Session 12 — Startprompt: Vollständiger lokaler E2E-Test

Lies zuerst:
1. `CLAUDE.md` — Projektübersicht
2. `docs/11-progress.md` — aktueller Stand (Sessions 1–11)

## Kontext

Session 11 hat alle Docker-Images gebaut und einen minimalen HTTP-Smoke-Test
bestanden. Vor dem Unraid-Deploy soll jetzt ein vollständiger E2E-Test auf dem
lokalen Windows-PC stattfinden. Ziel: jede kritische Funktion einmal
durchgespielt, keine offensichtlichen Bugs, keine 500er.

## Was in Session 11 geändert wurde (relevant für diesen Test)

- `apps/web/next.config.mjs` — `@play/api` aus `transpilePackages` raus,
  `ignoreBuildErrors: true`
- `docker/web/Dockerfile`, `docker/api/Dockerfile`, `docker/worker/Dockerfile`
  — alle neu, pnpm-Symlink-Strategie geändert
- `.env.example` — vervollständigt
- `config/npm-proxy-host.md` — API-Subdomain + SSE-Header dokumentiert

Der Dev-Stack (`docker-compose.dev.yml`) ist **nicht betroffen** — er nutzt
die Dockerfiles nicht, sondern bindet den Host-Code direkt ein. Der lokale
Test läuft daher normal über `docker compose -f docker-compose.dev.yml up -d`
+ `pnpm dev`.

## Offene Migrations (müssen vor dem Dev-Start applied sein)

Falls die lokale Dev-DB seit Session 8 nicht neu aufgesetzt wurde, fehlen
ggf. diese Migrations:

```
20260417120000_add_static_pages
20260417130000_add_watch_history_later
```

Prüfen und ggf. applyen:

```bash
# DB muss laufen (docker compose -f docker-compose.dev.yml up -d)
cd packages/db
DATABASE_URL=postgresql://play:play-dev@localhost:5432/itsweber_play \
  npx prisma migrate deploy
```

## Session-12-Scope: E2E-Checkliste

### 1. Stack starten + Basis-Health

- [ ] `docker compose -f docker-compose.dev.yml up -d` (Postgres, Redis, MinIO)
- [ ] `pnpm --filter @play/api dev` → läuft auf `:4000`
- [ ] `pnpm --filter @play/worker dev` → läuft
- [ ] `pnpm --filter @play/web dev` → läuft auf `:3000`
- [ ] `GET http://localhost:4000/health` → `{ok: true}`
- [ ] `GET http://localhost:3000/` → HTTP 200, keine Console-Errors

### 2. Auth-Flow

- [ ] `/register` → neuen User anlegen
- [ ] `/login` → einloggen
- [ ] Session-Cookie gesetzt, Header zeigt @handle
- [ ] Logout → Session weg

### 3. Upload + Transcode-Pipeline

- [ ] `/studio/upload` → kleines Test-Video (<10 MB) hochladen
- [ ] Progress-Bar läuft durch, Redirect auf `/watch/<slug>`
- [ ] Status `PROCESSING` → nach Transcode `LIVE`
- [ ] HLS-Player spielt ab (Chrome + Firefox)
- [ ] Thumbnail sichtbar

### 4. Studio

- [ ] `/studio` — Dashboard lädt, Stats-Cards
- [ ] `/studio/videos` — eigenes Video in der Liste
- [ ] `/studio/<id>/edit` — Titel, Tags, Visibility ändern + speichern
- [ ] `/studio/channel` — Channel-Profil editieren
- [ ] `/studio/import` — yt-dlp Import mit kurzer YT-URL testen
  (z. B. `https://www.youtube.com/watch?v=jNQXAC9IVRw`, 19 s)

### 5. Discovery + Navigation

- [ ] `/` — Startseite, Video-Grid lädt
- [ ] `/shorts` — Swipe-Feed (leer oder mit Short-Video OK)
- [ ] `/channels` — Directory
- [ ] `/subs` — Abo-Feed (leer OK)
- [ ] `/library` — 4 Sections sichtbar
- [ ] `/search?q=test` — Suchergebnisse
- [ ] `/category/smart-home` — Kategorie-Seite

### 6. Community-Features

- [ ] `/watch/<slug>` — Like-Button funktioniert
- [ ] Kommentar schreiben + sehen
- [ ] Subscribe-Button auf `/c/<slug>`
- [ ] Watch-History: nach `/watch/` → in `/library` unter „Zuletzt angesehen"
- [ ] Watch-Later: Bookmark-Button → in `/library` unter „Später ansehen"

### 7. Legal-Pages + Footer

- [ ] `/impressum` → HTTP 200, Inhalt sichtbar
- [ ] `/datenschutz` → HTTP 200
- [ ] `/agb` → HTTP 200
- [ ] Footer-Links vorhanden

### 8. Admin-Panel

- [ ] `/admin` — Dashboard mit Stats
- [ ] `/admin/users` — User-Liste
- [ ] `/admin/videos` — alle Videos
- [ ] `/admin/theme` — Theme-Editor lädt
- [ ] `/admin/theme` — Token-Change → Farbe ändert sich im Preview-Iframe
- [ ] `/admin/page-blocks` — Block-Composer
- [ ] `/admin/pages` — Static-Pages-CMS
- [ ] `/admin/categories` — Kategorien
- [ ] `/admin/moderation` — Moderation-Queue

### 9. Theme-SSE (wichtigste Metrik)

- [ ] `/admin/theme` — Token-Wert ändern (z.B. Brand-Farbe)
- [ ] In zweitem Browser-Tab gleichzeitig `/` offen
- [ ] Farbänderung kommt im zweiten Tab **< 1 Sekunde** an (ohne Reload)
- [ ] `curl -N http://localhost:4000/api/theme/events` → SSE-Stream bleibt offen,
  Event kommt nach Token-Change

### 10. Embed + OG

- [ ] `/embed/<slug>` → Player ohne Header/Footer
- [ ] `/watch/<slug>` — im Browser-DevTools: `og:title`, `og:image` im `<head>`
- [ ] `/api/oembed?url=http://localhost:3000/watch/<slug>` → JSON mit `html`-Feld

### 11. Prod-Image Smoke-Test (lokal, Bridge-Network)

Schneller Sanity-Check der Prod-Images bevor Unraid:

```bash
# Prod-Images wurden in Session 11 bereits gebaut.
# Falls nicht mehr vorhanden: docker compose -f docker-compose.yml build
docker images | grep play-
```

- [ ] `play-web:latest`, `play-api:latest`, `play-worker:latest` vorhanden
- [ ] Kurzer Start-Test wie in Session 11 (HTTP 200 auf /, /shorts, /library)

## Bekannte Offene Punkte (kein Blocker, aber zu prüfen)

- `INITIAL_ADMIN_PASSWORD` aus `.env` wird nur beim allerersten Start genutzt
  (wenn DB leer). Falls die Dev-DB von Session 1 noch existiert, ist das
  Passwort schon gesetzt (`play-dev-admin`).
- pnpm-Startweg auf Windows: über
  `node "C:/Program Files/nodejs/node_modules/corepack/dist/pnpm.js"` falls
  `pnpm` nicht im PATH.
- Typecheck (`pnpm typecheck`) sollte nach allen Session-11-Änderungen
  (`next.config.mjs`) weiterhin grün sein — kurz prüfen.

## Dev-Credentials

| E-Mail              | Passwort        | Rolle   |
|---------------------|-----------------|---------|
| admin@itsweber.de   | play-dev-admin  | ADMIN   |
| creator1@test.de    | creator-test-pw | CREATOR |

## Nach Session 12

- `docs/11-progress.md` um Session-12-Ergebnisse erweitern
- Falls Bugs gefunden: fixen, dann weiter
- Startprompt für Unraid-Deploy-Session als `docs/19-session-13-unraid-deploy-startprompt.md`
  erstellen
- Unraid-Deploy-Session: SSH-Zugangsdaten des Users + Domain-Bestätigung
  (`play.itsweber.net` — so sagen alle bestehenden Configs; der Session-11-Prompt
  hatte versehentlich `.de`)

## Technische Regeln

- SVG statt Emoji überall
- Kein GitHub-Commit vor Session 15 (nach 48h Prod-Stabilität)
- Modell-Empfehlung: **Sonnet 4.6**
