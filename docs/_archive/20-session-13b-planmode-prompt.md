# Session 13b — Opus Plan-Mode Prompt (Copy-Paste)

Dieses Dokument enthält den fertigen Prompt für eine neue Opus-Session im Plan Mode.
Einfach den Block unten kopieren und als erste Nachricht einfügen.

---

```
Du bist PL für das Projekt ITSWEBER Play Docker.
Lies zuerst: CLAUDE.md und docs/11-progress.md.
Dann plane — implementiere NOCH NICHT.

─── PROJEKTKONTEXT ────────────────────────────────────────────────────────────

Greenfield-Video-Plattform (Docker-Stack) als Ersatz für PeerTube + MediaCMS.
Stack: Next.js 15 (App Router, RSC) + Tailwind v4 + shadcn/ui | Fastify + tRPC + Better Auth + Prisma 6 | BullMQ + FFmpeg + yt-dlp | Postgres 16 | Redis 7 | MinIO | pnpm + Turborepo.

Sessions 1–12 sind durch. Lokaler E2E-Test (Session 12) hat alle 11 Punkte
bestanden. Vor dem Unraid-Deploy sollen aber die unten beschriebenen
Baustellen lokal fertiggestellt werden — erst danach wird deployed.

─── WAS BEREITS STEHT (nicht nochmal bauen) ──────────────────────────────────

✅ Auth (Register/Login/Session/Logout, CSRF, Better Auth)
✅ Upload → Transcode Pipeline (FFmpeg HLS 720p/480p/1080p, 5 Thumbnail-Kandidaten)
✅ yt-dlp-Import (YouTube etc. → MinIO → Transcode)
✅ HLS-Player (hls.js + Safari-native), Embed-Player /embed/[slug]
✅ Video-Sichtbarkeit (public/unlisted/private/logged_in), überall enforced
✅ Studio-Sidebar + Layout + folgende echte Seiten:
   /studio (Dashboard 4 Stats-Cards)
   /studio/videos (Tabelle + Filter + Delete)
   /studio/[id]/edit (Titel/Tags/Visibility/Kommentare/Kapitel/Thumbnail-Picker/Kategorie)
   /studio/upload (XHR-Upload + Progress)
   /studio/import (yt-dlp URL)
   /studio/channel (Name/Desc/About/SocialLinks)
✅ Studio-WIP-Stubs (nur Platzhalter, kein Code):
   /studio/analytics, /studio/branding, /studio/subscribers, /studio/settings
✅ Admin-Panel: Dashboard, Users, Videos, Theme-Editor, Page-Blocks, Categories, Moderation, Pages, System
✅ Admin-WIP-Stub: /admin/settings
✅ Theme-System Ebenen 1–6: Tokens, Semantic, Live-Editor, SSE-Fanout, Presets, Block-Composer
✅ Community: Like, Kommentare (threaded), Subscribe, Report, In-App-Notifications, Watch-History, Watch-Later
✅ Discovery: /, /channels, /subs, /library, /search, /category/[slug], /c/[slug]
✅ Shorts-Klassifikation (Worker: height>width && duration≤60s → SHORT), /shorts als Swipe-Feed (Session 10)
✅ Legal: /impressum, /datenschutz, /agb (StaticPage-CMS), Cookie-Consent-Banner
✅ SEO: generateMetadata, OG-Tags, JSON-LD VideoObject, Sitemap, robots.txt, oEmbed (/api/oembed auf Next.js)
✅ SVG-Icon-Library (Icon-Component, keine Emojis)
✅ Prod-Dockerfiles (api/web/worker) + docker-compose.yml (macvlan Unraid)
✅ Alle 12 Prisma-Migrations applied, DB aktuell

─── WAS JETZT GEBAUT WERDEN MUSS (Scope dieser Planungs-Session) ─────────────

## 1 — Header-Upload-Button: Komplett-Redesign

AKTUELL: `<UploadMenu>` — Split-Button mit Dropdown (+ Video | Chevron → Datei hochladen / Per URL importieren).
Steht im SiteHeader, sichtbar für alle (auch ausgeloggte User).

SOLL:
- Nur für eingeloggte User sichtbar (useSession guard)
- EIN einzelner Button, kein Dropdown, kein Chevron
- Label: „+ Erstellen" (oder nur „+"), Icon: plus SVG
- Klick → /studio/new
- Die /studio/new-Seite ist NEU und ersetzt /studio/upload + /studio/import als Einstieg:
  - 4 große Kacheln im Grid:
    1. VIDEO hochladen (Datei) → /studio/upload
    2. VIDEO importieren (URL) → /studio/import
    3. SHORT hochladen (Datei) → /studio/upload?format=short
    4. SHORT importieren (URL) → /studio/import?format=short
  - Jede Kachel: großes Icon, Titel, kurze Beschreibung (max 1 Satz), Hover-Lift
  - Kein Dropdown mehr — direkte Navigations-Kacheln
- /studio/upload und /studio/import lesen den ?format=short Query-Param und setzen
  beim Upload/Import das Ziel-Format vor (Video-Row wird mit format=SHORT angelegt;
  Worker klassifiziert trotzdem selbst final — der Param ist nur ein Hint im Titel-Preset)
- UploadMenu-Component in components/upload-menu.tsx BLEIBT vorerst für
  Studio-interne Stellen (Studio-Dashboard, Videos-Tabelle) — wird NICHT gelöscht,
  nur aus dem SiteHeader entfernt

## 2 — Shorts: Mobile-First-Swipe-Feed (Bugfix + Polish)

AKTUELL: /shorts ist ein vertikaler Swipe-Feed (Session 10 implementiert).
Laut User-Feedback: Shorts werden „als normales Video verarbeitet" — das ist
wahrscheinlich ein UX-Problem, nicht ein Backend-Bug (Worker klassifiziert korrekt).

PLAN:
- Verifizieren: Werden Shorts im Worker korrekt als SHORT klassifiziert?
  (height > width && durationSec ≤ 60)
- Prüfen ob /studio/upload bereits format=SHORT unterstützt oder ob der User
  weiß, dass er ein Hochformat-Video < 60s hochladen muss → Onboarding-Hinweis
- /shorts Swipe-Feed reviewen und für Mobile optimieren:
  - Scroll-Snap: container snap-y snap-mandatory, jeder Slide snap-start h-dvh
    (dvh statt vh — Safari iOS Bug mit der Adressleiste)
  - Autoplay nur muted (Browser-Policy); Unmute-Button prominent
  - Like-Button, Kommentar-Link, Channel-Link — alle in der rechten Overlay-Spalte
    (TikTok-Style: runde Buttons mit backdrop-blur)
  - Keyboard-Nav: ArrowUp/ArrowDown funktionieren
  - IntersectionObserver für aktiven Slide
  - Lazy-HLS: nur aktiver + nächste 2 Slides haben laufende HLS-Instanz
  - Loop: video.loop = true bei active
  - Empty-State wenn keine Shorts vorhanden
- Shorts-Upload-Onboarding: auf /studio/new in der SHORT-Kachel hint „Hochformat-Video,
  max. 60 Sekunden" prominent zeigen

## 3 — Studio: WIP-Stubs zu echten Seiten machen

### 3a — /studio/analytics

Was gezeigt werden soll (MVP, keine externe Metrik-Engine):
- Pro-Video-Tabelle: Titel | Views (gesamt) | Likes | Kommentare | Upload-Datum
  (alles schon in DB, nur aggregieren)
- Gesamt-Stats oben: Total Views, Total Watch-Time (Näherung: views × durationSec / 3600),
  Total Abonnenten, Videos LIVE
- Zeitraum-Filter: letzte 7 / 30 / 90 Tage (publishedAt-basierter Filter, kein
  echtes Zeitreihen-Schema nötig)
- Einfache Bar-Chart pro Video (views) — via CSS oder lightweight Chart (z.B. recharts,
  das wahrscheinlich schon in deps ist) — KEINE externen Analytics-Dienste

Backend:
- Neuer tRPC-Endpoint studio.analytics({ period: "7d"|"30d"|"90d" }) → {
    totalViews, totalWatchTimeH, totalSubscribers, totalVideosLive,
    topVideos: [{id, title, slug, views, likes, comments, durationSec}]
  }
- Kein neues Schema nötig — alles aus Video/Reaction/Comment/Subscription

### 3b — /studio/branding (Avatar + Banner Upload)

Was gezeigt werden soll:
- Channel-Avatar-Upload (quadratisch, max 2 MB, png/jpg/webp)
- Channel-Banner-Upload (16:9, max 4 MB, png/jpg/webp)
- Live-Preview: kleiner Channel-Header-Preview rechts
- Aktuell gesetztes Bild anzeigen mit „Entfernen"-Button

Backend:
- POST /api/studio/avatar + POST /api/studio/banner — analog zu /api/admin/theme/logo
  (admin-gated dort, hier owner-gated via session + channelId)
- Speichern in play-assets Bucket (existiert, hat anon-read Policy)
- Keys: avatar/<channelId>.<ext> + banner/<channelId>.<ext>
- Channel.avatarAssetKey + Channel.bannerAssetKey → Schema-Felder existieren bereits!
  (gesetzt in Session 4 als Slots, aber nie befüllt)
- tRPC channel.myChannel gibt avatarAssetKey + bannerAssetKey zurück → URL aus S3_PUBLIC_URL

### 3c — /studio/subscribers

Was gezeigt werden soll:
- Anzahl Abonnenten (groß, prominent)
- Liste der Abonnenten: Avatar-Kreis (Initials-Fallback) + Handle + Beitrittsdatum + notify-Status
- Paginiert (cursor-based, 50 pro Page)
- Wachstums-Hinweis: „+N in den letzten 7 Tagen"

Backend:
- Neuer tRPC-Endpoint studio.subscribers({ cursor?, limit? }) →
  { total, last7d, items: [{handle, displayName, avatarUrl, subscribedAt, notify}] }
- Query gegen Subscription-Table (existiert), joined User/Channel

### 3d — /studio/settings (User-Settings)

Was gezeigt werden soll:
- Abschnitt „Account": Display-Name ändern, Handle (read-only mit Erklärung),
  E-Mail-Adresse (read-only vorerst, Änderung via Admin)
- Abschnitt „Benachrichtigungen": Toggle für E-Mail-Benachrichtigungen pro Typ
  (new-comment, new-subscriber) — Daten landen in einer neuen kleinen Table
  NotificationPrefs oder direkt in User.notificationPrefs Json
- Abschnitt „Datenschutz": Button „Meine Daten exportieren" (JSON mit User-Row +
  Videos + Comments, kein Archive), Button „Account löschen" (mit Bestätigungs-
  Dialog → soft-delete: User.banned=true + E-Mail anonymisiert; Videos PRIVATE)
- Abschnitt „Passwort ändern": Altes PW + neues PW (2×) → POST /api/auth/change-password

## 4 — Admin: /admin/settings zu echter Seite machen

Was gezeigt werden soll (Site-Konfiguration):
- Abschnitt „Allgemein": Site-Name, Site-Description, Contact-E-Mail,
  Default-Locale (de/en), Default-Visibility für neue Videos (PRIVATE/UNLISTED)
- Abschnitt „Registrierung": Toggle „Registrierung offen" (open/invite-only/closed),
  Max-Upload-Size-Anzeige (aus Env, read-only)
- Abschnitt „Video-Defaults": Default commentsEnabled, Default-Category
- Abschnitt „Moderation": Auto-Private bei X Reports (zukünftig)

Backend:
- Neues Prisma-Modell SiteSettings (Singleton, id="singleton"):
  siteName, siteDescription, contactEmail, defaultLocale, registrationMode
  (OPEN/INVITE/CLOSED), defaultVisibility, defaultCommentsEnabled, defaultCategoryId
- Migration anlegen
- Neuer tRPC-Router admin.siteSettings.get (public, für SSR) +
  admin.siteSettings.update (admin-only)
- /api/auth/sign-up/email prüft registrationMode: CLOSED → 403, INVITE → later

─── TECHNISCHE CONSTRAINTS ───────────────────────────────────────────────────

- SVG-Icons via <Icon name="…" /> — kein Emoji
- Keine hardcodierten Farben — nur Design Tokens
- tRPC für alles (kein direkter DB-Zugriff aus Next.js-Routen)
- File-Uploads (Avatar/Banner) analog zu Logo-Upload: raw body via Content-Type-Parser,
  Whitelist png/jpg/webp, max-Size, direkt in MinIO gestreamt
- pnpm starten via: node "C:/Program Files/nodejs/node_modules/corepack/dist/pnpm.js"
- Windows-Dev: FFMPEG_PATH leer lassen → @ffmpeg-installer als Fallback
- Prisma migrate: zweischrittig (--create-only dann deploy) wegen Windows-DLL-Lock
- Typecheck muss nach jeder Session grün sein
- TS2589-Pattern für Prisma-Json-Felder: lokales Interface + as unknown as Cast

─── SKILLS DIE AKTIV GENUTZT WERDEN SOLLEN ──────────────────────────────────

Bitte diese Skills explizit einbeziehen:
- `ui-styling` — shadcn/ui + Tailwind v4 für alle neuen UI-Komponenten
- `frontend-design` — /studio/new Upload-Hub als visuell hochwertigen Einstieg

─── DELIVERABLE DIESER PLANUNGS-SESSION ─────────────────────────────────────

Erstelle einen konkreten, sequenziellen Implementierungsplan:
1. Für jede der 4 Haupt-Änderungen (Header, Shorts, Studio-Stubs, Admin-Settings):
   - Genau welche Dateien werden neu angelegt / geändert
   - Schema-Änderungen (Migrations)
   - tRPC-Endpoints (Procedure-Name + Input/Output-Shape)
   - UI-Screens (Route + was zu sehen ist)
2. Reihenfolge: Schema-Änderungen immer zuerst, dann Backend, dann Frontend
3. Prüfen ob etwas aus der bestehenden Codebase wiederverwendet werden kann
   (analog zu Logo-Upload für Avatar/Banner, analog zu studio.dashboard für analytics)
4. Risiken + Stolpersteine benennen (Windows-Dev, TS2589, etc.)
5. Schätzung: wie viele Implementierungs-Sessions (à ~2h) braucht das?

Implementiere noch NICHT — nur planen.
```
