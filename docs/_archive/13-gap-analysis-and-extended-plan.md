# 13 — Gap-Analyse + erweiterter Plan (2026-04-17)

Ehrliche Bilanz nach Session 3 (Theming-Ebene 6 durch). Der bisherige
„MVP-durch"-Stand deckt nur ~60 % der Preview-Vision + der Features-Matrix
ab. Diese Doku listet die Lücken und priorisiert sie.

## Leitprinzipien für die Nachtrags-Roadmap

1. **Previews sind die Ground-Truth** (`previews/home.html`, `studio.html`,
   `admin.html`). Jede UI-Entscheidung wird an ihnen gemessen.
2. **Schema-Änderungen gehören an den Anfang der jeweiligen Session** —
   sonst blockiert Windows-DLL-Lock mitten im Flow.
3. **Creator-Workflow schlägt Discovery-Features.** Ein Creator ohne
   Metadaten-Editor ist nutzloser als ein Viewer ohne Shorts-Feed.
4. **SEO nicht am Ende.** Per-Video-OG-Tags sind 1 h Arbeit und
   verdoppeln die Link-Shareability sofort.

## Gap pro Bereich

### A · Studio (Creator-Backend) — Priorität P0

Preview zeigt ein ausgewachsenes Studio mit Sidebar, Stats-Dashboard,
Video-Tabelle + Inline-Editor. Wir haben nur Video-Liste + Upload.

**Muss kommen:**

- Sidebar: Dashboard, Meine Videos, Upload/Import, Analytics, Kommentare,
  Kanal-Profil, Branding, Abonnenten, Einstellungen.
