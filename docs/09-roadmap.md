# 09 — Roadmap

> **Hinweis:** Diese Datei ist die High-Level-Versions-Sicht. Der
> Feature-Scope im Detail steht in [07-features-matrix.md](07-features-matrix.md).

## v0.1 — MVP · **DONE**

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
- [x] Dev-Docker-Compose + Prod-Dockerfiles
- [x] Backup-Script (pg_dump + MinIO-rsync)
- [x] Theming Ebenen 3-6 (Live-Editor, Presets, Custom-CSS, Block-Composer)

**Definition of Done:** Playback eines eigenen Uploads · erreicht.

## v0.2 — Creator & Community · **DONE**

**Deliverable:** Studio + Admin auf YT-Studio-Niveau + Social-Layer.

- [x] Studio-Sidebar + Dashboard-Stats
- [x] Video-Edit-Seite (Titel/Desc/Tags/Kategorie/Kapitel/Thumbnail-Picker)
- [x] yt-dlp-Import-Flow + Upload-Menü überall (Split-Dropdown)
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

## v0.3 — SEO · Legal · Prod-Deploy

**Deliverable:** Release-ready, DE-Launch-safe, auf Unraid live, optional
auf GitHub + im Unraid Community Store.

### SEO + Sharing + Embed

- [ ] `generateMetadata` per `/watch/[slug]` + `/c/[slug]`
- [ ] OG-Tags + Twitter-Cards + JSON-LD VideoObject
- [ ] Sitemap + robots.txt
- [ ] oEmbed-Endpoint + `/embed/[slug]`-iframe-Player
- [ ] Share-Buttons erweitern (LinkedIn/Reddit)

### Legal + Compliance (Launch-Blocker für DE)

- [ ] StaticPage-CMS (`Admin → Seiten`) — Impressum/Datenschutz/AGB
  Markdown-editierbar, Admin-only, Footer-Reihenfolge
- [ ] Cookie-Consent-Banner (3-Stufen: Essenziell / + Statistik / Alle)
- [ ] DSGVO-Export eigener Daten (User-Settings)
- [ ] DSGVO-Account-Löschung (Hard-Delete mit Video-Anonymisierung)
- [ ] Takedown-Audit-Log

### Shorts-Feed + mehr Block-Typen

- [ ] Vertikaler Swipe-Feed `/shorts` (full-screen, autoplay, loop)
- [ ] SHORTS_RAIL-Block (horizontal scroll)
- [ ] Neue Block-Typen: VIDEO_ROW, FEATURED_CHANNEL, TRENDING, TEXT (Markdown)
- [ ] Favicon-Upload im Admin
- [ ] Watch-History-Schema + Watch-Later

### Prod-Deploy

- [ ] `docker compose build` auf dem Ziel-Host
- [ ] Reverse-Proxy-Konfig dokumentiert (NPM / Traefik / Caddy)
- [ ] `S3_PUBLIC_URL` korrekt gesetzt
- [ ] Smoke-Tests unter Last
- [ ] 48 h Stabilitäts-Gate

### Release-Pipeline

- [ ] Git-Setup (LICENSE, README, CONTRIBUTING, Secret-Scan)
- [ ] GitHub-Public-Push + Actions-CI + Release-Tag
- [ ] Unraid Community Store Template-PR
- [ ] Download-Bereich + Demo-Video
- [ ] Dokumentation (Install/Handbuch/Wiki/FAQ)

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
- [ ] Migrations-Script aus MediaCMS/PeerTube (Best-Effort)

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
| **Alpha** | v0.1 MVP stabil 1 Woche ohne Crash |
| **Beta intern** | v0.2 durch · Studio + Community live |
| **Beta Unraid** | v0.3 SEO+Legal+Prod-Deploy durch · auf Unraid live |
| **Beta Public** | GitHub-Repo public · Release-Tag |
| **Release 1.0** | v1.0 erreicht |
