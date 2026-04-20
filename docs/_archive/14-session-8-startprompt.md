# Session 8 — Startprompt (Copy-Paste)

Diese Datei existiert, damit du die nächste Session ohne Scroll-Suche starten
kannst. Alles drin, was Claude am Session-Anfang lesen muss.
Aktualisiert: Ende Session 7b (2026-04-17).

---

## Prompt zum Einkleben

```text
Wir bauen ITSWEBER Play weiter. Lies zuerst in dieser Reihenfolge:

1. CLAUDE.md — Projektübersicht + Konventionen
2. docs/11-progress.md — aktueller Stand bis Session 7b (Quick-Wins)
3. docs/13-gap-analysis-and-extended-plan.md — komplette Roadmap + Release-Pipeline
4. docs/07-features-matrix.md — Feature-Scope + Status pro Version
5. previews/home.html, previews/studio.html, previews/admin.html — Design-Ground-Truth

## Stand vor Session 8

**v0.1 + v0.2 sind DONE.** Kurzform:
- Studio + Admin komplett mit Sidebars, Dashboards, Editor, System-Panels
- Navigation + Discovery: /channels /subs /library /search /category/[slug] /shorts
- Community: Comments · Likes · Reports · Moderation · In-App-Notifications
- Theming Ebenen 1-6 inkl. Live-Editor, Presets, Custom-CSS, Block-Composer,
  Logo-Upload mit 10 SVG-Filtern, Audit-Log, SSE-Live-Sync
- Kategorien + Subscriptions + Worker-Shorts-Klassifikation + UploadMenu
- SVG-Icon-Library projektweit (keine Emojis)

## Session 8 — Scope: SEO + Social Sharing + Embed

Das ist die letzte große Feature-Session vor dem Legal-Runthrough (Session 9,
Launch-Blocker für DE). Danach kommen Shorts-Feed + weitere Block-Typen
(Session 10) und der Unraid-Prod-Deploy (Session 11).

### Muss in dieser Session

1. **`generateMetadata` in `/watch/[slug]/page.tsx`:**
   - og:title, og:description (aus description, truncated auf 160 Zeichen)
   - og:image = thumbnailUrl, og:image:width/height
   - og:video:url = master.m3u8, og:video:type = application/x-mpegURL
   - og:type = video.other, og:site_name
   - twitter:card = summary_large_image
   - twitter:player = /embed/[slug] (width 1280, height 720)

   **Problem:** /watch/[slug] ist aktuell Client-Component. Lösung: äußere
   Server-Component mit `generateMetadata` + `fetch()` gegen tRPC, inner
   bleibt Client. Die Duplikation (SSR-Fetch + Client-Query) ist ok.

2. **`generateMetadata` in `/c/[slug]/page.tsx`** analog für Channels:
   - og:title = displayName, og:description = description, og:image =
     optionales Avatar.

3. **JSON-LD Schema.org** als `<script type="application/ld+json">` im
   /watch-Head:
   - @type: VideoObject
   - name, description, thumbnailUrl, uploadDate, contentUrl, embedUrl,
     duration (ISO-8601), interactionStatistic (views), author (@type:
     Person, name, url)

4. **Sitemap**: Next 15 `app/sitemap.ts`. Alle PUBLIC+LIVE-Videos + Channels
   + statische Routen (/, /channels, /shorts, /impressum, /datenschutz, /agb).
   changefreq=daily für Videos, weekly für Channels.

5. **robots.txt**: `app/robots.ts`. Disallow `/admin/`, `/studio/`, `/api/`,
   `/login`, `/register`. Sitemap-URL aus PUBLIC_URL-env.

6. **oEmbed-Endpoint** `/api/oembed?url=…&format=json`:
   - Input: Video-URL (beliebige Watch-URL aus PUBLIC_URL-Host)
   - Output: `{type:"video", version:"1.0", html:"<iframe …>",
     thumbnail_url, thumbnail_width, thumbnail_height, title, author_name,
     author_url, provider_name:"ITSWEBER Play", width, height}`
   - Discord/Twitter/Slack/Notion/WP rendern daraus Link-Previews.
   - oEmbed-Discovery-Link im /watch-Head:
     `<link rel="alternate" type="application/json+oembed" href="…">`

7. **Embed-Player** `/embed/[slug]/page.tsx`:
   - Minimal-Frame (kein Header, kein Footer, kein Chrome)
   - HLS-Player füllt Viewport, keine Comments, kein Like-Button
   - Layout-File für `/embed` das Header+Footer auslässt
     (`app/embed/layout.tsx` mit eigenem minimalen Root)

8. **Share-Panel komplett umbauen** (Component existiert in
   `video-actions.tsx`). Neues Design als Popover mit Grid statt Liste:

   **Plattformen mit Web-Share-Intent (Icon + Label, öffnet neuer Tab):**
   - X / Twitter — `https://twitter.com/intent/tweet?url=…&text=…`
   - Facebook — `https://www.facebook.com/sharer/sharer.php?u=…`
   - LinkedIn — `https://www.linkedin.com/sharing/share-offsite/?url=…`
   - Reddit — `https://www.reddit.com/submit?url=…&title=…`
   - WhatsApp — `https://wa.me/?text=…`
   - Telegram — `https://t.me/share/url?url=…&text=…`
   - Pinterest — `https://pinterest.com/pin/create/button/?url=…&media=<thumb>&description=…`
   - E-Mail — `mailto:?subject=…&body=…`

   **Copy-Link-Fallback (kein zuverlässiger Web-Intent):**
   - TikTok — Button kopiert Link + Toast „Link kopiert — füge ihn in deinem
     TikTok-Post ein"
   - Instagram — analog („füge ihn in Story/Bio ein")

   **Embed-Code-Tab (Tab neben „Teilen"-Grid):**
   - Read-only-Textarea mit `<iframe src="{PUBLIC_URL}/embed/{slug}" width="560"
     height="315" frameborder="0" allow="autoplay; fullscreen"
     allowfullscreen></iframe>`
   - Copy-Button mit Toast-Feedback

   **„Starten bei MM:SS"-Toggle** (oberhalb des Grids):
   - Checkbox + MM:SS-Input (prefilled mit aktueller Player-Time via
     `video.currentTime`, gerundet auf Sekunden)
   - Wenn aktiv: alle URLs + Embed-Code bekommen `?t=<seconds>` angehängt
   - Player (`/watch` + `/embed`) liest `?t=` beim Mount + springt via
     `video.currentTime = n` vor `play()`

   **Icons:** Neue SVGs in [apps/web/src/components/icon.tsx](apps/web/src/components/icon.tsx):
   `brand-x`, `brand-facebook`, `brand-linkedin`, `brand-reddit`,
   `brand-whatsapp`, `brand-telegram`, `brand-pinterest`, `brand-tiktok`,
   `brand-instagram`, `embed-code`, `timestamp`. Feather-Style bleibt bei
   Aktions-Icons, Brand-Icons verwenden offizielle Simple-Icons-SVGs
   (MIT-lizensiert).

9. **Root-Layout** bekommt Fallback-OG-Tags (für Homepage/Channels/Shorts):
   - og:site_name, og:locale=de_DE, og:image = Default-Preview-Image

### Darf mitkommen wenn Kontext reicht

- Tag-Autocomplete-Dropdown in Header-Suche
- Channel-Avatar + -Banner-Upload (Schema-Slots `avatarAssetKey` +
  `bannerAssetKey` sind schon da)
- Favicon-Upload in `/admin/theme`

### Muss NICHT in dieser Session

- Postgres-FTS-Indizes (v0.3 später)
- YouTube-Style-Sidebar (Session 10)
- Watch-History + Watch-Later (Session 10)
- Shorts-Swipe-Feed (Session 10, Grid existiert schon auf /shorts)
- Legal-Pages CMS (Session 9)

## Technische Regeln (aus Memory)

- **SVG statt Emoji** überall. Icons kommen aus
  `apps/web/src/components/icon.tsx`. Neue Icons dort registrieren.
- **Design nach previews/*.html** ausrichten, nicht improvisieren
- **User = Architekt, Claude = PL**. Operative Entscheidungen führen,
  architektonische kurz rückspiegeln
- **Release-Pipeline beachten:** nichts auf GitHub bevor Session 11
  (Unraid-Prod-Deploy) erfolgreich war

## TypeScript-Falle dokumentiert

Prisma-`Json`-Felder (`chapters`, `socialLinks`, `tokensOverride`) in tRPC-
Responses triggern TS2589 beim Render. Pattern: lokales `*ForEdit`-Interface
+ doppelter `as unknown as`-Cast. Siehe `/studio/channel/page.tsx` und
`/watch/[slug]/page.tsx` als Templates.

## Dev-Setup-Reminder

- **Admin-Login:** `admin@itsweber.de` / `play-dev-admin`
- **Docker-Services** laufen weiter (Postgres/Redis/MinIO via
  `docker-compose.dev.yml`)
- **Node-Kill** bei Schema-Changes:
  `Get-CimInstance Win32_Process | Where { $_.Name -eq 'node.exe' -and
   $_.CommandLine -like '*ITSWEBER Play Docker*' } |
   ForEach { Stop-Process -Id $_.ProcessId -Force }`
- **Port 3000 freiräumen** falls EADDRINUSE:
  `Get-NetTCPConnection -LocalPort 3000 | Stop-Process -Id <OwningProcess>`
- **.next-Cache** löschen nach größeren Layout-Änderungen
- **Prisma-Migration-Flow**: `migrate dev --create-only --name <x>` dann
  `migrate deploy` — nicht interaktiv

## Nach Session 8

- `docs/11-progress.md` um Session 8 Nachtrag erweitern
- Startprompt für Session 9 (Legal + Compliance) als
  `docs/15-session-9-startprompt.md` anlegen
- Session 9 ist **Launch-Blocker für DE** — Impressum, Datenschutz, AGB,
  Cookie-Consent, StaticPage-CMS (`/admin/pages`) — **vor** allem
  Öffentlichen.

Starten: erste Aktion — drei Dev-Server hochziehen (`corepack pnpm --filter
@play/api dev` etc.) und bestätigen, dass der Session-7b-Stand noch grün ist
(alle 7 Packages typecheck, /shorts rendert, UploadMenu öffnet sauber).
Dann loslegen mit Schritt 1 (`generateMetadata` in /watch/[slug]).
```

---

## Was du tun musst um Session 8 zu starten

1. In Claude Code eine **neue Session** öffnen
2. Den kompletten Text oben (im Code-Block) in die erste Nachricht einfügen
3. Claude liest die 5 Refs, startet die Dev-Server, baut durch