- Dashboard: 4-Stats-Row (Videos · Views 30d · Watch-Time · Abos).
- Video-Liste: Spalten Views/Likes/Dauer, Status-Filter, Bulk-Aktionen.
- Inline-Editor `/studio/[id]/edit`:
  - Titel / Beschreibung (Markdown-optional, min rich-text via textarea)
  - Tags (Komma-separiert → Array)
  - Sichtbarkeits-Radio (Public/Unlisted/LoggedIn/Private)
  - Kommentare-Toggle
  - Thumbnail-Picker: 5 Worker-Frames zur Auswahl + Custom-Upload
  - Kapitel (Zeilen „MM:SS — Titel", Parser im Player)
  - Trim-Scrubber (optional v0.3 — braucht Re-Transcode-Job)
- Kanal-Profil: Banner-Upload, About-Text, Social-Links.
- Branding (kanal-spezifisch): Avatar, Banner, Intro-Video.

**Schema-Änderungen:**

- `Video.tags String[]` (neu)
- `Video.chapters Json?` (neu, Array<{time, title}>)
- `Video.commentsEnabled Boolean @default(true)` (neu)
- `Channel.bannerUrl String?` existiert schon, aber keine Upload-UI
- `Channel.about String?` (neu)
- `Channel.socialLinks Json?` (neu, Array<{platform, url}>)

### B · Admin-Dashboard — Priorität P0

Preview zeigt 3-Gruppen-Sidebar (Overview / Erscheinungsbild / System),
Stats-Dashboard, Live-Preview-Panel, Moderation-Queue. Wir haben 3
Top-Tabs (User/Theme/Blöcke).

**Muss kommen:**

- Sidebar im selben Layout wie Studio.
- Dashboard-Overview: Users · Videos · Storage (MinIO) · Transcoding-Queue
  (BullMQ-Count) · Audit-Events heute.
- Video-Management (global, alle Uploads quer über alle Creator).
- Moderation-Queue: gemeldete Videos + Kommentare.
- System-Panel: Queue-Status, Storage-Usage, Logs-Tail, Integrationen.
- Einstellungen-Panel: Site-Name, Description, Default-Locale, Registrierung offen/zu.

### C · Navigation & Public Pages — Priorität P0

Die Header-Links `/channels`, `/subs`, `/library` sind Dead-Ends (404).
Peinlich für jeden Besucher.

**Muss kommen:**

- `/channels` — Channel-Directory (sortierbar nach Abos, Video-Count, Aktivität).
- `/subs` — eingeloggter User sieht seine Abos + deren neueste Videos.
- `/library` — Watch-Later, History, Likes.
- `/search?q=…` — Postgres-FTS über Video.title + description + tags + channel.displayName.
- `/category/[slug]` — Chips klickbar, Filter tatsächlich aktiv.
- **YouTube-Style Sidebar** am Viewport-Left für eingeloggte User
  (Home, Shorts, Abos, Library, History, Your-Videos, Settings). Toggelbar.

### D · Community — Priorität P1

Schema-Tables für Reaction + Comment existieren, aber keine Route, keine UI.

**Muss kommen:**

- tRPC `comment.list({videoId})` + `comment.create` + `comment.delete` (owner/admin) + `comment.report`.
- Comments-UI unter `/watch/[slug]`: Threaded-Replies (parentId existiert), Markdown-Basis.
- tRPC `reaction.toggle({videoId})` (Like/Unlike — LIKE als Default, DISLIKE optional).
- Like-Button auf `/watch/[slug]` + Count.
- **Subscription-Model** (NEU im Schema): `Subscription { subscriberId, channelId, createdAt, notify: Boolean }`.
- Subscribe-Button im Channel-Header + SiteHeader-Aboliste.
- Notifications (in-app): neuer Upload eines abonnierten Channels → Badge + Panel.

### E · SEO & Social-Sharing — Priorität P1

Aktuell nur `export const metadata` im Root-Layout. Jede geteilte
Video-URL sieht auf Discord/Twitter/WhatsApp langweilig aus.

**Muss kommen:**

- `generateMetadata` in `/watch/[slug]`: og:title, og:description,
  og:image=thumbnailUrl, og:video:url=master.m3u8, og:type=video.other,
  twitter:card=summary_large_image, twitter:player.
- `generateMetadata` in `/c/[slug]` analog für Channels.
- JSON-LD Schema.org **VideoObject** + **Person** (creator) im `/watch`.
- **Sitemap** (`/sitemap.xml`, Next 15 built-in) mit allen PUBLIC+LIVE
  Videos + Channels.
- `robots.txt` mit Disallow auf `/studio/`, `/admin/`, `/api/`.
- **oEmbed**-Endpoint `/api/oembed?url=…` — rendert Embed-Card für
  Discord/Twitter/Slack/Notion.
- **Share-Panel (Full-Scope):** Copy-Link · X/Twitter · Facebook · LinkedIn ·
  Reddit · WhatsApp · Telegram · Pinterest · E-Mail · TikTok (Copy-Link-
  Fallback, kein Web-Intent) · Instagram (Copy-Link-Fallback) · **Embed-Code**
  (iframe-Snippet copy) · **„Starten bei MM:SS"**-Toggle (hängt `?t=sekunden`
  an die Share-URL, Player liest beim Mount).
- Canonical-URLs + `hreflang` (auch wenn nur `de`).
- **Embeddable-Player** `/embed/[slug]` — iframe-safe, für Blog-Einbettung,
  unterstützt `?t=<seconds>`-Autoplay-Offset.

### E2 · Transaktionale E-Mail + SMTP-Admin — Priorität P0 (Launch-Blocker)

Ohne funktionierenden Mailversand kein Passwort-Reset, keine
Email-Verification, keine Benachrichtigungen. Das ist kein optionaler Bucket.

**Muss kommen:**

- **SMTP-Transport:** `nodemailer` im `@play/api`. Connection-Pool, Retry mit
  exponential backoff, TLS-Defaults sicher.
- **Admin-Config-UI** `/admin/email`: Host · Port · Username · Passwort
  (masked, nur Admin) · Secure-Modus (TLS/STARTTLS/none) · From-Name ·
  From-Email · Reply-To · **„Test-Mail senden"**-Button (sendet an
  Admin-Adresse mit Diagnostik: IP-Reverse-DNS, DKIM/SPF/DMARC-Hinweis).
  Konfig in `EmailSettings`-Singleton-Table, Passwort mit envkey-Verschlüsselung.
