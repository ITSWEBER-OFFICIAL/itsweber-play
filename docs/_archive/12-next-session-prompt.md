# 12 — Prompt für die nächste Session (Theme-Editor Ebene 3+)

> Copy-paste diesen Block als erste Nachricht in die neue Claude-Code-Session.
> Datum bei Wiederaufnahme: nach 2026-04-17.

---

Wir bauen ITSWEBER Play weiter. Lies zuerst diese drei Docs (in dieser Reihenfolge):

1. [CLAUDE.md](CLAUDE.md) — Projektübersicht + Konventionen
2. [docs/11-progress.md](docs/11-progress.md) — genauer Stand am Ende der letzten Session, welche 7 Packages typechecken, Dev-User-Credentials, Service-Topologie, Windows-Stolpersteine
3. [docs/03-theming.md](docs/03-theming.md) — die Ziel-Architektur des Theme-Systems (6 Ebenen)

**Das ist das Kern-Differenzierungsmerkmal der Plattform.** Die Plattform muss optisch **extrem anpassbar** sein, ohne dass man Redeploys braucht. Genau das fehlt in PeerTube/MediaCMS und ist der Hauptgrund für die Greenfield-Neuentwicklung.

## Aktueller Stand der Theming-Ebenen

- **Ebene 1 (Primitive Tokens)** ✅ fertig — `packages/theme/tokens.json` → auto-generierte `primitives.css` mit `@theme { … }`-Block für Tailwind v4
- **Ebene 2 (Semantic Tokens)** ✅ fertig — `packages/theme/styles/semantic.css` mit `--color-background`, `--color-brand`, `--color-foreground` etc.
- **Ebene 3 (Admin Live-Editor, DB-persistiert)** ⛔ dies ist der Auftrag
- **Ebene 4 (Preset-Switch)** ⛔ mit Ebene 3 gekoppelt
- **Ebene 5 (Custom-CSS-Sandbox)** ⛔
- **Ebene 6 (Layout-Block-Editor für Startseite)** ⛔ später

## Was diese Session bauen soll

### Backend

1. Prisma: neue Tabelle `ThemeSettings` — eine Row (Singleton), Spalten:
   - `id` (const "singleton"), `tokensOverride JSONB`, `customCss TEXT?`, `logoFilter TEXT?`, `activePreset TEXT?`, `updatedAt`, `updatedBy`
   - Zusätzliche Tabelle `ThemeRevision` (History für Custom-CSS-Rollback, letzte 20)
   - Migration via `migrate dev --create-only` + `migrate deploy` (TTY-loses Setup — siehe `docs/11-progress.md`).

2. tRPC-Router `theme`:
   - `get` (public): aktuelle Override-Map + customCss → wird von `apps/web` beim SSR eingelesen
   - `update` (admin): patched `tokensOverride` partial-merge
   - `applyPreset` (admin): setzt `activePreset` + kopiert die JSON-Datei aus `packages/theme/presets/<name>.json`
   - `setCustomCss` (admin): CSS-Parser-Validierung (kein `@import`, kein `url(javascript:…)`, kein `expression()`), schreibt Revision-Row
   - `listRevisions` (admin) + `rollback` (admin)
   - `exportJson` / `importJson` (admin)

3. Preset-Dateien in `packages/theme/presets/`:
   - `itsweber-dark.json` (Default)
   - `itsweber-light.json`
   - `high-contrast.json`
   - `retro.json`

4. WebSocket oder Server-Sent-Events für Live-Update — Admin speichert → andere offene Tabs bekommen Event → `<style id="theme-vars">` wird getauscht ohne Reload. Fastify hat `@fastify/websocket`. Simpler Start: **SSE-Stream** `/api/theme/events`, Subscription im Admin-Editor. Redis-Pub/Sub als Bus (bereits da).

### Frontend

5. SSR-Einbinden der Overrides: `apps/web/src/app/layout.tsx` rendert einen `<style id="theme-vars">`-Tag aus dem server-fetched `theme.get`-Result (via server-side Fetch direkt an die API, nicht über den tRPC-Client). Reihenfolge im DOM muss sein: `theme-tokens-default` → `theme-vars` → `theme-custom` (siehe `docs/03-theming.md`, Abschnitt „Ebene-Reihenfolge im DOM").

6. `/admin/theme` — das eigentliche Editor-Interface:
   - **Linke Spalte**: Accordion mit Token-Gruppen (Farben/Typo/Radien/Schatten/Logo-Filter), Colorpicker + Slider
   - **Mitte**: `<iframe src="/">` mit `postMessage`-Bridge für Live-Preview (oder einfacher: ganze Seite nutzt dieselben CSS-Variablen, Preview passiert in-place auf einer Mini-Version rechts)
   - **Rechte Spalte**: Preset-Selector, Export-/Import-JSON, Custom-CSS-Textarea mit Live-Validierung, Reset-Button

7. SSE-Client: `apps/web/src/lib/theme-sync.ts` — subscriben, bei Event neuen `<style>` injecten.

### Tests

8. Live-Verifikation: im Admin einen Token ändern → Ziel-Tab spiegelt die Änderung in < 1 s (MVP-Erfolgsmetrik aus `docs/00-overview.md`). Preset-Switch lädt das komplette Set atomar.

## Randbedingungen

- **Nicht** vergessen: Dev-Stack mit drei `pnpm --filter @play/X dev` zum Start hochziehen, Docker-Compose für Postgres/Redis/MinIO läuft weiter von der letzten Session. Vor `pnpm install` die Node-Prozesse killen (Prisma-DLL-Lock, siehe `docs/11-progress.md`).
- **Admin-Login:** `admin@itsweber.de` / `play-dev-admin` (in `.env` als `INITIAL_ADMIN_PASSWORD`, bei Sign-up-Hook auf role=ADMIN gehoben).
- **Prisma-Migration** ohne TTY → `migrate dev --create-only --name add-theme-settings` + `migrate deploy`.
- **tRPC-Hotpath** für `theme.get` muss ohne Auth-Round-Trip auskommen (public procedure) — sonst wird der First-Paint teuer.
- **Keine ActivityPub**, **keine hardcoded Colors in Components** (alles über Tokens — das ist gerade der Zweck der Ebene 3).

Der User ist Architekt, ich (Claude) bin Projektleiter. Bei operativen Entscheidungen entscheide ich und führe durch, bei architektonischen Entscheidungen (z. B. „SSE oder WebSocket?") kurz rückspiegeln und dann durchziehen. Nach jedem kritischen Stand `docs/11-progress.md` anhängen.

Starten: erste Aktion — drei Dev-Server wieder hochziehen und `corepack pnpm --filter @play/api typecheck` laufen lassen, um zu bestätigen, dass der Stand noch sauber ist. Dann Schritt 1 (Schema + Migration).
