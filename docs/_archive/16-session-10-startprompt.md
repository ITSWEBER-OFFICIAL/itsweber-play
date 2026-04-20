# Session 10 — Startprompt: Shorts-Feed + Watch-History

Wir bauen ITSWEBER Play weiter. Lies zuerst in dieser Reihenfolge:

1. `CLAUDE.md` — Projektübersicht + Konventionen
2. `docs/11-progress.md` — aktueller Stand bis Session 9 (Legal + Compliance)
3. `docs/13-gap-analysis-and-extended-plan.md` — komplette Roadmap
4. `docs/07-features-matrix.md` — Feature-Scope + Status

## Stand vor Session 10

**v0.1 + v0.2 + Sessions 8 + 9 sind DONE.** Kurzform Session 9:

- `StaticPage`-Model (slug PK, title, body Text, published, showInFooter, order).
- Migration `20260417120000_add_static_pages`.
- tRPC-Router `staticPage`: `getBySlug` (public) · `list/listFooter` · `upsert` · `delete` (alle admin).
- Seed mit Platzhalter-HTML für `impressum`, `datenschutz`, `agb`.
- SSR-Routen `/impressum`, `/datenschutz`, `/agb` — holen Content aus DB via `fetchStaticPage()`.
- `components/static-page-view.tsx` + `prose-legal`-CSS.
- Admin-CMS `/admin/pages` — Tabelle + Edit/Create-Modal, WIP-Chip entfernt.
- `components/cookie-banner.tsx` — `localStorage play:consent:v1`, „Nur notwendige" + „Alle", Link /datenschutz. In Root-Layout eingehängt.
- Footer: `v0.2`, Links waren schon da.
- Typecheck: @play/api + @play/web grün.

**Offenes Pending vor Session 10:**

- Docker muss laufen → dann:
  ```bash
  cd packages/db
  DATABASE_URL=postgresql://play:play-dev@localhost:5432/itsweber_play npx prisma migrate deploy
  DATABASE_URL=... npx tsx src/seed.ts
  ```
- Anschließend Smoke-Test: `/impressum` + `/datenschutz` + `/agb` → HTTP 200 mit Content.

## Session 10 — Scope: Shorts-Feed + Watch-History

Dies ist **kein Launch-Blocker** — erst nach Session 11 (Prod-Deploy).

### Muss in dieser Session

1. **Shorts Swipe-Feed (`/shorts`)**:
   - Vertikaler Full-Screen-Feed statt des aktuellen Portrait-Grid.
   - Ein Video nimmt 100 vh, Maus-Wheel/Touch-Swipe scrollt zum nächsten.
   - Autoplay + Loop pro Video, Mute-Button (Browser-Autoplay-Policy).
   - Keyboard: ↑/↓ navigiert zwischen Videos.
   - Lazy-Load: nächste 3 Videos preloaden, Rest erst on-scroll.
   - Infinite-Scroll via `trpc.video.list({ format: "SHORT", cursor })`.
   - Like-Button + Comment-Count als Overlay-UI (rechts, wie TikTok/Reels).
   - Bereits vorhandenes `HlsPlayer` wiederverwenden — neue Prop `loop`.

2. **Watch-History**:
   - Schema: neues Model `WatchHistory` (`userId`, `videoId`, `watchedAt`,
     composite PK `[userId, videoId]`, Index `[userId, watchedAt]`).
   - tRPC `history.add({ videoId })` (protected) — upsert `watchedAt=now`.
     Aufgerufen vom Watch-Client sobald `status=LIVE` und User eingeloggt.
   - tRPC `history.list({ limit?, cursor? })` (protected) — paginated,
     neueste zuerst, joined Video-Meta.
   - tRPC `history.clear()` (protected) — löscht alle Einträge des Users.
   - `/library`-Seite: zweite Section „Zuletzt angesehen" mit History-Feed
     (bisher war da nur Abo-Feed + Eigene Videos).
   - Bereits vorhandener `/library`-Stub aus Session 6 erweitern.

3. **Watch-Later** (optional, wenn Zeit reicht):
   - Schema: `WatchLater` (`userId`, `videoId`, composite PK, `createdAt`).
   - tRPC `watchLater.toggle({ videoId })` + `watchLater.list`.
   - Bookmark-Icon im Watch-Page Actions-Row (neben Like/Share/Report).
   - Section in `/library`.

### Muss NICHT in dieser Session

- Vertikaler Swipe auf Mobile mit echten Touch-Events (funktioniert mit
  scroll-snap — kein zusätzlicher Gesture-Listener nötig).
- Recommendation-Engine (Trending/Related-Feed) — v1.0.
- Weitere Block-Typen (Video-Row, Shorts-Rail) — erst nach Session 10.

## Technische Regeln

- SVG statt Emoji überall.
- User = Architekt, Claude = PL. Operative Entscheidungen führen.
- Prisma-Migration-Flow: `migrate dev --create-only --name <x>` dann
  `migrate deploy`.
- Release-Pipeline: nichts auf GitHub bevor Session 13 (Git-Setup) ok.
- Modell-Empfehlung: **Sonnet 4.6**.

## Dev-Setup-Reminder

- Admin-Login: admin@itsweber.de / play-dev-admin
- Docker-Services: Postgres/Redis/MinIO via `docker-compose.dev.yml`

## Nach Session 10

- `docs/11-progress.md` um Session 10 erweitern.
- Startprompt Session 11 (Prod-Deploy auf Unraid) als `docs/17-session-11-startprompt.md`.
- Session 11 ist Launch-Blocker — nach Session 10 direkt angehen.