- **Template-Editor** `/admin/email/templates`: pro Template Subject + HTML-
  Body + Plaintext-Body, Platzhalter-Liste (`{{user.displayName}}`,
  `{{actionUrl}}`, `{{video.title}}`). Live-Vorschau im rechten Panel,
  „Senden an…"-Test-Button.
- **6 System-Templates (seeded):**
  1. **Email-Verify** — Link bestätigt Registrierung (24 h gültig).
  2. **Password-Reset** — einmaliger Link, 1 h gültig, IP-Log.
  3. **Welcome** — nach Verify, erklärt Studio + Upload.
  4. **New-Comment** — Creator erhält Benachrichtigung bei neuem Kommentar.
  5. **New-Subscriber** — Creator erhält Benachrichtigung bei neuem Abonnent.
  6. **Report-Eingang** — Admin erhält Benachrichtigung bei neuem Report.
- **Better-Auth-Hooks** verkabeln: `sendResetPassword`, `sendVerificationEmail`,
  `emailVerification.sendOnSignUp=true`, `requireEmailVerification=true`.
- **User-Notification-Preferences**: pro User on/off für jede
  Benachrichtigungs-Art, gesetzt im `/settings/notifications`. System-Emails
  (Verify, Reset) sind **nicht** deaktivierbar.
- **Rate-Limit**: max. 5 Verify-Mails/Stunde/User, max. 3 Reset-Mails/Stunde/IP.
- **Bounce/Complaint-Tracking** (optional v0.4): wenn SMTP-Provider bounces
  zurückmeldet, User-Flag `email.invalid=true`.
- **DSGVO:** Footer jeder Nicht-System-Mail enthält `Abmelde-Link` → Preferences.
- **Logos in E-Mails:** Admin-konfigurierbar (liegt im `play-assets`-Bucket,
  gleicher Bucket wie Site-Logo). Default ist das Site-Logo.

**Design-Leitlinien (siehe `previews/email-*.html`):**

- Plain-HTML-Tables (kein Flexbox, keine Grid-Layouts) — Outlook-kompatibel.
- Inline-CSS (`<style>`-Tag wird in manchen Clients ignoriert).
- Max. 600 px Breite, Mobile-First-Padding.
- Theme-Tokens als Referenz für Farbauswahl, **aber hardcoded in Template**
  (E-Mails haben keinen Browser zur CSS-Variable-Auflösung).
- Jede Mail hat Plain-Text-Fallback (wichtig für A/11y + Spam-Score).

### F · Shorts — Priorität P2

Preview-ReadMe erwähnt Shorts nicht, aber der User hat explizit nachgefragt.

**Muss kommen:**

- `Video.format VideoFormat` Enum (LONG / SHORT) — Worker erkennt aus Aspect-Ratio.
- `/shorts` Route: vertikal-Scroll-Feed, Full-Screen-Player, Swipe-up/down.
- Shorts-Rail-Block für die Homepage (horizontal scroll).
- Kein separater Upload-Flow — Worker klassifiziert automatisch.

### G · Discovery — Priorität P1

- **Kategorien-Schema:** `Category { id, slug, name, order }` + Join-Table
  `VideoCategory` oder einfach `Video.categoryId` für 1:1.
- Admin-UI für Kategorien-Verwaltung.
- Chips-Block holt Kategorien aus DB (aktuell hartkodiert).
- Recommendation für `/watch/[slug]`-Sidebar: 1) gleiche Kategorie,
  2) gleicher Channel, 3) Tag-Overlap, fallback Latest-Public.
- Trending-Algorithmus: `views * recency-factor` — als VIDEO_GRID-orderBy.

### H · Theming-Polish — Priorität P1

- Neue Logo-Filter-Presets: `brightness0`, `invert`, `invertGlow`
  (invert + drop-shadow), `mono` (grayscale 100% + contrast 1.2).
- Toast-System: success/error-Toasts bei jeder Admin-Mutation.
  Kein externes Lib — Custom-Implementation mit `useSyncExternalStore`.
