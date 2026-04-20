# 07 — Features-Matrix

> **Hinweis:** Diese Datei zeigt den **geplanten und aktuellen** Scope pro
> Feature. Der Live-Session-Fortschritt steht in
> [11-progress.md](11-progress.md). Die Session-Sequenz + Release-Pipeline
> in [13-gap-analysis-and-extended-plan.md](13-gap-analysis-and-extended-plan.md).
> Zuletzt aktualisiert: Ende Session 7 + Quick-Wins (2026-04-17).

## Legende

- ✅ in Produktion / live verifiziert
- 🚧 in Arbeit / Teil einer laufenden Session
- ⬜ geplant, Session zugeteilt
- ❌ nicht in Scope

## Auth & Users

| Feature | Status | Version |
| --- | :-: | :-: |
| Register / Login (E-Mail + Passwort, Better-Auth) | ✅ | v0.1 |
| Session-Cookie + Admin-Bootstrap-Hook | ✅ | v0.1 |
| Rollen (Admin/Moderator/Creator/Viewer) | ✅ | v0.1 |
| Self-lockout-Schutz im Admin | ✅ | v0.1 |
| Email-Verify | ⬜ | v1.0 |
| Password-Reset | ⬜ | v1.0 |
| OIDC via Authentik | ⬜ | v1.0 |
| Passkey (WebAuthn) | ⬜ | v1.0 |

## Video-Core

| Feature | Status | Version |
| --- | :-: | :-: |
| Direct-Stream-Upload (video/\* raw) | ✅ | v0.1 |
| FFmpeg-Transcode → HLS (720p/480p, 1080p wenn Source) | ✅ | v0.1 |
| HLS.js Player + Safari-native HLS | ✅ | v0.1 |
| Sichtbarkeit: public / unlisted / private / logged-in | ✅ | v0.1 |
| 5 Thumbnail-Kandidaten (10/30/50/70/90 %) + Picker | ✅ | v0.2 |
| Kanäle (1 Default pro User) | ✅ | v0.1 |
| Watch-Seite mit Player + Meta + Actions | ✅ | v0.2 |
| View-Tracking (sessionStorage-dedupliziert) | ✅ | v0.2 |
| Tags + Kapitel + commentsEnabled | ✅ | v0.2 |
| Video-Format-Klassifikation (LONG/SHORT) | ✅ | v0.2 |
| yt-dlp-Import (Kopie in MinIO) | ✅ | v0.2 |
| Upload-Menü überall (Split-Dropdown Upload/Import) | ✅ | v0.2 |
| tus.io Resumable-Uploads | ⬜ | v0.3 |
| Captions (manueller Upload) | ⬜ | v0.3 |
| Auto-Captions (Whisper) | ⬜ | v1.0 |

## Studio (Creator-Backend)

| Feature | Status | Version |
| --- | :-: | :-: |
| Studio-Sidebar (Dashboard/Videos/Upload/Channel/…) | ✅ | v0.2 |
| Dashboard mit 4 Stats-Cards + Status-Pills | ✅ | v0.2 |
| Video-Liste + Status-Filter + Editor-Link | ✅ | v0.2 |
| Inline-Editor (Titel/Desc/Tags/Kategorie/Chapters) | ✅ | v0.2 |
| Thumbnail-Picker mit 5 Kandidaten | ✅ | v0.2 |
| Kommentare-Moderation (eigene Videos) | ✅ | v0.2 |
| Kanal-Profil (Name/Description/About/Socials) | ✅ | v0.2 |
| Branding (Avatar/Banner-Upload) | ⬜ | v0.3 |
| Analytics (Views/Watch-Time/Retention) | ⬜ | v1.0 |
| Custom-Thumbnail-Upload | ⬜ | v0.3 |
| Trim-Scrubber | ⬜ | v0.3 |

## Admin

