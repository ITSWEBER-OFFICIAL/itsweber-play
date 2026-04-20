# 09 — Roadmap

> **Hinweis:** Diese Datei ist die High-Level-Versions-Sicht. Die
> detaillierte Session-Sequenz (Session 1 bis Session 16) + Gate-Kriterien
> für Public-Launch stehen in
> [13-gap-analysis-and-extended-plan.md](13-gap-analysis-and-extended-plan.md).
> Live-Fortschritt: [11-progress.md](11-progress.md).
> Letzte Aktualisierung: Ende Session 7 + Quick-Wins (2026-04-17).

## v0.1 — MVP (Sessions 1-3) · **DONE**

**Deliverable:** Funktionsfähige Plattform, 1 Creator, 1 Zuschauer.

- [x] Monorepo (pnpm + Turborepo + TypeScript)
- [x] Prisma-Schema (User/Session/Channel/Video/Reaction/Comment/Account)
- [x] Better Auth (Email/PW, Admin-Bootstrap-Hook)
- [x] Next.js 15 + Tailwind v4 + Token-System Ebenen 1+2
- [x] Upload-Pipeline (Direct-Stream → MinIO → BullMQ → FFmpeg-HLS)
- [x] HLS-Player (hls.js + Safari-native)
- [x] Startseite mit Video-Grid
- [x] Watch-Page mit Player
- [x] Sichtbarkeits-Enforcement (public/unlisted/private/logged-in)
- [x] Minimales Admin (User-Liste, Rolle, Ban)
- [x] Dev-Docker-Compose + Prod-Dockerfiles (ungetestet)
- [x] Backup-Script (pg_dump + MinIO-rsync)
- [x] Theming Ebenen 3-6 (Live-Editor, Presets, Custom-CSS, Block-Composer)

**Definition of Done:** Playback eines eigenen Uploads · erreicht.

## v0.2 — Creator & Community (Sessions 4-7) · **DONE**

**Deliverable:** Studio + Admin auf YT-Studio-Niveau + Social-Layer.

- [x] Studio-Sidebar + Dashboard-Stats
- [x] Video-Edit-Seite (Titel/Desc/Tags/Kategorie/Kapitel/Thumbnail-Picker)
- [x] yt-dlp-Import-Flow (Session 1) + Upload-Menü überall (Split-Dropdown)
- [x] Kanal-Profil (Name/Description/About/SocialLinks)
- [x] Admin-Sidebar + Dashboard + globales Video-Management
- [x] Admin-System-Panel (DB/Queue/Env-Health)
- [x] `/channels` Directory · `/subs` Feed · `/library` Sections
- [x] Postgres-ILIKE-Search + Tag-Autocomplete (`/search`)
- [x] Kategorien-Schema + Admin-Verwaltung + Chip-Links
- [x] Subscribe-Button + Subscription-Schema
- [x] Kommentare (threaded), Likes, Reports, Moderation-Queue
- [x] In-App-Notifications (Header-Bell, Dropdown, unread-Badge)
- [x] View-Tracking (sessionStorage-dedupliziert)
- [x] Toast-System
- [x] SVG-Icon-Library (projektweit, keine Emojis)
- [x] Shorts-Klassifikation + `/shorts` Portrait-Grid

## v0.3 — SEO · Legal · Prod-Deploy (Sessions 8-16)

**Deliverable:** Release-ready, DE-Launch-safe, auf Unraid live, optional
auf GitHub + im Unraid Community Store.

### Session 8 — SEO + Sharing + Embed

- [ ] `generateMetadata` per `/watch/[slug]` + `/c/[slug]`
- [ ] OG-Tags + Twitter-Cards + JSON-LD VideoObject
- [ ] Sitemap + robots.txt
- [ ] oEmbed-Endpoint + `/embed/[slug]`-iframe-Player
- [ ] Share-Buttons erweitern (LinkedIn/Reddit)