- Loading-Skeletons konsistent (shimmer-Animation).
- Progress-Indicator im SiteHeader beim Navigieren (Next 15 `loading.tsx`).
- Mehr Block-Typen: **Video-Row (horizontal-scroll)**, **Featured-Channel**,
  **Trending Top-10**, **Text-Block** (Markdown-Content), **Shorts-Rail**.

### I · Infrastruktur — Priorität P2 (aber nicht vergessen)

- Prod-Deploy auf Unraid echt durchziehen + Smoke-Test (`docker compose build`
  lokal, dann SSH → Unraid).
- NPM-Proxy-Dokumentation (`config/npm-proxy-host.md`).
- `S3_PUBLIC_URL` in Prod-Env korrekt setzen (sonst sind Logo/Thumbs URLs broken).
- Backup-Script testen + Restore-Drill.
- Sentry + Prometheus (optional, v1.0).

### J · Mobile & PWA — Priorität P3 (v1.0)

- Responsive-Testing + Fixes (aktuell desktop-first).
- Manifest + Service-Worker für Install-as-PWA.
- Offline Watch-Later.

### K · Legal, Compliance & Cookie-Consent — Priorität P0 (Launch-Blocker DE)

Die Plattform läuft in DE, damit: **Impressumspflicht** (§5 TMG), **DSGVO**
(Cookies, Tracking-Info, Auskunftsrecht), **Urheberrecht** (Takedown-Flow für
fremde Uploads). Das ist kein optionaler Feature-Bucket — ohne das kann die
Plattform nicht öffentlich gehen.

**CMS-artiges Static-Page-System (nur Admin):**

- Neues Schema: `StaticPage { slug @id @unique, title, bodyMarkdown, published:
  Boolean, showInFooter: Boolean, order: Int, updatedBy, updatedAt }`.
- Admin-UI `/admin/pages` — Liste + Editor (Markdown-Textarea mit Live-Preview).
  Drag-Reorder für Footer-Reihenfolge.
- Public-Catch-All `/[slug]/page.tsx` — rendert die Markdown-Seite, mit
  `generateMetadata` für SEO.
- Footer-Component holt `showInFooter: true`-Pages aus DB und rendert sie
  dynamisch → Admin kann Reihenfolge + Titel setzen, ohne Code.
- **Seed** mit Standard-Pages: `impressum`, `datenschutz`, `agb`, `nutzungsbedingungen`,
  `kontakt`, `ueber` — mit Template-Text-Stubs, die Admin ausfüllt.
- **Creator/User darf das nicht sehen/editieren** — gated via `adminProcedure`.

**Cookie-Consent:**

- Consent-Banner beim ersten Besuch (localStorage-Flag, Session-Cookie nicht genügt).
- 3-Stufen: „Essenziell", „Essenziell + Statistik", „Alle inkl. externe Embeds".
- „Essenziell" = nur Auth-Session-Cookie → default akzeptiert, Rest opt-in.
- Später-Modal im Footer-Link „Cookie-Einstellungen" jederzeit änderbar.
- Admin-Panel für Consent-Kategorien: Name, Beschreibung, Default-State.
- Keine dritten-Party-Ressourcen (YouTube-Embeds, Google-Fonts) ohne aktiven
  Opt-in — auch nicht das ITSWEBER-Logo von `itsweber.de` (!). Default-Logo
  liegt nach Consent-Release in `play-assets`.

**Rechtliche Info am Video:**

- Report-Button auf jedem Video (Urheberrechtsverletzung / Verstoß gegen
  Nutzungsbedingungen / Spam) → Moderation-Queue im Admin.
- Takedown-Flow: Admin klickt „Takedown", Video wird `PRIVATE` + rote
  Takedown-Notiz, Creator bekommt Benachrichtigung.
- Altersbeschränkung als Flag (18+ Gate-Screen).

**Rechtliche Ansicht im Studio/Profile:**