| Feature | Status | Version |
| --- | :-: | :-: |
| Admin-Sidebar (Overview/Style/System) | ✅ | v0.2 |
| Dashboard mit Stats + Quick-Actions + Audit-Feed | ✅ | v0.2 |
| User-Verwaltung (Rolle/Ban) | ✅ | v0.1 |
| Globales Video-Management | ✅ | v0.2 |
| Kategorien-Verwaltung + Icon-Picker | ✅ | v0.2 |
| Moderation-Queue + Takedown-Flow | ✅ | v0.2 |
| System-Health (DB/Queue/Env) | ✅ | v0.2 |
| Audit-Log global | ⬜ | v0.3 |
| Site-Settings (Name/Locale/SEO) | ⬜ | v0.3 |

## Community

| Feature | Status | Version |
| --- | :-: | :-: |
| Kommentare threaded (2 Level) | ✅ | v0.2 |
| Likes / Reactions | ✅ | v0.2 |
| Subscriptions (Schema + UI) | ✅ | v0.2 |
| Report-Flow (7 Reasons) | ✅ | v0.2 |
| In-App-Notifications (Header-Bell) | ✅ | v0.2 |
| NEW_UPLOAD-Notification an Abonnenten | ✅ | v0.2 |
| Comment-Reply-Notification | ✅ | v0.2 |
| Watch-Later + History | ⬜ | v0.3 |
| Playlists | ⬜ | v0.3 |
| E-Mail-Notifications | ⬜ | v1.0 |

## Startseite & Navigation

| Feature | Status | Version |
| --- | :-: | :-: |
| Video-Grid (Latest) | ✅ | v0.1 |
| Hero-Block mit Featured-Video-Picker (Admin-only) | ✅ | v0.2 |
| Category-Chips (aus DB, verlinkt) | ✅ | v0.2 |
| Block-Composer (Drag-Reorder, 4 Blocktypen) | ✅ | v0.3 |
| Kategorie-Seite `/category/[slug]` | ✅ | v0.2 |
| Kanal-Directory `/channels` | ✅ | v0.2 |
| Abos `/subs` + Feed | ✅ | v0.2 |
| Bibliothek `/library` (Abo-Feed + Eigene) | ✅ | v0.2 |
| Suche `/search?q=…` + Tag-Matches | ✅ | v0.2 |
| Shorts-Grid `/shorts` (v0.2) | ✅ | v0.2 |
| Shorts-Swipe-Feed (vertikal, full-screen, loop) | ⬜ | v0.3 |
| Weitere Block-Typen (Video-Row, Featured-Channel, Trending, Text) | ⬜ | v0.3 |
| YouTube-Style-Public-Sidebar | ⬜ | v0.3 |
| Recommendation-Engine (Tags + History) | ⬜ | v1.0 |
| Postgres-FTS-Indizes | ⬜ | v0.3 |
| Meilisearch | ⬜ | Backlog |

## SEO & Sharing

| Feature | Status | Version |
| --- | :-: | :-: |
| Per-Video OG-Tags + Twitter-Cards | ⬜ | v0.2 (Session 8) |
| Schema.org VideoObject JSON-LD | ⬜ | v0.2 (Session 8) |
| Sitemap + robots.txt | ⬜ | v0.2 (Session 8) |
| Share-Buttons (Copy/X/WhatsApp/Telegram/Mail) | ✅ | v0.2 |
| oEmbed-Endpoint | ⬜ | v0.3 (Session 8) |
| Embeddable Player `/embed/[slug]` | ⬜ | v0.3 (Session 8) |
| RSS-Feed pro Kanal | ⬜ | v1.0 |

## Theming (Kern-Differenzierer)

| Feature | Status | Version |
| --- | :-: | :-: |
| Primitive Tokens (tokens.json → CSS vars) | ✅ | v0.1 |
| Semantic Tokens (Tailwind v4 @theme) | ✅ | v0.1 |
| Admin-Live-Editor (Colorpicker + Sliders) | ✅ | v0.2 |
| Preset-Switch (dark/light/high-contrast/retro) | ✅ | v0.2 |
| Preset Export / Import (JSON) | ✅ | v0.2 |
| Custom-CSS-Sandbox + CSS-Parser + Revisionen | ✅ | v0.2 |
| Logo-Upload + Logo-Filter (10 Presets inkl. invert) | ✅ | v0.2 |
| Audit-Log für Theme-Änderungen | ✅ | v0.2 |
| SSE-Live-Sync (cross-tab) | ✅ | v0.2 |
| Layout-Block-Editor (Drag-Reorder, Hero-Video-Picker) | ✅ | v0.3 |
| Favicon-Upload | ⬜ | v0.3 |
| SVG-Icon-Library (projektweit, keine Emojis) | ✅ | v0.2 |
| Theme-Marketplace | ❌ | — |