### Session 9 — Legal + Compliance (Launch-Blocker für DE)

- [ ] StaticPage-CMS (`Admin → Seiten`) — Impressum/Datenschutz/AGB
  Markdown-editierbar, Admin-only, Footer-Reihenfolge
- [ ] Cookie-Consent-Banner (3-Stufen: Essenziell / + Statistik / Alle)
- [ ] DSGVO-Export eigener Daten (User-Settings)
- [ ] DSGVO-Account-Löschung (Hard-Delete mit Video-Anonymisierung)
- [ ] Takedown-Audit-Log

### Session 10 — Shorts-Feed + mehr Block-Typen

- [ ] Vertikaler Swipe-Feed `/shorts` (full-screen, autoplay, loop)
- [ ] SHORTS_RAIL-Block (horizontal scroll)
- [ ] Neue Block-Typen: VIDEO_ROW, FEATURED_CHANNEL, TRENDING, TEXT (Markdown)
- [ ] Favicon-Upload im Admin
- [ ] Watch-History-Schema + Watch-Later

### Session 11 — Prod-Deploy

- [ ] `docker compose build` auf dem Ziel-Host
- [ ] NPM-Proxy-Konfig dokumentiert
- [ ] `S3_PUBLIC_URL` korrekt gesetzt
- [ ] Smoke-Tests unter Last
- [ ] 48 h Stabilitäts-Gate

### Sessions 12-16 — Release-Pipeline (siehe docs/13 §M)

- [ ] Session 12: Git-Setup (LICENSE, README, CONTRIBUTING, Secret-Scan)
- [ ] Session 13: GitHub-Public-Push + Actions-CI + Release-Tag
- [ ] Session 14: Unraid Community Store Template-PR
- [ ] Session 15: itsweber.de Produktseite + Download + Demo-Video
- [ ] Session 16: Dokumentation (Install/Handbuch/Wiki/FAQ)

## v1.0 — Polish & Scale (Post-Release)

- [ ] Analytics (Views/Watch-Time/Retention-Chart)
- [ ] Authentik OIDC als Login-Option
- [ ] Auto-Captions (Whisper)
- [ ] PWA (Manifest + Service-Worker + Offline-Watch-Later)
- [ ] Empfehlungsalgorithmus (Tags + Watch-History)
- [ ] Passkey (WebAuthn)
- [ ] E-Mail-Notifications (Better-Auth-Transport)
- [ ] Audit-Log global (Admin-Aktionen über Theme hinaus)
- [ ] Sentry / Error-Tracking
- [ ] Prometheus `/metrics`
- [ ] Migration-Script MediaCMS → ITSWEBER Play
- [ ] DNS-Umstellung `play.itsweber.net` → neues System
- [ ] MediaCMS offline schalten

## Backlog

- [ ] Livestreams (RTMP Ingest)
- [ ] Mobile App (Expo)
- [ ] Meilisearch (falls Postgres-FTS zu dünn wird)
- [ ] Donations / Super-Chat
- [ ] Multi-Language UI (EN/DE)
- [ ] GPU-Transcoding (optional, `TRANSCODE_USE_GPU=1`)
- [ ] CUSTOM_HTML-Block mit DOMPurify + iframe-sandbox
- [ ] Age-Gate für 18+ Videos
- [ ] ActivityPub (falls Federation jemals gewünscht wird)

## Meilenstein-Definitionen

| Meilenstein | Kriterium |
| --- | --- |
| **Alpha** | v0.1 MVP stabil 1 Woche ohne Crash · erreicht |
| **Beta intern** | v0.2 durch · Studio + Community live · **aktuell** |
| **Beta Unraid** | v0.3 Sessions 8-11 durch · auf Unraid live |
| **Beta Public** | Session 13 durch · GitHub-Repo public · Release-Tag |
| **Release 1.0** | v1.0 erreicht · DNS umgestellt · MediaCMS abgeschaltet |