- DSGVO-Auskunft: Button „Meine Daten exportieren" → JSON-Dump aller User-Daten.
- DSGVO-Löschung: „Account löschen" → Hard-Delete, Videos werden auf
  `author=null` anonymisiert oder gelöscht (User-Wahl).

### L · Page-Management-Authorization — Priorität P0

**Hart durchgesetzt im Backend:** nur `ADMIN` darf `PageBlock` (Ebene 6) +
`StaticPage` (Ebene Legal) editieren. Bisher ist das in `adminProcedure`
bereits enforced, aber dokumentarisch festhalten. Creator sehen in ihrem
Studio **keine** Links zu Seiten-Management — weder Startseite-Blöcke noch
Impressum/Datenschutz.

---

## Neue Session-Reihenfolge (PL-Entscheidung)

| Session | Scope | Dauer | Unlock |
| --- | --- | --- | --- |
| **Quick-Wins** (jetzt) | Logo-Filter `brightness0`/`invert`, Toast-System, Footer entschlacken, 404-Stubs | 30-45 min | User-sichtbare Lücken geschlossen |
| **Session 4** | **Studio-Ausbau**: Sidebar, Dashboard-Stats, Video-Edit-Seite mit allen Metadaten + Thumbnail-Picker + Kapitel | 3-4 h | Creator-Workflow komplett |
| **Session 5** | **Admin-Overhaul**: Sidebar, Dashboard, Video-Management, System-Panels, Moderation-Queue | 3 h | Admin auf Preview-Niveau |
| **Session 6** | **Navigation + Discovery**: `/channels`, `/subs`, `/library`, `/search`, Kategorien-Schema + Filter, YouTube-Style-Sidebar | 3 h | Alle Header-Links funktional |
| **Session 7** | **Community**: Comments-UI, Likes, Subscriptions (neues Schema + UI), Notifications | 3 h | Social-Layer aktiv |
| **Session 8** | **SEO + Sharing + Embed**: generateMetadata, JSON-LD, Sitemap, robots.txt, oEmbed, Share-Panel full-scope (12 Plattformen + Embed + Timestamp), `/embed/[slug]` | 2-3 h | Jeder Link shareable, jedes Video einbettbar |
| **Session 9** | **E-Mail-System + Admin-Gating-Audit**: nodemailer + SMTP-Admin-UI, 6 System-Templates mit Editor, Email-Verify + Password-Reset in Better-Auth, Notification-Preferences, Audit aller Branding-Routen (Logo/Theme/Pages) = admin-only | 3-4 h | Passwort-Reset + Verify funktionieren, Site-Branding 100 % admin-gated |
| **Session 10** | **Legal + Compliance**: StaticPage-CMS (`/admin/pages`), Cookie-Consent-Banner, Impressum/Datenschutz/AGB-Seeds, Takedown-Flow, DSGVO-Export/-Löschung | 3 h | DE-Launch-ready |
| **Session 11** | **Shorts + mehr Block-Typen**: Shorts-Feed + Rail + weitere 5 Block-Typen für Homepage | 2-3 h | YT-Feature-Parität |
| **Session 12** | **Prod-Deploy auf Unraid**: echter Build-Durchlauf, NPM-Proxy-Config, DNS, Smoke-Tests unter Last | 2 h | Intern online gehen |
| **Session 13** | **Git-History sauber aufsetzen**: `.gitignore`, License-Check, LICENSE (MIT/AGPL?), CONTRIBUTING.md, Conventional-Commits-Cleanup, Secret-Scan | 1-2 h | Release-ready Repo |
| **Session 14** | **GitHub-Veröffentlichung**: Repo push (itsweberde/itsweber-play), README mit Screenshots, Badges (build/license), GH-Actions-CI (typecheck + build), Release-Tag v0.3-beta, Issue-Templates | 2 h | Public auf GH |
| **Session 15** | **Unraid Community-Store**: Community-Applications-Template, XML-Manifest, Logo/Banner-Assets (512×512), Docker-Compose-as-Template-Konvertierung, PR an `Squidly271/AppFeed` | 2-3 h | Im Store listbar |
| **Session 16** | **itsweber.de-Launch**: Produktseite mit Feature-Liste + Screenshots + Video-Demo, Download-Bereich (Docker-Compose + Env-Template), Call-to-Action, SEO-Meta | 2 h | Öffentlich auffindbar |
| **Session 17** | **Dokumentation**: Installationsanleitung (Unraid, generisch Docker, Dev-Setup), Handbuch (Creator + Admin), Wiki auf GitHub mit 10+ Seiten, Video-Tutorial | 3-4 h | Support-ready |