## Legal & Compliance (DE-Launch-Blocker)

| Feature | Status | Version |
| --- | :-: | :-: |
| Impressum / Datenschutz / AGB-Stubs | ✅ | v0.2 |
| StaticPage-CMS (Admin-only Markdown-Pages) | ⬜ | v0.3 (Session 9) |
| Cookie-Consent-Banner (3-Stufen) | ⬜ | v0.3 (Session 9) |
| DSGVO-Export eigener Daten | ⬜ | v0.3 (Session 9) |
| DSGVO-Account-Löschung | ⬜ | v0.3 (Session 9) |
| Age-Gate für 18+ Videos | ⬜ | v1.0 |

## Infrastruktur

| Feature | Status | Version |
| --- | :-: | :-: |
| Monorepo (pnpm + Turborepo) | ✅ | v0.1 |
| Dev-Docker-Compose (Postgres/Redis/MinIO) | ✅ | v0.1 |
| Prod-Docker-Compose (Unraid-VLAN) | 🚧 | v0.3 (Session 11) |
| Prod-Deploy auf Unraid (echter Bau-Durchlauf) | ⬜ | v0.3 (Session 11) |
| NPM-Proxy-Konfig dokumentiert | ⬜ | v0.3 (Session 11) |
| Backup-Script (pg_dump + MinIO-rsync) | ✅ | v0.1 |
| GitHub-Repo public | ⬜ | v0.3 (Session 13) |
| GitHub-Actions CI (typecheck/lint/build) | ⬜ | v0.3 (Session 13) |
| Unraid Community Store | ⬜ | v0.3 (Session 14) |
| Sentry / Error-Tracking | ⬜ | v1.0 |
| Prometheus `/metrics` | ⬜ | v1.0 |

## Website / Marketing

| Feature | Status | Version |
| --- | :-: | :-: |
| itsweber.de Produktseite | ⬜ | v0.3 (Session 15) |
| Download-Bereich (Docker-Compose-Template) | ⬜ | v0.3 (Session 15) |
| Demo-Video | ⬜ | v0.3 (Session 15) |
| Screenshots + Feature-Matrix-Grafik | ⬜ | v0.3 (Session 15) |

## Dokumentation

| Feature | Status | Version |
| --- | :-: | :-: |
| Architektur-Docs (`docs/*.md`) | ✅ | v0.1 |
| Progress-Log | ✅ | v0.1 |
| Installationsanleitung Unraid | ⬜ | v0.3 (Session 16) |
| Installationsanleitung generic Docker | ⬜ | v0.3 (Session 16) |
| Admin-Handbuch | ⬜ | v0.3 (Session 16) |
| Creator-Handbuch | ⬜ | v0.3 (Session 16) |
| GitHub-Wiki (10+ Seiten) | ⬜ | v0.3 (Session 16) |
| API-Referenz (aus tRPC abgeleitet) | ⬜ | v1.0 |
| Video-Tutorial | ⬜ | v0.3 (Session 16) |

## Accessibility

| Feature | Status | Version |
| --- | :-: | :-: |
| Keyboard-Nav | ✅ | v0.1 |
| High-Contrast Preset | ✅ | v0.2 |
| aria-Labels auf Icon-Buttons | ✅ | v0.1 |
| Focus-Rings (shadcn-Style) | ✅ | v0.1 |
| Captions-Support im Player | ⬜ | v1.0 |

## Nicht in Scope

- ActivityPub / Federation — bewusst Single-Instance
- MediaCMS-Bestand-Migration vor v1.0
- Öffentliches Paywall / Monetarisierung vor v1.0
- Native Mobile-App (PWA reicht)
- GPU-Transcoding (bis Frigate/CompreFace die GPU freigeben)
- Livestreams (RTMP Ingest) — Backlog, nicht priorisiert