**Gesamt-Zeit:** ~26 h bis v0.3 release-ready, +10-15 h bis öffentliches Release
(inkl. GH/Unraid/Docs).

**Launch-Blocker für öffentliches Release:** Session 9 (E-Mail) + Session 10
(Legal) **müssen vor** Session 12 (Prod-Deploy), sonst läuft die Plattform
ohne Passwort-Reset/Verify oder mit Abmahnungsrisiko am Tag 1.

### M · Release-Pipeline (Sessions 12-17) — Reihenfolge + Gate-Kriterien

Nichts geht auf GitHub/Community-Store, bevor die darunterliegende Version
nicht live auf Unraid stabil gelaufen ist. Gates:

**Gate 1 → Session 13 (Git-Setup):**

- Session 12 (Unraid-Deploy) erfolgreich, 48 h ohne Crash
- Keine bekannten FEATURE-blockierenden Bugs
- Theme + Studio + Admin + Community + E-Mail alle end-to-end auf Prod-Daten getestet

**Gate 2 → Session 14 (GitHub-Push):**

- `git-secrets`- oder `trufflehog`-Scan ohne Findings
- License gewählt (Empfehlung: **AGPL-3.0** passend zu MediaCMS/PeerTube-
  Nachbarschaft; alternativ **MIT** wenn kommerzielle Forks ok sind)
- README mit: Intro, Screenshots, Tech-Stack, Quickstart, Dev-Setup, Ports,
  Env-Vars, License, Credits
- `CONTRIBUTING.md`, `SECURITY.md`, Issue-Templates
- GitHub Actions: `typecheck` + `lint` + `build` pro Push
- Release-Tag `v0.3.0-beta` + Auto-generated Release Notes

**Gate 3 → Session 15 (Unraid Community Store):**

- GH-Repo public + 14 Tage ohne Critical-Bug-Report
- Banner 2048×512 + Icon 512×512 im ITSWEBER-Teal designt
- `templates/itsweber-play.xml` mit Volume-Mappings, Ports, Env-Vars,
  Post-Install-Notes (Default-Admin-Credentials ändern!)
- Minimal-Install-Flow getestet auf zweitem Unraid-Host
- PR an Community-Applications-Repo mit Changelog + Screenshot

**Gate 4 → Session 16 (itsweber.de):**

- Unraid-Listing akzeptiert
- Video-Demo aufgenommen (2-3 min)
- Pricing/Positionierung geklärt (falls kommerziell)

**Gate 5 → Session 17 (Docs):**

- Wiki: Erste-Schritte · Installation (Unraid+Generic) · Konfiguration
  (Env-Vars) · Admin-Handbuch · Creator-Handbuch · Troubleshooting · FAQ ·
  API-Referenz (aus tRPC abgeleitet) · Architektur · Contributing
- Feedback-Channel (GH Discussions an) eingerichtet

### N · Repository-Struktur für Public-GH

Aktuell lebt das Projekt in `c:\Users\…\ITSWEBER Play Docker`. Vor dem Push:

- **LICENSE**-Datei in Repo-Root
- **README.md**-Überarbeitung (aktuell Stub)
- **`docs/`** bleibt drin (Plan + Progress + Architektur — für Contributor wertvoll)
- **`previews/`** kann drin bleiben (als „Design-Snapshots" dokumentiert)
- **`.env`** NICHT committen (`.env.example` bleibt)
- **`.volumes/`**, **`.turbo/`**, **`node_modules/`**, **`.next/`** sind
  schon via `.gitignore` ausgeschlossen — prüfen.

### O · Marketing-Assets für Launch

Diese kommen parallel zu Session 14-15, nicht in separater Session:

- 4 Screenshots: Startseite (im Dark-Theme) · Studio-Dashboard · Theme-Editor
  live · Admin-Dashboard
- 15-20 sec Video-Loop (Theme-Preset-Switch → sichtbare Farbänderung) für
  itsweber.de-Hero
- Kurz-Claim: „Deine Video-Plattform. Komplett anpassbar. Kein Redeploy."
- Feature-Matrix-Grafik (Comparison: PeerTube vs. MediaCMS vs. Play)

## Features-Matrix — Update

Die bestehende `docs/07-features-matrix.md` wird ergänzt um:

| Feature | MVP | v0.2 | v0.3 | v1 |
| --- | :-: | :-: | :-: | :-: |
| Studio-Sidebar + Dashboard-Stats | | ✅ | | |
| Video-Edit (Titel/Desc/Tags/Thumb/Chapters) | | ✅ | | |
| Kanal-Profil + Branding (Banner, About) | | ✅ | | |
| Abonnenten-Liste im Studio | | ✅ | | |
| Studio-Analytics (Views/Watch-Time/Retention) | | | | ✅ |
| Admin-Sidebar + Dashboard | | ✅ | | |
| Video-Management global | | ✅ | | |
| Moderation-Queue + Report-Flow | | ✅ | | |
| System-Health-Panel (Queue/Storage/Logs) | | ✅ | | |
| `/channels`, `/subs`, `/library` | | ✅ | | |
| Postgres-FTS Search | | ✅ | | |
| Kategorien-Schema + klickbare Filter | | ✅ | | |
| YT-Style-Sidebar (Public) | | ✅ | | |
| Comments (Threaded) | | ✅ | | |
| Likes / Reactions | | ✅ | | |
| Subscriptions (Schema + UI) | | ✅ | | |
| In-App Notifications | | | ✅ | |
| Per-Video OG-Tags + JSON-LD | | ✅ | | |
| Sitemap + robots.txt | | ✅ | | |
| oEmbed-Endpoint | | | ✅ | |
| Share-Panel (12 Plattformen + Timestamp + Embed-Code) | | ✅ | | |
| Embeddable Player (`/embed/[slug]`, `?t=` Offset) | | ✅ | | |
| **SMTP-Admin-UI + 6 System-Templates** | | ✅ | | |
| **Email-Verify + Password-Reset end-to-end** | | ✅ | | |
| **Notification-Preferences (pro User)** | | ✅ | | |
| **Admin-Gating-Audit (Branding 100 % admin-only)** | | ✅ | | |
| **StaticPage-CMS (Admin-only)** | | | ✅ | |
| **Impressum/Datenschutz/AGB (Seeds)** | | | ✅ | |
| **Cookie-Consent-Banner + Kategorien** | | | ✅ | |
| **Takedown-Flow + Report-Button** | | | ✅ | |
| **DSGVO-Export / -Löschung** | | | ✅ | |
| Shorts-Format + Feed | | | ✅ | |
| Toast-System | | ✅ | | |
| Mehr Block-Typen (Row/Text/Featured/Trending/Shorts-Rail) | | | ✅ | |
| Logo-Filter `brightness0`/`invert` | | ✅ | | |
| Favicon-Upload | | | ✅ | |

## Definition of Done v0.2

- Creator kann alle Metadaten seines Videos editieren.
- Admin sieht Dashboard + System-Health.
- Alle Header-Links führen auf echte Seiten (keine 404).
- Jede geteilte `/watch/…`-URL hat OG-Preview + Sitemap-Eintrag.
- Comments + Likes + Subs funktionieren end-to-end.
- Toast-Feedback bei jeder Mutation.

## Definition of Done v0.3

- Theme-Editor hat Logo-Filter inkl. `brightness0`/`invert`, Favicon-Upload.
- 10+ Block-Typen für Homepage.
- Shorts-Feed.
- oEmbed + Embeddable-Player.
- Prod-Deploy auf Unraid läuft.
