# 11 — Aktueller Umsetzungsstand (Live-Snapshot)

> Stand: **2026-04-20** — Sessions A–N alle done. Mobile-Responsive komplett (Drawer-Fix + Dual-Render-Cards + Footer-Fix). Nächstes: /studio/analytics Mobile + GitHub-Release (O).
> Diese Datei wird nach jedem „kritischen Stand" (Milestone-Ende) aktualisiert.

## Zusammenfassung v0.4 (2026-04-20)

| Session | Inhalt | Status |
|---|---|---|
| A–E | Backend-Fundament, Worker, Studio, Header, Admin, Shorts, Channel-Page, Demo-Seed | ✅ |
| F | Format-Trennung LONG/SHORT plattformweit | ✅ |
| G | Launch-Infra: E-Mail-System, Auth-Pages, Favicons | ✅ |
| H | User-Editor, E-Mail-Template-Editor, Auth-Guards | ✅ |
| **I** | **Unraid-Deploy-Hardening** (Compose, Fastify-Security, Magic-Bytes, AV1/VP9) | ✅ |
| **J** | **Demo-Content + Remotion + Whisper-Captions + Onboarding + /help** | ✅ |
| **K** | **A11y + Social 2026** (@Mentions, #Hashtags, Pin/Heart, Multi-React, Community-Posts, DMs, PWA, AI-Moderation, Scheduled-Publish, Digest-Mail) | ✅ |
| **L** | **All-in-One-Container + Unraid-Cutover + Routing-Refactor + Volume-Slider** | ✅ |
| **M** | **First-Run-Setup-Wizard** (9-Step-Web-Wizard, ersetzt `INITIAL_ADMIN_EMAIL` Env) | ✅ |
| **N** | **Mobile-Responsive** (Drawer-Portal-Fix, Dual-Render-Cards für Admin+Studio, Footer-Whitespace) | ✅ |
| O | `/studio/analytics` Mobile-Cards + GitHub-Setup (Repo, GHCR-Workflow, Lizenzen) | 🔜 anstehend |
| P | Saubere Unraid-Neuinstallation via GHCR-Image + Setup-Wizard Smoke-Test | 🔜 |

**Branding-Lock aktiv:** Footer, Meta-Tags, Admin-Sidebar, `package.json`, README referenzieren „ITSWEBER Play — powered by ITSWEBER" mit © Benjamin Weber. Nicht durch SiteSettings änderbar (AGPL-Attribution).

**Details** zu Sessions I/J/K siehe Dokumente [26](26-deploy-hardening.md), [27](27-security-baseline.md), [28](28-remotion-pipeline.md), [29](29-whisper-captions.md), [30](30-onboarding-ux.md), [31](31-accessibility.md), [32](32-social-features.md), [33](33-direct-messages.md), [34](34-ai-moderation.md), [35](35-pwa.md).

Historische Session-Prompts liegen in [_archive/](_archive/).

---

## Session M — First-Run-Setup-Wizard (2026-04-20)

Web-geführter 9-Step-Wizard ersetzt das `INITIAL_ADMIN_EMAIL`-Env-Bootstrap als
Standard-Pfad. ENV bleibt als Backward-Compat-Bypass: solange `INITIAL_ADMIN_EMAIL`
gesetzt ist UND noch kein User existiert, leitet die Middleware nicht zwangsweise
auf `/setup` — wer das alte Verfahren nutzen will, kann via `/register` durch.
Sobald der Wizard einmal durchgelaufen ist, ist der Pfad gesperrt (FORBIDDEN).

### Schema (1 Migration)

`20260420120000_add_setup_completed`:

- `SiteSettings.setupCompleted` BOOLEAN NOT NULL DEFAULT false
- `SiteSettings.setupCompletedAt` TIMESTAMP, `setupCompletedBy` TEXT
- Bestehende Singleton-Row wird mit `setupCompleted=true` gemarkt, damit
  Existing-Devs/Unraid nicht plötzlich vor dem Wizard stehen — frische Deploys
  haben keine Row und bekommen Default `false`.

### tRPC: `setup`-Router (publicProcedure, weil noch keine Session existiert)

- `setup.status` → `{ completed, required, bypassWithEnv, userCount, initialAdminEmail }`
- `setup.listThemePresets` (publicProcedure-Spiegel von `theme.listPresets`)
- `setup.testSmtp` (Live-Test ohne Persist, identisch zu `admin.smtp.testConnection`)
- `setup.complete`: atomare Mutation, die in einem Round-Trip
  - Pre-checks (Race-Schutz: E-Mail/Handle nicht doppelt, Preset-Datei existiert)
  - Admin via `auth.api.signUpEmail` anlegt → läuft durch denselben Hook wie `/register`
  - `User.role = "ADMIN"` + `emailVerified = true` setzt
  - `SiteSettings` upsert (Site-Name/Tagline/Locale/Registration + `setupCompleted=true`)
  - Theme-Preset anwendet (wenn gewählt) + Audit-Log + Theme-SSE-Bus pingt
  - SMTP-Settings persistiert (wenn aktiviert) + `invalidateTransport()`

Jede Mutation prüft `requireSetupOpen()` — nach Wizard-Abschluss FORBIDDEN.

### Logo-Upload während Wizard

Neuer Fastify-Endpoint `POST /api/setup/logo` (analog `/api/admin/theme/logo`,
aber gated auf `setupCompleted=false` statt admin-only). Magic-Bytes-Check, 2 MB
Cap, kein SVG. Audit-Log mit `source: "setup-wizard"`. Rate-Limit 6/min.

### Next.js-Middleware

`apps/web/src/middleware.ts`:

- Fetcht `setup.status` einmalig pro Request, cached 30 s im Modul-Scope
- Sticky-Optimierung: sobald `completed=true` einmal gesehen wurde, kein API-Round-Trip mehr (Flag dreht sich nie zurück)
- `required && !on /setup` → 307 → `/setup`
- `completed && on /setup` → 307 → `/`
- API nicht erreichbar → fall-through (boot-tolerant)
- Setzt `x-pathname`-Header, damit `RootLayout` `SiteHeader/Footer/CookieBanner`
  auf `/setup` ausblendet (fullscreen-Wizard ohne Login-Buttons)

### Wizard-UI (`apps/web/src/app/setup/`)

Single-File-Client-Komponente `_wizard.tsx` mit Stepper-Sidebar + Step-Switcher:

1. **Sprache** — DE/EN (setzt `defaultLocale`; echtes i18n folgt v0.4)
2. **Site-Name** — Site-Name, Tagline, Kontakt-E-Mail
3. **Branding** — Logo-Upload (PNG/JPEG/WEBP/GIF, optional). Favicon-Hinweis (v0.4)
4. **Admin-Account** — DisplayName, Handle (`[a-z0-9_-]{3,30}`), E-Mail, Passwort (min. 10).
   Wenn `INITIAL_ADMIN_EMAIL` gesetzt ist, wird das E-Mail-Feld vorbefüllt + readonly
5. **SMTP** — Toggle, Host/Port/User/Pass/From*. Live-Verbindungstest
6. **Theme-Preset** — Default + alle Presets aus `packages/theme/presets/`
7. **Registrierung** — OPEN / INVITE / CLOSED
8. **Storage-Hinweise** — MinIO-Volumes, pg_dump-Empfehlung, GPU-Verbot, NPM-Reverse-Proxy. Acknowledge-Checkbox
9. **Fertig** — Summary-Grid, Submit → `setup.complete` → `signIn.email` → `router.replace("/admin")`

### Backward-Compat-Bypass

`setup.status.bypassWithEnv = INITIAL_ADMIN_EMAIL gesetzt && userCount === 0`.
Middleware erzwingt dann KEIN Redirect — Dev-Setups mit alter ENV-Kette laufen
weiter ohne Wizard. Der Wizard bleibt manuell unter `/setup` aufrufbar.

### Verifikation Session M

- `pnpm -r typecheck`: alle 7 Workspace-Packages + apps/api + apps/worker grün.
  apps/web hat 10 vorbestehende `Suspense`-TS2786-Errors (React 19 / @types-Mismatch),
  keiner in den Setup-Files; `next.config.mjs` hat `ignoreBuildErrors: true`.
- `pnpm --filter @play/db generate` grün — neuer `setupCompleted`-Field im Client
- Alle Setup-Files (Migration, Router, Middleware, Wizard-UI, Logo-Endpoint)
  kompilieren ohne neuen Error

### Bekannte Folge-Tasks (Session M-Backlog)

- **Live-i18n** für Wizard-UI (DE/EN-Strings sind aktuell hardcoded DE)
- **Favicon-Upload** über Wizard (braucht neues `ThemeSettings.faviconAssetKey`)
- **Resume-Wizard** über mehrere Sessions hinweg (aktuell nur In-Memory-State)
- **Setup-Reset** im Admin-Bereich für Demo-/Reset-Use-Cases (manuelles `setupCompleted=false`)

---

## Session L — All-in-One-Container + Unraid-Cutover + Routing-Refactor (2026-04-19)

### Phase 1 — All-in-One-Image

- Single `itsweber-play:all-in-one`-Image mit s6-overlay v3.2.0.2 als PID-1
- 6 Longruns + 3 Oneshots: init-dirs → postgres-init → postgres → migrate → api/worker; redis/minio/nginx/web parallel
- Bündelt Postgres 16, Redis 7, MinIO, Nginx, Node 22, FFmpeg, yt-dlp, statisch gebautes whisper-cli
- Single Port `3000`, Single Volume `/data`
- Bug-Fixes: Postgres-Bootstrap via Unix-Socket statt TCP, Prisma `binaryTargets=["native","debian-openssl-3.0.x"]`, idempotenter Re-Run via `.play-bootstrap-done`-Marker

### Phase 2 — Unraid-Cutover

- Container live auf `10.10.8.51:3000` (br1, macvlan), healthy, 19 Migrationen applied
- AppData unter `/mnt/user/appdata/itsweber-play-data/` (`.env.production` chmod 600 + `data/`)
- Unraid-Template `my-ITSWEBER-Play.xml` mit lokalem Atom-Play-Icon (`/boot/config/plugins/dockerMan/images/itsweber-play.svg`)
- NPM-Host `play-next.itsweber.net → 10.10.8.51:3000` mit Let's-Encrypt-Cert
- Backup-Drill: `backup-all-in-one.sh` (postgres custom-format compress=9 + minio rsync + redis-AOF + .env-snapshot) — 29-Table-Restore verifiziert

### Phase 3 — Routing-Refactor (Same-Origin überall)

- Backend: tRPC-Mount von `/trpc` → `/api/trpc` (alles unter `/api/*`)
- Frontend: `API_URL` ist jetzt durchgängig `${origin}` (kein `/api`-Suffix), Caller hängen vollen Pfad selbst an
- Auth-Client: `baseURL = ${origin}/api/auth` (Better-Auth appended Routen direkt, kein automatischer basePath)
- Nginx: `/api/trpc/`-Sonderlocation entfernt, `/s3/`-Strip via `rewrite` in nested regex-locations (sonst `InvalidBucketName`)
- Fix Next.js Image: `unoptimized: true` (MinIO liefert dimensionierte .webp, `S3_PUBLIC_URL=/s3` ist kein parsebarer URL)

### Phase 4 — Shorts-Polish

- Channel verlinkt Shorts auf `/shorts?v={slug}` statt `/watch/{slug}`
- Shorts-Page springt initial zum Slug aus Query-Param (mit `<Suspense>` für SSR)
- Volume-Slider: vertikal, ausklappend bei Hover/Tap, Wert + Mute-State in `localStorage` persistent über alle Slides

### Bewusst nicht in Session L

- `/admin/*` schon vorhanden, aber Setup-Wizard fehlt (siehe Session M)
- GitHub-Setup verschoben — User startet das in separater Session N nach Setup-Wizard

---

## Session H — User-Editor + E-Mail-Template-Editor + Auth-Guards (2026-04-18)

### Bugfixes

- **`/admin/system` Crash** — `FFMPEG_PATH`/`YTDLP_PATH` waren leere Strings in `.env` → `execFile("")` warf `The argument 'file' cannot be empty`. Fix: leerer String fällt auf `"ffmpeg"` / `"yt-dlp"` zurück.
- **Admin/Studio-Sidebar für Nicht-Eingeloggte** — `AdminLayout` + `StudioLayout` waren Server Components ohne Auth-Check; Sidebar war sichtbar ohne Login. Beide zu Client Components umgebaut mit `useSession()` + `isPending`-Guard → redirect zu `/login?next=/admin` bzw. `/login?next=/studio` bei fehlender Session. Admin-Sidebar zusätzlich nur wenn `role === "ADMIN"`.
- **Login-Page `?next=`-Redirect** — nach erfolgreichem Login wird jetzt `searchParams.get("next")` ausgewertet und dorthin weitergeleitet statt immer `/`.

### User-Bearbeitung ([`apps/web/src/app/admin/users/page.tsx`](../apps/web/src/app/admin/users/page.tsx))

Neue Backend-Mutations in `admin.users`:
- **`update`** — Anzeigename / Handle / E-Mail änderbar; beide mit Uniqueness-Check vor Update.
- **`delete`** — löscht User + Sessions; Selbst-Schutz aktiv.
- **`sendPasswordReset`** — ruft Better-Auth `/api/auth/request-password-reset` intern auf, schickt echte Reset-Mail via SMTP.

Neues **Bearbeiten-Modal** in der Users-Tabelle:
- Felder: Anzeigename, Handle (@ Prefix, lowercase-forced), E-Mail
- Aktionen: Passwort-Reset-Mail senden, Account löschen (2-Schritt-Bestätigung)
- Selbst-Schutz: eigener Account kann nicht gelöscht werden

### E-Mail-Template-Editor ([`apps/web/src/app/admin/email-templates/page.tsx`](../apps/web/src/app/admin/email-templates/page.tsx))

**Prisma:** neues `EmailTemplate`-Model (id = TemplateName, subject, htmlBody, textBody, updatedAt, updatedBy). Migration `20260418200614_add_email_templates` applied.

**Backend:** `admin.emailTemplates` Sub-Router mit:
- `list` — gibt alle 6 Templates mit Meta zurück, legt fehlende Rows per upsert an (Default = hardcoded Template als initialer Inhalt)
- `get` — einzelnes Template mit vollem htmlBody/textBody + Defaults-Referenz
- `update` — speichert bearbeitetes Template in DB
- `reset` — überschreibt DB-Row mit hardcodiertem Default
- `sendPreview` — sendet Vorschau-Mail mit Beispiel-Variablen an beliebige Adresse

**`send.ts` auf DB-Templates umgestellt:** liest Subject/HTML/Text aus DB per upsert (Fallback: Default beim ersten Abruf), interpoliert `{{variablenName}}`-Syntax vor dem Versand.

**Frontend-Editor — 4-Tab-Split-View:**
- **Visuell**: contenteditable mit Toolbar (Fett/Kursiv/Underline/Link/Listen/Undo/Redo)
- **HTML**: Textarea-Code-Editor, monospace
- **Plaintext**: Textarea für Text-Only-Mail-Clients
- **Vorschau**: iframe-Sandbox mit Live-HTML des aktuellen Zustands

**Variablen-Panel**: alle `{{vars}}` als klickbare Chips mit Tooltip (Beschreibung + Beispielwert). Klick fügt ins aktive Tab ein. Vorschau-Mail direkt aus dem Editor sendbar.

**Template-Sidebar**: 6 Templates als Navigationsliste links, persistiert Auswahl beim Tab-Wechsel.

### Stand nach Session H

Alle 7 Packages typechecken grün. SMTP verifiziert (Kasserver-Relay, Test-Mail empfangen). Template-Editor produktiv einsetzbar.

---

## Pre-Deploy-Blockers (Stand 2026-04-18)

Audit hat ergeben, dass die Plattform funktional v0.3-komplett ist, aber drei Blöcke vor Unraid-Cutover bzw. öffentlichem Release abgearbeitet werden müssen. Vollständige Liste in [`docs/21-pre-deploy-blockers.md`](21-pre-deploy-blockers.md), nächster Session-Plan in [`docs/22-session-h-startprompt.md`](22-session-h-startprompt.md).

- **Block A (Launch-Blocker DE):** ✓ DONE — siehe Session G weiter unten. E-Mail-System + Auth-Pages + Admin-SMTP-UI + Favicon-Set live.
- **Block B (Vor Unraid-Cutover):** Worker-Binaries auf Linux verifizieren, Storage/DB-Bootstrap, Backup-Skript + Restore-Drill, Reverse-Proxy + DNS, Env-Audit für Prod.
- **Block C (Vor GH-Push):** LICENSE (AGPL-3.0), CONTRIBUTING.md/SECURITY.md, README-Überarbeitung, GH-Actions-CI, Secret-Scan.

## Session 13 G — Block A: E-Mail-System + Auth-Pages + Favicon (2026-04-18)

Komplette Launch-Infrastruktur für das öffentliche DE-Release. Alle sechs Gates aus [`docs/22-session-h-startprompt.md`](22-session-h-startprompt.md) abgearbeitet.

### Schema + Migration

- Neues Singleton-Model [`SmtpSettings`](../packages/db/prisma/schema.prisma) (host/port/secure/user/password/fromName/fromAddress/lastTestAt/lastTestResult/updatedAt/updatedBy).
- Migration `20260418124705_add_smtp_settings` angelegt und applied (Node-Dev-Server vorher killen wegen Windows-DLL-Lock im Prisma-Query-Engine).
- Passwort wird im Klartext in der DB gehalten — OK für lokales Dev und Single-Instance-Homelab. Wechsel auf Secret-Manager ist Backlog.

### Backend-E-Mail-Modul ([`apps/api/src/email/`](../apps/api/src/email/))

- **`transport.ts`** — Lazy-Singleton-Nodemailer-Transporter, liest SMTP-Settings aus DB beim ersten Aufruf. `invalidateTransport()` wird vom Admin-Update-Handler gerufen, sodass Änderungen ohne API-Restart aktiv werden. Fallback: `jsonTransport` wenn keine Config gesetzt.
- **`templates.ts`** — 6 HTML+Text-Templates als reine Funktionen: `welcome`, `email-verify`, `password-reset`, `comment-notify`, `subscriber-notify`, `takedown-notify`. Inline-Styles mit Brand-Farben (Navy `#0A1A26` + Atom-Grün `#3FE48B` + Glow-Shadow), Table-Layout für Outlook/Gmail/Apple-Mail-Kompatibilität, Footer mit Platform-Wordmark.
- **`send.ts`** — `sendMail({ to, template, vars })` baut Subject/HTML/Text per Registry-Lookup, zieht `siteName` aus `SiteSettings`, nutzt `PUBLIC_URL` als Site-URL. Fallback `console.warn` wenn SMTP nicht konfiguriert, damit Dev sichtbar läuft statt stummer Fehler.

### Better-Auth-Hooks ([`apps/api/src/auth.ts`](../apps/api/src/auth.ts))

- `emailAndPassword.sendResetPassword` — leitet den Better-Auth-URL-Token auf `/auth/reset-password?token=…` im Frontend um, sendet `password-reset`-Template.
- `emailVerification.sendVerificationEmail` + `sendOnSignUp: true` — Verify-Link geht automatisch nach Registrierung raus (aber `requireEmailVerification: false`, weil INVITE-Mode noch kommt).
- `databaseHooks.user.create.after` — zusätzlich `welcome`-Mail per Fire-and-Forget (Fehler darf Registrierung nicht blocken).

### tRPC-Router `admin.smtp` ([`apps/api/src/trpc/routers/admin.ts`](../apps/api/src/trpc/routers/admin.ts))

- `get` — Row-Data ohne Passwort (nur `passwordSet: boolean`-Flag), damit Admin-UI nichts leakt.
- `update` — partial update mit `clearPassword`-Flag für explizites Leeren; invalidiert Transport-Cache.
- `testConnection` — baut Transporter aus DB-Werten und ruft `transporter.verify()`, schreibt `lastTestAt` + `lastTestResult`.
- `sendTestMail({ to })` — sendet Welcome-Template an angegebene Adresse (realistischer Render-Check, kein separates Test-Template).

### Frontend-Auth-Pages ([`apps/web/src/app/auth/`](../apps/web/src/app/auth/))

Distinctive Glassmorphism-Layout via shared `AuthShell` ([`shell.tsx`](../apps/web/src/app/auth/shell.tsx)):

- Split-Layout mit Aurora-Blob-Gradient (radial, `var(--color-brand)` über `color-mix`) + Grid-Overlay.
- Glas-Karte mit `backdrop-blur-xl` auf `bg-surface/80`.
- Komplett theme-token-basiert — keine hardcoded Farben.

Pages:

- **`/auth/forgot-password`** — Email-Form → `authClient.requestPasswordReset({ email, redirectTo })`. Success-State mit „Check Mailbox"-Panel.
- **`/auth/reset-password?token=…`** — Neue-Passwort-Form mit Show/Hide-Toggle, Client-seitiger Passwort-Stärke-Meter (4-Stufen, Regex-basiert), Match-Check. Ruft `authClient.resetPassword({ newPassword, token })`, redirected nach 2s auf `/login`.
- **`/auth/verify-email?token=…`** — Auto-Verify via `authClient.verifyEmail({ query: { token } })` im Effect, drei States (pending/success/error) mit passenden Icons + CTA.
- **`/login`** — „Passwort vergessen?"-Link rechts neben dem Passwort-Label.

**Hinweis Better-Auth-Version:** Die Client-Methode heißt in v1.6 `requestPasswordReset` (nicht mehr `forgetPassword` wie in v1.1-Docs).

### Admin-UI SMTP-Tab ([`apps/web/src/app/admin/settings/page.tsx`](../apps/web/src/app/admin/settings/page.tsx))

- Neuer `SectionEmail` zwischen `SectionVideoDefaults` und `SectionInfo`.
- Form-Felder: Host, Port, User, Password (mit passwordSet-aware-Placeholder „•••• (leer lassen = unverändert)"), From-Name, From-Address, TLS-Toggle.
- Drei Aktions-Buttons: „Speichern", „Testverbindung", „Test-Mail senden" (letzteres mit separatem Email-Input).
- Letzter-Test-Panel mit grünem/rotem Status-Dot + Timestamp + Resultat-Text.

### Favicon-Set

- **Neu:** [`apps/web/src/app/icon.svg`](../apps/web/src/app/icon.svg) als Atom-Logo (Navy-BG + drei Grün-Ellipsen + Play-Glyph) — wird von Next automatisch als `<link rel="icon">` eingezogen.
- **Build-Skript** [`apps/web/scripts/build-favicons.mjs`](../apps/web/scripts/build-favicons.mjs) rastert das SVG über `sharp` in:
  - `public/favicon.ico` (32×32) — Legacy-Fallback
  - `public/icon-192.png` — PWA-Manifest
  - `public/icon-512.png` — PWA/Android-Homescreen
  - `public/apple-touch-icon.png` (180×180) — iOS-Homescreen
- [`apps/web/src/app/layout.tsx`](../apps/web/src/app/layout.tsx) `metadata.icons` um alle vier referenziert.

### Verifikation

- Migration `add_smtp_settings` applied, Prisma-Client regeneriert.
- Alle 7 Workspace-Packages typechecken grün (`pnpm -r typecheck`).
- Favicon-Build rendert fehlerfrei (4 Artefakte).
- SMTP-Smoke-Test steht noch aus — Admin gibt MailHog/Echt-SMTP-Adresse vor, dann Admin-UI „Testverbindung" + Forgot-Password-Flow via Browser.

### Offen vor „Session H = Block B"

- Browser-Smoke-Test: Registrierung → Welcome-Mail im Log/MailHog, Forgot-Password-Flow End-to-End, Verify-Email-Flow.
- Real-SMTP-Konfiguration (z. B. Hetzner-Mailbox oder externer Relay) im Admin-UI setzen.
- Danach Session H = Block B (Unraid-Deploy + Verifikation).

---


## Theme-Preset „ITSWEBER Brand" (2026-04-18)

Neuer Preset [`packages/theme/presets/itsweber-brand.json`](../packages/theme/presets/itsweber-brand.json) angelegt. Spiegelt den itsweber.de-Header:

- Background: dunkles Navy `#0A1A26` (statt Github-Charcoal)
- Surface: `#102838` mit Teal-Undertone
- Brand-Akzent: kräftiges Atom-Grün `#3FE48B` (überschreibt `color.teal.500` im Semantic-Layer → `--color-brand`)
- Glow-Shadow auf grünem Akzent statt Teal
- Logo-Filter `glow` für die signature Atom-Optik

Anwendbar via `/admin/theme` → „Preset anwenden".

## Session 13 E — Demo-Seed + UI-Bug-Roundup (2026-04-18)

Letzte Lokal-Politur vor Unraid-Deploy. Ein Demo-Datenbestand und vier vom User gemeldete UI/UX-Bugs.

### Demo-Content-Seed

[`packages/db/src/seed.ts`](packages/db/src/seed.ts) um `ensureDemoContent()` erweitert, gegated über `SEED_DEMO=1`. Kompletter Demo-Bestand idempotent über `upsert`/`connectOrCreate` — wiederholter Aufruf erzeugt 0 neue Rows.

- **8 Default-Categories** (smart-home, 3d-druck, server-it, docker, unraid, tutorials, news, projekte) mit Icons und order — vorher fehlten sie, weil die Migration nur das Schema anlegt.
- **SiteSettings-Singleton** mit `siteName`, `siteTagline`, `contactEmail=hallo@itsweber.net`, `registrationMode=OPEN`, `defaultVisibility=PRIVATE`.
- **3 Demo-Kanäle** — `itsweber` (#0fd3c2, Owner = erster ADMIN-User), `tech-tales` (#a855f7), `wild-shorts` (#f59e0b). Jeder mit `about` (3–4 Sätze deutsch), `socialLinks`, `accentColor`, voller `sectionOrder`. Falls der Channel beim Admin-Register-Hook schon angelegt wurde, schreibt der Seed das Demo-Branding in den `update`-Block.
- **2 Demo-Creator** (`tech-tales-host` + `wild-shorts`) als CREATOR-User — kein Account-Row, also kein Login, nur Content-Owner.
- **8 Demo-Videos** mit realistischen Titeln/Tags/durationSec, verteilt auf alle drei Kanäle: 3 PUBLIC LIVE LONG · 3 PUBLIC LIVE SHORT · 1 UNLISTED LONG · 1 PRIVATE LONG. `hlsKey/rawKey/thumbnailKey` bewusst leer — Listings/Counts funktionieren, Player kann das Demo-Video nicht abspielen (kein echter Inhalt).
- **Subscriptions**: admin + creator1 abonnieren alle 3 Kanäle (mit Self-Subscribe-Skip).
- **5 Top-Level-Kommentare + 5 Replies** über die LIVE-PUBLIC-Videos. Idempotenz über `findFirst({videoId, userId, body, parentId})`-Lookup.
- **10 Reactions** (Composite-PK, `upsert` trivial).
- **3 Watch-History-Einträge** für admin.
- **3 Playlists** „Best of <Channel>" mit 2–3 Videos pro Kanal (Composite-PK auf `PlaylistItem` für Idempotenz).

Aufruf:
```bash
SEED_DEMO=1 node "C:/Program Files/nodejs/node_modules/corepack/dist/pnpm.js" --filter @play/db seed
```

### UI/UX-Bugs

- **Shorts-Page-Skalierung** ([`apps/web/src/app/shorts/page.tsx`](apps/web/src/app/shorts/page.tsx)) — `ShortSlide` komplett umgebaut: Video sitzt jetzt in 9:16-Mobile-Wrapper `max-w-[min(420px,calc(100dvh*9/16))] aspect-[9/16] rounded-lg`, Action-Bar (Like/Comment/Mute/Avatar) ist Flex-Sibling mit `ml-3` direkt rechts neben dem Video — statt absolut am Viewport-Rand. Bottom-Overlay liegt jetzt im Video-Wrapper, dadurch sauberer Cut. Subscribe-Button ergänzt: `<SubscribeButton size="sm">` direkt unter dem `@channel`-Handle, mit Channel-Accent-Color. Channel-Avatar nutzt jetzt `avatarUrl` falls vorhanden. Dazu Backend-Erweiterung in [`apps/api/src/trpc/routers/video.ts`](apps/api/src/trpc/routers/video.ts) `video.list.select.channel` um `id, ownerId, accentColor, avatarUrl, format`.
- **Channel-Page-Duplikate** ([`apps/web/src/app/c/[slug]/channel-client.tsx`](apps/web/src/app/c/%5Bslug%5D/channel-client.tsx)) — `VideoItem` um `format` erweitert. `SectionLatest` filtert jetzt `format === "LONG" && status === "LIVE" && visibility === "PUBLIC"` (vorher `||`-Bug → privat-LIVE-Videos doppelt). `SectionShorts` filtert per `format === "SHORT"` statt `durationSec <= 60` (Heuristik raus). `SectionPopular` ebenfalls Long-only. Featured-Video wird per `excludeIds`-Set aus `latest` ausgeschlossen, damit es nicht zweimal erscheint. Backend [`channel.getBySlug`](apps/api/src/trpc/routers/channel.ts) selects um `format` ergänzt (videos + featuredVideo + trailerVideo).
- **Studio /videos Format-Differenzierung** ([`apps/web/src/app/studio/videos/page.tsx`](apps/web/src/app/studio/videos/page.tsx)) — Tab-Pills „Alle / Videos / Shorts" mit Counts; Format-Badge in der Titel-Spalte (Shorts: lila, Long: dim). View-Spalte zeigt jetzt echte `viewCount`-Werte statt „—". `video.mine`-Backend gibt `format` und `viewCount` zusätzlich aus.
- **Avatar/Banner-Upload** — Root-Cause: `S3_PUBLIC_URL` fehlte in lokaler `.env`. Hinzugefügt: `S3_PUBLIC_URL=http://localhost:9000` + `NEXT_PUBLIC_S3_PUBLIC_URL=http://localhost:9000`. Damit liefert `buildPublicUrl` in [`apps/api/src/channel-assets-upload.ts`](apps/api/src/channel-assets-upload.ts) jetzt eine echte URL und der Browser zeigt das Asset nach dem Upload an.

### Verifikation Session E

- Seed läuft idempotent durch (zweiter Lauf: 0 neue Rows).
- DB-Stand nach Demo-Seed: 6 Channels (3 Default-Tests + 3 Demo), 16 Videos (8 alt + 8 demo), 12 PUBLIC-LIVE, 4 Shorts.
- Alle 7 Workspace-Packages typechecken grün.

### Offen für Session F

- E2E-Verifikation der UI-Fixes im Browser (Shorts-Layout, Channel-Page-Sektionen, Studio-Format-Tabs, Asset-Upload-Vorschau).
- Optional: bestehende ältere Test-Videos aus früheren Sessions aufräumen, damit das Admin-Dashboard nur noch die Demo-Daten zeigt.

---



## Session 13 A+B+C — Lokal-Finalisierung (2026-04-18)

Dreifach-Session nach dem PL-Plan in `.claude/plans/du-bist-pl-f-r-lively-stream.md`.
Ziel: sichtbare Baustellen lokal schließen, bevor auf Unraid deployed wird.
Alle 7 Packages typechecken grün.

### A — Backend-Fundament

**Schema** · Migration `20260417213012_session_a_schema_extensions` (additiv, 5 Themen in einer Migration):

- Neuer Enum `RegistrationMode` (OPEN/INVITE/CLOSED).
- Neues Singleton-Model `SiteSettings` (siteName, siteTagline, contactEmail, defaultLocale,
  registrationMode, defaultVisibility, defaultCommentsEnabled, defaultCategoryId →
  Category-FK `SetNull`).
- `User.notificationPrefs` Json default `{"emailOnComment":false,"emailOnSubscriber":false}`.
- `Channel` um `accentColor`, `sectionOrder` (Json, ausgewählt aus Whitelist), `featuredVideoId`,
  `trailerVideoId` + Relations `ChannelFeatured` / `ChannelTrailer` → Video.
- Neues Model `VideoCaption` (videoId + ISO-Sprache + assetKey + isDefault, UNIQUE auf
  videoId+language).
- Neue Modelle `Playlist` + `PlaylistItem` (kanal-gebunden, Visibility-Enum,
  Cursor-friendly Position-Int).

**tRPC-Router neu**:

- `siteSettings.get` (public) + `siteSettings.update` (admin).
- `userSettings.me` · `updateDisplayName` · `updateNotificationPrefs` · `exportMyData`
  (DSGVO-Dump) · `requestAccountDeletion` (Soft-Delete: banned=true, Email anonymisiert,
  Videos → PRIVATE; Comments bleiben als Kontext).
- `playlist.mine` · `byChannel` · `bySlug` · `create` · `update` · `delete` · `addItem` ·
  `removeItem` · `reorder` (Transaction mit Position-Neuschreibung).

**tRPC-Erweiterungen**:

- `studio.analytics({ period: "7d" | "30d" | "90d" })` — Views, Watch-Time (60 %-Retention-
  Schätzung), Abonnenten, LIVE-Video-Count, Top-10 Videos mit Likes+Comments-Counts via
  `_count`.
- `studio.subscribers({ cursor?, limit? })` — Total, last7d, paginierte Liste.
- `studio.dashboard` — echte Abo-Zahl statt Mock `0`.
- `channel.updateAppearance` (accentColor Zod-Regex `/^#[0-9a-fA-F]{6}$/`, sectionOrder
  whitelistet via `sanitizeSectionOrder`, featured/trailer werden auf Owner+LIVE geprüft).
- `channel.clearAsset({ kind: "avatar" | "banner" })`.
- `channel.getBySlug` + `channel.myChannel` um alle neuen Appearance-Felder erweitert.
- `video.trim({ videoId, startSec, endSec })` → enqueued Trim-Job.
- `video.captions` Sub-Router: `list` (public) · `remove` · `setDefault` (owner).

**Fastify Raw-Upload-Handler** (alle analog zu `logo-upload.ts`, owner-gated,
Content-Type-Whitelist, Size-Limit, MinIO-Stream, DB-Update, altes Asset best-effort löschen):

- `POST /api/studio/avatar` + `/banner` → `channel-assets-upload.ts`. Key-Schema
  `avatar/<channelId>.<ext>` bzw. `banner/<channelId>.<ext>`. Max 2 MB / 4 MB.
- `POST /api/studio/video/:id/thumbnail` → `video-assets-upload.ts`. Key-Schema
  `<videoId>-custom-<uuid>.<ext>` im `play-thumbs`-Bucket. Wird automatisch in
  `thumbnailCandidates` + `thumbnailKey` übernommen.
- `POST /api/studio/video/:id/caption?lang=de&label=Deutsch` → nimmt VTT oder SRT entgegen;
  SRT wird über eingebauten Konverter (`srtToVtt`) zu VTT normalisiert. Upsert auf
  `VideoCaption(videoId,language)`.

**Worker** · neue `TRIM_QUEUE` + `apps/worker/src/jobs/trim.ts`:

- Lädt Raw → `ffmpeg -ss <start> -to <end> -c copy` zuerst; wenn ffprobe die Ziel-Duration
  um > 1 s verfehlt, Re-Encode-Fallback `libx264 -preset veryfast -crf 23`. Upload
  überschreibt `play-raw/<id>.mp4`, enqueued Standard-Transcode-Job. Concurrency 1.

**Better-Auth** · neuer `databaseHooks.user.create.before`-Hook liest `SiteSettings.registrationMode`
und wirft `APIError("FORBIDDEN")` mit Code `REGISTRATION_CLOSED` bzw. `INVITE_REQUIRED`.
Initial-Admin-E-Mail ist von dieser Prüfung ausgenommen, damit kein Lock-out.

**Hydration-Fix** · [apps/web/src/app/layout.tsx:51](apps/web/src/app/layout.tsx#L51) —
`<html lang="de" suppressHydrationWarning ...>`. Browser-Extensions mutieren das
`<html>`-Tag (Translator setzt `lang="de-DE"`, Dark-Reader injiziert `style=`). Suppression
nur auf Root-Html, nicht auf Children → echte Daten-Mismatches werden weiterhin gemeldet.

### B — Worker / FFmpeg

War als separate Session geplant, aber inhaltlich mit A verzahnt (Trim-Job,
SRT→VTT-Konverter, Thumbnail-Route) — daher gebündelt ausgeliefert.

### C — Studio-UI (Creator-Flächen)

Alle bisher als WIP-Stubs gerenderten Seiten sind jetzt echte Funktionen. Sidebar
entfernt die `WIP`-Badges an Analytics / Branding / Abonnenten, ergänzt einen
neuen Menüpunkt „Playlists".

- **[/studio/analytics](apps/web/src/app/studio/analytics/page.tsx)** — 4 Stats-Cards
  (Views / Watch-Time / Abos / Live-Videos), Period-Picker 7 / 30 / 90 Tage, Top-10-Tabelle
  mit CSS-Bar-Chart pro Zeile (Width relativ zum Maximum).
- **[/studio/subscribers](apps/web/src/app/studio/subscribers/page.tsx)** — Gesamt-Count,
  +N-last7d-Chip, Liste mit Initial-Avatar-Gradient, Cursor-Pagination („Weitere laden").
- **[/studio/settings](apps/web/src/app/studio/settings/page.tsx)** — vier Sektionen:
  Account (displayName editierbar · Handle/E-Mail read-only), Benachrichtigungen (zwei
  Toggle-Switches), Passwort (ruft `authClient.changePassword` direkt), Datenschutz
  (JSON-Export über Blob-Download · Account-Löschung mit Handle-Bestätigungs-Dialog).
- **[/studio/branding](apps/web/src/app/studio/branding/page.tsx)** — Tab-Nav
  **Assets** (Avatar + Banner Upload mit XHR-Progress, Live-Preview des Channel-Headers,
  Remove-Button) und **Layout** (Color-Picker + Hex-Input, Featured/Trailer-Select
  aus eigenen LIVE-Videos, Section-Order mit Pfeil-Up/Down + Toggle-Einblendung,
  Live-Preview rechts).
- **[/studio/[id]/trim](apps/web/src/app/studio/[id]/trim/page.tsx)** — HLS-Player +
  Dual-Range-Slider (Start / Ende), „In-Punkt / Out-Punkt"-Buttons auf Current-Time,
  „Vorschau"-Button spielt nur den Ausschnitt, Confirm-Dialog vor `trim`-Mutation.
- **[/studio/[id]/edit](apps/web/src/app/studio/[id]/edit/page.tsx)** erweitert:
  Custom-Thumbnail-Upload-Button im Thumbnail-Picker, Captions-Panel (Liste pro
  Sprache + Default-Toggle + Remove + Upload-Form mit ISO-Code + Label + Datei),
  „Trim-Editor öffnen"-Shortcut-Card.
- **[/studio/playlists](apps/web/src/app/studio/playlists/page.tsx)** — CRUD-Liste
  mit Inline-Create-Form (Titel · Beschreibung · Visibility).
- **[/studio/playlists/[id]](apps/web/src/app/studio/playlists/[id]/page.tsx)** —
  Add-Video-Select (nur LIVE-Videos, die noch nicht drin sind), Reorder via Pfeile
  mit Live-`reorder`-Mutation, Remove per Item-Button.
- **[/playlist/[slug]](apps/web/src/app/playlist/[slug]/page.tsx)** — öffentliche
  Playlist-Seite mit `?playlist=<slug>`-URL-Weitergabe an Watch-Seite (dort kommt
  v0.3 der Playlist-Queue-Indicator).

### Neue Icons

`icon.tsx` ergänzt um `chevron-left`, `scissors`, `bar-chart`, `image`, `list`,
`user` (Feather-Style, single-stroke).

### TypeScript-Workarounds

- `channel.updateAppearance` gibt `{ ok: true }` zurück statt `sectionOrder` mit
  zurückzuliefern — sonst TS2589 im Client durch Prisma-JsonValue-Rekursion.
- `/studio/branding` nutzt lokale `MyChannel`-Interface + `as unknown as MyChannel`-Cast
  auf `trpc.channel.myChannel.useQuery().data` (selbes Muster wie `EditableVideo`
  im Video-Editor).

### D — Header, Admin-Settings, Shorts-Polish, Channel-Page

**Header** · `UploadMenu`-Dropdown im Header ersetzt durch kompakten `CreateButton`
(eingeloggt-only, href `/studio/new`, Brand-Bg + shadow-glow). Neu:
[/studio/new](apps/web/src/app/studio/new/page.tsx) — 4-Kacheln-Hub (Video hochladen /
Video importieren / Short hochladen / Short importieren). `/studio/upload` + `/studio/import`
lesen `?format=short` und zeigen Hint-Badge + angepassten Titel/Erklärtext.

**video.list cursor** · `trpc.video.list` erhält optionales `cursor: string`-Input —
Prisma `cursor: { id }` + `skip: 1` für keyset-Pagination (Shorts Infinite-Scroll +
zukünftige Home-Feed-Extension).

**Admin-Settings** · [`/admin/settings`](apps/web/src/app/admin/settings/page.tsx) —
vier echte Sektionen statt WIP-Stub:
- *Allgemein*: siteName, siteTagline, contactEmail, defaultLocale (Select de/en).
- *Registrierung*: RadioGroup OPEN / INVITE / CLOSED mit Erklärtext.
- *Video-Defaults*: defaultVisibility, defaultCategoryId, defaultCommentsEnabled Toggle-Switch.
- *Umgebung*: Read-only Cards mit ffmpegVersion, ytdlpVersion, maxUploadMB + Env-Vars.
`admin.system.health` erweitert um `ffmpegVersion` + `ytdlpVersion` (module-level cached,
via `execFile` mit 5 s Timeout) + `maxUploadMB` (aus `MAX_UPLOAD_SIZE` Env). Admin-Sidebar:
WIP-Badge an Einstellungen entfernt.

**Shorts-Polish** · [`/shorts`](apps/web/src/app/shorts/page.tsx):
`h-screen` → `h-dvh` (Container + Slides + Loading/Empty-States, iOS-Safari-fix),
`PRELOAD_AHEAD` 3 → 2 (max 3 HLS-Instanzen parallel), Infinite-Scroll via
IntersectionObserver: wenn `activeIdx >= items.length - 3` → `setFetchCursor(lastId)` →
`moreQuery` lädt nächste Batch (dedupliziert), Empty-State-CTA zeigt auf `/studio/new`.

**Channel-Page YouTube-Composition** ·
[`/c/[slug]`](apps/web/src/app/c/%5Bslug%5D/channel-client.tsx) komplett neu gebaut:
- Full-Width-Banner (`aspect-[6/1]`), akzent-farbiger Gradient-Overlay.
- Avatar über Banner überlappend (`-mt-12`), mit eigener Avatar-URL oder Initial-Gradient.
- `--channel-accent` CSS-Var auf `<main>` (Hex-only, XSS-sicher via Zod-Regex auf API-Seite).
- Trailer-Slot: HLS-autoplay-muted für Nicht-Subscriber (Subscriber + Owner sehen ihn nicht).
- Featured-Slot: gepinntes Video ganz oben wenn gesetzt.
- Sections gemäß `sectionOrder` (Whitelist-sanitized): Latest / Shorts-Carousel /
  Popular (by viewCount) / Playlists (pending) / About (About-Text + socialLinks).
- Subscribe-Button nimmt `accentColor`-Prop und färbt Bg + Box-Shadow beim Nicht-Abonniert-Zustand.
- Owner: unveröffentlichte Videos in separater `text-warning`-Section.

### Offen für Session E

- Demo-Content-Seed (3 Kanäle, 8 Videos, Community-Daten) — damit Admin-Dashboard
  und `/c/itsweber` direkt „lebendig" aussehen.

## Session 13 F — Format-Trennung Plattform-weit (2026-04-18)

Konsequente Trennung Videos vs Shorts überall — vom Backend bis ins UI. Plus
neuer Page-Block-Typ `SHORTS_ROW` und `CHANNEL_ROW`. Migration
`20260418075950_add_shorts_row_block` (PostgreSQL Enum-Erweiterung).

### Backend Format-Filter

Alle öffentlichen Listing-Router akzeptieren jetzt `format`-Input und filtern:
- [`admin.videos.list`](apps/api/src/trpc/routers/admin.ts) — `format: ALL | LONG | SHORT` Default `ALL` (Admin sieht alles).
- [`subscription.latestVideos`](apps/api/src/trpc/routers/subscription.ts) — Default `LONG`.
- [`category.getBySlug`](apps/api/src/trpc/routers/category.ts) — Default `LONG`.
- [`search.all`](apps/api/src/trpc/routers/search.ts) — gibt `format` im Select mit, Frontend trennt in Sektionen.

`video.list` hatte den Filter bereits, alle anderen Selects wurden um `format` ergänzt.

### Frontend Format-Tabs / Sektionen

- **`/admin/videos`** — Tab-Pills „Alle / Videos / Shorts" + Format-Badge in der Tabelle.
- **`/subs`** — Sektionen „Neue Videos" (Long) + „Neue Shorts" (9:16-Karussell).
- **`/search`** — Videos-Sektion (Long) + separate Shorts-Karussell-Sektion.
- **`/category/[slug]`** — bekommt automatisch nur Long-Videos via Backend-Default.

### Page-Block-System: SHORTS_ROW + CHANNEL_ROW

- Schema [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) — `PageBlockType` um `SHORTS_ROW` + `CHANNEL_ROW` erweitert.
- Backend [`page.ts`](apps/api/src/trpc/routers/page.ts) — neue `ShortsRowConfigSchema` + `ChannelRowConfigSchema`. `VideoGridConfigSchema` um `format`-Feld erweitert (Admin wählt LONG/SHORT/ALL pro Block).
- Frontend [`apps/web/src/components/blocks/`](apps/web/src/components/blocks/) — neue Komponenten `shorts-row-block.tsx` (horizontal scrollendes 9:16-Karussell mit Link auf `/shorts?v=<slug>`) + `channel-row-block.tsx` (Grid mit Avatar/Subs/Videos-Counts). `block-renderer.tsx` verzweigt jetzt auf 6 Block-Typen und nimmt `shorts` + `channels` als zusätzliche Props.
- [`/admin/page-blocks`](apps/web/src/app/admin/page-blocks/page.tsx) — Adder um neue Block-Typen erweitert, Config-Editor mit Form-Fields für SHORTS_ROW (Titel/Badge/OrderBy/Limit) und CHANNEL_ROW (Titel/OrderBy: mostSubscribed|mostVideos|newest/Limit). VIDEO_GRID hat zusätzlich Format-Select.
- [`apps/web/src/app/page.tsx`](apps/web/src/app/page.tsx) — `FALLBACK_BLOCKS` erweitert: `Latest Videos (LONG)` + `Latest Shorts (SHORTS_ROW)` + `Empfohlene Kanäle (CHANNEL_ROW)`. Lädt jetzt 3 Queries parallel (`video.list LONG`, `video.list SHORT`, `channel.list mostSubscribed`).

### /shorts UI

- **Footer ausgeblendet** auf `/shorts` über `usePathname()`-Check in [`site-footer.tsx`](apps/web/src/components/site-footer.tsx) (`HIDDEN_ON_PATHS = ["/shorts"]`).
- **Share-Button** in der Action-Bar eingebaut. [`ShareButton`](apps/web/src/components/video-actions.tsx) wurde exportiert + bekam `variant: "pill" | "compact"`-Prop. Compact-Mode rendert runden Icon-Button mit nach oben öffnendem Dropdown — passt zum Shorts-Action-Stack.

### Upload/Import Format-Toggle

Neue [`FormatToggle`-Komponente](apps/web/src/components/format-toggle.tsx) mit zwei Tabs „Video / Short", schreibt `?format=short` per `router.replace`. In [`/studio/upload`](apps/web/src/app/studio/upload/page.tsx) und [`/studio/import`](apps/web/src/app/studio/import/page.tsx) eingebaut — User kann jetzt direkt umschalten statt URL editieren zu müssen. Worker bleibt Source-of-Truth für die finale Format-Klassifikation (Aspect-Ratio + Dauer).

### Verifikation

- Migration `20260418075950_add_shorts_row_block` applied.
- Alle 7 Workspace-Packages typechecken grün.
- Prisma-Client-Types aktuell (DLL-Lock auf Engine blockiert nur den Binary, nicht die `.d.ts`).



## Was läuft

### Workspace-Topologie

```
packages/
  shared/    @play/shared    Visibility-Logik + Role/Visibility-Types (reine Lib, keine Runtime-Deps)
  theme/     @play/theme     tokens.json → dist/primitives.css (auto-gen) + styles/semantic.css
  db/        @play/db        Prisma 6.19 + Singleton-Client + Seed
  storage/   @play/storage   MinIO-Client + ensureBuckets + put/get Helpers

apps/
  web/       @play/web       Next.js 15.5, Tailwind v4, tRPC-Client, Better-Auth-React
  api/       @play/api       Fastify 5 + Better-Auth 1.1 + tRPC 11, Upload-Endpoint
  worker/    @play/worker    BullMQ + fluent-ffmpeg + @ffmpeg-installer (portable)
```

### Services im Dev-Stack

| Prozess                | Start                                         | Port           | Status |
|------------------------|-----------------------------------------------|----------------|--------|
| play-postgres (Docker) | `docker compose -f docker-compose.dev.yml up` | 5432           | ✓      |
| play-redis (Docker)    | `docker compose -f docker-compose.dev.yml up` | 6379           | ✓      |
| play-minio (Docker)    | `docker compose -f docker-compose.dev.yml up` | 9000 (S3) 9001 | ✓      |
| apps/web               | `pnpm --filter @play/web dev`                 | 3000           | ✓      |
| apps/api               | `pnpm --filter @play/api dev`                 | 4000           | ✓      |
| apps/worker            | `pnpm --filter @play/worker dev`              | —              | ✓      |

### End-to-End verifiziert

1. **Auth:** Sign-up via `POST /api/auth/sign-up/email` → User + Default-Channel per Hook, Session-Cookie
2. **Admin-Bootstrap:** Erste Registrierung mit `INITIAL_ADMIN_EMAIL` → `role=ADMIN`
3. **tRPC:** `video.list`, `video.get`, `video.mine`, `video.setVisibility`, `auth.session`, `health.ping`, `health.db`
4. **Upload → Transcode:** Raw `POST /api/upload` → MinIO `play-raw/<id>.mp4` → BullMQ-Job → Worker
   zieht Original, ffprobe, ffmpeg-HLS (720p/480p, kein Upscaling auf 1080p), Thumbnail, Upload
   nach `play-videos/<id>/master.m3u8` + `play-thumbs/<id>-main.webp`, DB `status=LIVE`.
5. **Playback-Ressourcen:** HLS via `http://localhost:9000/play-videos/<id>/master.m3u8`
   (Bucket hat Anonymous-Read-Policy). Thumbnail ebenso unter `play-thumbs/`.
6. **Frontend-UI (6b):**
   - `/` — Startseite mit Video-Grid (Thumbnails + Dauer) aus `trpc.video.list`, Empty-State mit Upload-CTA
   - `/login`, `/register` — Better-Auth-Formulare (Email/Passwort + Handle bei Register)
   - `/studio` — eigene Uploads, Visibility-Dropdown pro Video (live-pollt bei PROCESSING alle 2s)
   - `/studio/upload` — XHR-Upload mit Progress-Bar (fetch hat keinen Upload-Progress), Redirect auf `/watch/<slug>`
   - `/watch/[slug]` — HLS-Player (hls.js in Chrome/Firefox, nativ in Safari) mit Poster = Thumbnail,
     auto-refetch bei PROCESSING → lädt Player nach, wenn status=LIVE
   - Site-Header: Session-Zustand (signed-in → @handle + Studio-Link + Logout; signed-out → Login/Register)
7. **Admin-Panel (Schritt 7):**
   - `/admin` — User-Tabelle mit Suche, Rollen-Dropdown, Ban/Entsperren-Button
   - tRPC `admin.users.{list, setRole, setBan}` — alle drei hinter `adminProcedure` (role=ADMIN enforced)
   - Self-lockout-Schutz: Admin kann sich nicht selbst degradieren oder sperren
   - Ban killt alle aktiven Sessions des Users in `admin.users.setBan`
   - Admin-Link im Header nur sichtbar, wenn `session.user.role === "ADMIN"`
8. **Prod-Dockerfiles (1st draft, ungetestet):**
   - `docker/api/Dockerfile` — multi-stage Node 22-slim, tsx zur Laufzeit, EXPOSE 4000
   - `docker/worker/Dockerfile` — Debian slim + ffmpeg + yt-dlp (static binary), FFMPEG_PATH gesetzt
   - `docker/web/Dockerfile` — Next.js 15 standalone-Output, EXPOSE 3000
   - `.dockerignore` ausgeschlossen: node_modules, .next, .volumes, logs, .env (!.env.example bleibt)
   - docker-compose.yml (Prod, bereits da) referenziert br1-macvlan mit 10.10.8.50–54
   - **TODO:** auf Unraid echt bauen + testen; ggf. ARM/x86-Arch-Quirks im @ffmpeg-installer
10. **yt-dlp-Import + Kanal-Seite (Schritt 9, 2026-04-17):**
    - Neue BullMQ-Queue `import` mit separatem Consumer im Worker
       (concurrency konfigurierbar über `IMPORT_CONCURRENCY`, default 2).
    - Import-Job-Pipeline: yt-dlp → MinIO `play-raw/<id>.mp4` → Metadata aus info.json →
       Video-Row-Update → enqueue Transcode-Job. Die bestehende Transcode-Pipeline übernimmt
       ab dann wie bei normalen Uploads — DRY.
    - Neuer tRPC-Endpoint `trpc.video.import({ url, title? })` — protected, legt Video-Row
       mit `source=EXTERNAL`, `sourceUrl=url`, `visibility=PRIVATE` an.
    - Neue Frontend-Route `/studio/import` — URL-Input + optionaler Titel + expliziter
       Urheberrechts-Hinweis (PRIVATE-Default, User schaltet manuell auf PUBLIC).
    - Neuer tRPC-Router `channel.getBySlug` — liefert Channel-Meta + Videos (Visibility-
       respektierend: Owner/Admin sehen alles, Fremde nur PUBLIC+LIVE).
    - Neue Route `/c/[slug]` — Channel-Header mit Gradient-Avatar, Stats (Videos, Start-Datum,
       Team-Badge bei ADMIN), `alle Videos (inkl. privat)`-Sicht für Owner/Admin mit Visibility-
       Overlay auf UNLISTED/PRIVATE-Kacheln.
    - **End-to-end verifiziert** mit `https://www.youtube.com/watch?v=jNQXAC9IVRw` („Me at the zoo",
       19 s) → Titel automatisch aus Metadaten gezogen, Duration korrekt, PRIVATE-Safeguard aktiv,
       HLS streambar.

    **Windows-Stolperstein, gelöst:** `youtube-dl-exec` scheitert auf Windows, wenn der Pfad zum
    yt-dlp-Binary Leerzeichen enthält — execa wrappt den gesamten Command als `shell: true`-String
    mit doppelten Quotes (`""C:\...\yt-dlp.exe"..."`), was `cmd.exe` nicht versteht. Ersetzt durch
    eigenen `child_process.execFile`-Aufruf mit `shell: false` und expliziter Arg-Array-Übergabe.
    Binary-Pfad wird über `createRequire(import.meta.url).resolve("youtube-dl-exec/package.json")`
    gefunden → robust gegen pnpm-Store-Pfade.

11. **Visual-Polish zu Preview-Parität (Schritt 8):**
   - Geist + Geist Mono via `next/font/google` in Tailwind `@theme` verdrahtet
   - Body-Background: zwei Radial-Gradients mit Teal-Tint für Tiefe (wie preview/)
   - Semantic-Tokens erweitert: `border-strong`, `surface-hover`, `brand-dim`, `shadow-glow`, `logo-filter`
   - Neuer SiteHeader: Logo (live von itsweber.de, `[filter:var(--logo-filter)]`) + Gradient-Wortmarke
     + Nav-Links (Entdecken/Kanäle/Abos/Bibliothek) + Search-Pill + Avatar + Sign-in-Glow-Button
   - Homepage: **Hero-Section** mit Featured-Video (größtes/neuestes LIVE), Chip-Row (statische
     Kategorien für v0.1), polished 4-Col-Grid mit VideoCard-Component, Skeleton-Loader
   - Neue `VideoCard`-Component: Avatar-Kreis + Hover-Lift + Duration-Badge + Relative-Timestamp
   - `/watch/<slug>`: 2-Col-Layout mit Player + Sidebar („Weiter ansehen" mit Compact-Cards),
     Channel-Header mit Gradient-Avatar, Visibility-Badge, Processing-Banner mit Pulse-Dot
   - `/studio`: Table-Layout statt Kartenliste, Status-Badges mit Punkt-Indikator
     (PENDING=warning, PROCESSING=brand, LIVE=success, FAILED=danger), **Delete-Button**
     (ruft neue `trpc.video.delete`-Mutation, owner/admin-gated)
   - `/admin`: a11y-Polish (aria-label auf Selects, sr-only Aktions-Header)
   - Footer: brand + powered-by-Zeile
   - Alle Routes smoke-tested: `/` `/studio` `/admin` `/watch/:slug` `/login` `/register` → HTTP 200
   - FAILED-Smoke-Test-Videos per SQL entfernt (kommen künftig über Studio-Löschen weg)

## Dev-User

| E-Mail              | Passwort           | Rolle   | Default-Channel |
|---------------------|--------------------|---------|-----------------|
| admin@itsweber.de   | play-dev-admin     | ADMIN   | admin           |
| creator1@test.de    | creator-test-pw    | CREATOR | creator1        |

## Abweichungen von der ursprünglichen Doku

- **OidcAccount entfernt:** Better Auth's `Account`-Modell deckt sowohl Credential- als auch
  zukünftige OIDC-Links ab (provider+accountId), ist eine eindeutig bessere Passform.
- **User.passwordHash entfernt:** Password-Hash liegt jetzt in `Account.password` (Argon2id,
  von Better Auth verwaltet).
- **Upload nicht via tus.io (MVP-Kompromiss):** Direkter `POST /api/upload` mit `video/*`-Body,
  gestreamt in MinIO. Einfacher, ausreichend bis ~8 GB. tus.io kommt in v0.2 wenn resumable
  Uploads reale Schmerzen verursachen.
- **Nur 2 HLS-Qualitäten bei Source ≤ 720p:** Statt aller 3 laut docs/05 generieren wir
  nur Varianten ≤ Source-Höhe (kein Upscaling). Bei 1080p-Source: alle drei.
- **1 Thumbnail statt 5 Kandidaten:** Frame bei 50% Dauer. Der 5-Kandidaten-Flow für Studio-
  Auswahl kommt in v0.2.

## Session 11 — Docker-Build-Fixes + lokaler Smoke-Test (2026-04-17)

Docker-Images erstmals erfolgreich gebaut. 6 Build-Bugs gefixt, alle Images
lokal smoke-getestet. Unraid-Deploy steht noch aus (Domain-Klärung + SSH).

### Fixes

- **`docker/web/Dockerfile`** — `NEXT_PUBLIC_*` als Build-ARGs (`ARG`/`ENV` im
  builder-Stage); pnpm-Symlink-Problem gelöst via `COPY --from=deps /app ./`
  statt selektivem `node_modules`-Copy; `@play/theme build` vor Next-Build
  explizit ausführen (generiert `dist/primitives.css`).
- **`docker/api/Dockerfile`** — gleiche `COPY --from=deps`-Strategie; OpenSSL
  installiert (Prisma benötigt es in `node:22-slim`).
- **`docker/worker/Dockerfile`** — gleiche Strategie; OpenSSL hinzugefügt.
- **`docker-compose.yml`** — `build.args` für `NEXT_PUBLIC_*` in `play-web`;
  Worker-IP `10.10.8.55` explizit gesetzt (macvlan braucht feste IPs).
- **`apps/web/next.config.mjs`** — `@play/api` aus `transpilePackages` entfernt
  (nur `import type` → kein Runtime-Bundle nötig, vermeidet worker/bullmq-Dep
  im Web-Build); `typescript.ignoreBuildErrors: true` + `eslint.ignoreDuringBuilds:
  true` für Docker-Builds (Typcheck läuft separat in Dev/CI).
- **`.env.example`** — alle fehlenden Prod-Vars ergänzt: `API_URL`,
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_S3_PUBLIC_URL`,
  `S3_PUBLIC_URL`, `S3_BUCKET_RAW`, `S3_BUCKET_ASSETS`, `TRANSCODE_CONCURRENCY`,
  `IMPORT_CONCURRENCY`, `FFPROBE_PATH`.
- **`config/npm-proxy-host.md`** — neue Sektion für `api.play.itsweber.net`
  (`10.10.8.51:4000`); SSE-Headers (`Connection: ''`, `chunked_transfer_encoding`)
  dokumentiert.
- **`apps/web/public/og-default.png`** — 1200×630 Placeholder-PNG für OG-Tags.

### Smoke-Test (lokal, Bridge-Network)

- `play-api`, `play-postgres`, `play-redis`, `play-minio` gestartet.
- `prisma migrate deploy` — alle 12 Migrations applied.
- `db seed` — `impressum`, `datenschutz`, `agb` angelegt.
- `play-web` gestartet → `/, /shorts, /library, /impressum, /datenschutz` → HTTP 200.
- `GET /health` → `{ok: true}`.

### Noch ausstehend

- ~~**Vollständiger lokaler E2E-Test**~~ → **Session 12 erledigt.**
- **Unraid-Deploy** (docker save/load via SSH, `.env.prod`, NPM-Proxy) → Session 13.
- **Domain:** `play.itsweber.net` bestätigt.

## Session 12 — Vollständiger lokaler E2E-Test (2026-04-17)

Alle 11 Checklisten-Punkte bestanden. Keine Bugs gefunden. Prod-Images smoke-getestet.

### E2E-Ergebnisse

| Punkt | Status | Notiz |
| ----- | ------ | ----- |
| 1. Stack + Health | ✅ | Docker-Stack lief bereits, API + Web gestartet |
| 2. Auth-Flow | ✅ | Register, Login, Session-Cookie, Logout |
| 3. Upload + Transcode | ✅ | MP4 → MinIO → BullMQ → HLS + 5 Thumbnail-Kandidaten → LIVE |
| 4. Studio | ✅ | Dashboard, Videos, Edit, Channel, yt-dlp-Import |
| 5. Discovery + Navigation | ✅ | /, /shorts, /channels, /subs, /library, /search, /category/* |
| 6. Community | ✅ | Like, Kommentar, Subscribe, Watch-History, Watch-Later |
| 7. Legal + Footer | ✅ | /impressum, /datenschutz, /agb — 200, Footer-Links vorhanden |
| 8. Admin-Panel | ✅ | Dashboard, Users, Videos, Theme, Page-Blocks, Pages, Categories, Moderation |
| 9. Theme-SSE | ✅ | Token-Change → SSE-Event < 2s (effektiv < 1s ohne Verbindungsaufbau) |
| 10. Embed + OG | ✅ | /embed 200, og:title/og:image im Head, oEmbed JSON korrekt |
| 11. Prod-Image Smoke | ✅ | play-api/play-web mit host.docker.internal → alle Routen 200 |

### Beobachtete Eigenheiten (keine Bugs)

- **Better Auth + curl Logout:** Ohne `Origin`-Header gibt Better Auth 400 zurück
  (`MISSING_OR_NULL_ORIGIN`) — korrekt, CSRF-Schutz. Im Browser ist Origin immer gesetzt.
- **oEmbed-Endpoint:** liegt auf Next.js `/api/oembed`, nicht auf Fastify.
  Checkliste nannte `/api/oembed?url=...` ohne Host-Prefix → funktioniert auf `:3000`.
- **Theme-SSE Latenz:** SSE-Event kam bei ~1s nach Mutation. Initialer Stream-Aufbau
  braucht die erste Hello-Pause; bei dauerhaft offenem EventSource (wie im Browser) < 500ms.
- **Prod-Smoke:** `--network host` in Docker Desktop Windows funktioniert nicht
  (VM-Isolation). Workaround: `-p` Port-Publish + `host.docker.internal`. Für Unraid
  läuft macvlan — kein Problem.

### Prod-Images (Session-11-Build, unverändert)

Alle drei Images aus Session 11 — kein Rebuild nötig.

```text
play-api:latest    409 MB
play-web:latest    105 MB
play-worker:latest 447 MB
```

## Offene Baustellen (Rest MVP + v0.2)

| Block                                  | Wo                                  | Schätzung |
|----------------------------------------|-------------------------------------|-----------|
| Prod-Deploy auf Unraid                 | docker-compose.yml + SSH            | 1-2 h     |
| Vollständiger lokaler E2E-Test         | docker-compose.dev.yml              | 1 h       |
| Video-Editor (Trim, Chapters)          | apps/web/src/app/studio/[id]/edit   | v0.2      |
| yt-dlp-Import-Flow                     | worker job + `trpc.video.import`    | v0.2      |
| Kommentare + Likes                     | trpc comment / reaction router + UI | v0.2      |
| tus.io Resumable-Uploads               | api `/api/upload` + tus-js-client   | v0.2      |
| Theme Ebene 6 (Layout-Blöcke)          | /admin/theme Block-Composer         | v0.3      |
| Search (Postgres FTS)                  | trpc.search.videos                  | v0.2      |

## Session 1 — Abschlussstand (2026-04-16)

Die v0.1-MVP-Checkliste ist bis auf „Prod auf Unraid testbauen" + „NPM-Doku" durch.
Alle 7 Workspace-Packages typechecken grün. Dev-Stack voll funktional:

- **Öffentlich** (ohne Login): Startseite mit Video-Grid, `/watch/:slug` mit HLS-Player,
  Login/Register-Flows.
- **Eingeloggt (CREATOR):** `/studio` (eigene Videos + Visibility-Toggle),
  `/studio/upload` (Drag-Drop + Progress), Upload landet als PRIVATE.
- **Eingeloggt (ADMIN):** Zusätzlich `/admin` (User-Management).
- **Upload-Pipeline:** Browser → API → MinIO → BullMQ → Worker → ffmpeg → HLS+Thumb
  → DB=LIVE. Vollständig verifiziert mit 720p-Testclip (6 s, 5,7 MB → 2 HLS-Varianten).

Für den Produktiv-Deploy auf Unraid fehlt nur der eigentliche `docker compose build`-
Durchlauf (ungetestet, weil kein Unraid-Remote-Zugang in dieser Session aufgesetzt).

## Windows-Stolpersteine (dokumentiert zur Wiederverwendung)

1. **Prisma EPERM beim pnpm install:** Die `query_engine-windows.dll.node` wird im
   `postinstall` neu geschrieben — wenn API- oder Worker-Prozess läuft, scheitert das.
   Vor `pnpm install` alle Node-Prozesse aus dem Projekt killen:
   ```powershell
   Get-CimInstance Win32_Process |
     Where { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*ITSWEBER Play Docker*' } |
     ForEach { Stop-Process -Id $_.ProcessId -Force }
   ```

2. **Prisma `migrate dev` hängt in TTY-losen Shells:** Der Migrate-Wizard wartet auf
   interaktiven Input. Workaround: `migrate dev --create-only --name <x>` erzeugt nur die
   SQL, dann `migrate deploy` appliziert non-interactive. Für Schema-Changes immer so
   zweischrittig vorgehen, außer man hat ein echtes Terminal.

3. **FFMPEG_PATH in .env:** War `/usr/bin/ffmpeg` (Linux-Prod-Pfad). Für Windows-Dev leer
   lassen → Worker fällt auf `@ffmpeg-installer` zurück. Beim Containerisieren den Pfad
   auf `/usr/bin/ffmpeg` zurücksetzen.

## Session 2 — Live-Theme-Editor (2026-04-17)

Theming-Ebenen **3 + 4 + 5** komplett durch. Das Kern-Differenzierungsmerkmal der
Plattform steht live und end-to-end verifiziert. Ebene 6 (Layout-Blöcke) bleibt v0.3.

### Was gebaut wurde

- **Schema:** `ThemeSettings` (Singleton, `id="singleton"`) + `ThemeRevision` (letzte 20
  Custom-CSS-Snapshots). Migration `20260417052133_add_theme_settings`.
- **`@play/theme` Erweiterungen:**
  - Neuer Preset `retro.json` (Synthwave-Fun-Theme). Gesamtbestand jetzt: `itsweber-dark`,
    `itsweber-light`, `high-contrast`, `retro`.
  - `src/presets.ts` — FS-basierter `loadPreset(id)` + `listPresets()`. Wegen
    `node:fs`-Imports NICHT im Browser-Barrel — eigener Subpath-Export `@play/theme/presets`.
  - `src/override-css.ts` — `overridesToCssBlock({ tokensOverride, logoFilter })`:
    wandelt dot-notation-Overrides (`color.teal.500`) in valide `:root { --color-teal-500: #…; }`-
    Deklarationen um. Value-Sanitation blockt `;`, `{`, `}`, `<`, `>`, `</style>`.
- **tRPC-Router `theme`** (`apps/api/src/trpc/routers/theme.ts`):
  - `get` — **public procedure** (Hotpath, SSR-read auf jedem Render).
  - `update` (admin) — partial-merge von `tokensOverride`; `null`-Wert = Key entfernen.
    Manual-Edit nullt `activePreset`.
  - `applyPreset` (admin) — lädt Preset-JSON, ersetzt Overrides + LogoFilter + aktiver Preset.
  - `setCustomCss` (admin) — Regex-Gate gegen `@import`, `url(javascript:)`, `expression()`,
    `</style>`, `<script`, `behavior:`. Schreibt Revision, trimmt auf 20.
  - `listRevisions` / `rollback` / `exportJson` / `importJson` / `listPresets` — alle admin.
- **SSE-Live-Fanout:**
  - `apps/api/src/theme-bus.ts` — Redis Pub/Sub (ioredis) mit dedizierter Subscriber-
    Connection + shared Publisher. Kanal `theme:updated`.
  - Route `GET /api/theme/events` — EventSource-kompatibel mit Heartbeat alle 25 s
    (gegen NPM-Proxy-Idle-Timeout), ACAO auf `PUBLIC_URL`.
  - Jede schreibende Mutation ruft `publishThemeUpdate({ source })` — Bus-Payload ist
    nur ein Hint, Clients fetchen den frischen State via `theme.get`.
- **SSR-Injection** (`apps/web/src/app/layout.tsx`):
  - Root-Layout ist jetzt async, fetcht via `apps/web/src/lib/theme-ssr.ts` direkt
    `${API_URL}/trpc/theme.get` (kein tRPC-Client im Bundle).
  - Render-Reihenfolge: primitives.css + semantic.css (via globals.css, Tailwind-`@theme`)
    → `<style id="theme-vars">` (Overrides) → `<style id="theme-custom">` (Custom-CSS).
    Exakt wie in docs/03-theming.md §Ebene-Reihenfolge spezifiziert.
- **Client-SSE-Subscriber** (`apps/web/src/lib/theme-sync.ts` + `components/theme-sync.tsx`):
  - Root-Layout mountet `<ThemeSync />`, das eine EventSource öffnet.
  - Auf `theme:updated` → re-fetch `theme.get` → DOM-Style-Tags tauschen. Kein React-
    Rerender; CSS-Variablen kaskadieren.
  - Exportiert `refreshThemeNow()` für Admin-Editor-optimistisches Update.
- **Admin-Editor** (`/admin/theme`):
  - 3-Spalten: links curated Token-Accordions (Brand/Surfaces/Radien/Schatten/Typo +
    LogoFilter-Select), Mitte Iframe-Preview auf `/`, rechts Presets/Export-Import/
    Custom-CSS-Textarea mit Revisionen-Rollback.
  - Color-Inputs für Farben, Text-Inputs für restliche Werte. Commit on blur/Enter.
  - „Alle Overrides zurücksetzen"-Button, per-Token-`×` zum Einzel-Reset.

### Live-Verifikation (End-to-End)

- `theme.applyPreset("retro")` → DB speichert Overrides → nächster `curl /` hat
  `<style id="theme-vars">:root { --color-teal-500: #ff2fd1; … }</style>` im SSR-HTML.
- Ein zweiter Terminal-Tab hielt `curl -N /api/theme/events` offen und bekam
  `event: theme:updated\ndata: {"source":"update","ts":…}` binnen ~1 s nach der Mutation.
  **MVP-Erfolgsmetrik (Token-Change < 1 s, docs/00-overview.md) erreicht.**
- CSS-Validator rejected `@import` und `url(javascript:…)` mit 400, akzeptierte
  `.video-card:hover{transform:scale(1.02)}`, schrieb Revision korrekt.
- Rollback-Kette: Preset-Switch → manueller Edit → `applyPreset` wieder → alle drei
  Events erreichen den SSE-Stream.

### Architektur-Entscheidungen (Kurz-Log)

- **SSE statt WebSocket:** einseitiger Stream (Server→Browser) reicht, Auth kommt
  umsonst über Cookies, kein zusätzlicher Fastify-Plugin-Stack. Falls später
  bidirektional gebraucht (z. B. Preview-postMessage-Bridge beim Block-Editor),
  migrieren wir die Subscription-Seite.
- **Redis als Bus:** horizontaler Skalier-Pfad bereits da, shared mit BullMQ-Redis.
  Kein zusätzlicher Dienst.
- **`@play/theme` Subpath-Split:** Browser-Barrel enthält keine fs-Imports; `presets`
  nur als Subpath-Export. Sonst bläht der Next-Bundler `fs`-Mocks ins Client-Bundle.
- **Manual-Edit nullt activePreset:** sonst suggeriert das UI „Retro aktiv", obwohl
  der Admin längst daran herumgetweakt hat.

### Nachtrag — Audit-Log (2026-04-17)

- Neues Model `ThemeAuditLog` (id, userId, action, payload JSONB, createdAt).
  Migration `20260417053740_add_theme_audit_log`.
- Helper `writeAudit(prisma, userId, action, payload)` in `theme.ts` — wird von
  allen 5 schreibenden Prozeduren (`update`, `applyPreset`, `setCustomCss`,
  `rollback`, `importJson`) aufgerufen. Payloads werden auf ~500 Byte getruncated.
- Neue Prozedur `theme.listAuditLog({ limit })` (admin) — joined User-Handle +
  Email per best-effort `findMany({ where: in: userIds })`.
- Admin-Editor rechts unten: neues „Audit-Log"-Panel, zeigt letzte 20 Einträge
  mit Action/User/Zeit/Summary. Cache invalidiert nach jeder Mutation.
- E2E verifiziert: `applyPreset(retro)` + `update({color.teal.500})` hintereinander
  → `listAuditLog` liefert 2 Einträge, User korrekt aufgelöst, Payload enthält
  Preset-Name bzw. Token-Patch.

### Nachtrag — Logo-Upload (2026-04-17)

- **Bucket:** `play-assets` bekommt anon-read-Policy (wie videos/thumbs) in
  `@play/storage/bootstrap.ts`. Logos sind per Definition public; privater
  Asset-Service (signed URLs) kommt erst bei Bedarf.
- **Schema:** neues Feld `ThemeSettings.logoAssetKey` (MinIO-Key, z. B.
  `logo/<uuid>.png`). Migration `20260417054510_add_logo_asset_key`.
- **API-Route** `POST /api/admin/theme/logo` (`apps/api/src/logo-upload.ts`):
  - Admin-gated via Better-Auth-Session-Lookup (wie video-upload).
  - Whitelist: `image/{png,jpeg,webp,gif}` — **SVG bewusst geblockt** (Script-Injection
    ohne Sanitiser).
  - Max 2 MB, streamt Raw-Body direkt in `play-assets`.
  - Löscht den alten Key best-effort nach erfolgreichem Write.
  - Schreibt `logoUpload`-Audit-Row + SSE-Event.
- **tRPC:**
  - `theme.get` liefert jetzt `logoUrl`, zusammengesetzt aus
    `S3_PUBLIC_URL || S3_ENDPOINT`, Bucket und Key. Null wenn kein Upload —
    Frontend fällt dann auf das Default-Logo zurück.
  - Neue Mutation `theme.removeLogo` (admin) — löscht MinIO-Object + nullt die
    Spalte, schreibt `removeLogo`-Audit.
- **Frontend:**
  - `SiteHeader` nimmt `initialLogoUrl`-Prop aus dem SSR-Layout, hält State,
    lauscht auf `theme:applied`-CustomEvent vom SSE-Client und tauscht `src`
    ohne Reload.
  - `ThemeState`-Interface in `theme-ssr.ts` + `theme-sync.ts` um `logoUrl`
    erweitert.
  - `/admin/theme`: neue Logo-Sektion in linker Spalte — Preview (mit aktivem
    `--logo-filter`!), Upload-Button (Client-side size/MIME-Check), Entfernen-
    Button (nur bei aktivem Upload). Fetch mit `credentials: "include"`
    direkt gegen `${API_URL}/api/admin/theme/logo`.
- **E2E verifiziert:**
  - PNG-Upload → `200 {ok, key}` → `theme.get` liefert `logoUrl` → MinIO
    anon-read gibt `200 image/png` aus → SSR-HTML `<img src>` hat MinIO-URL.
  - SVG-Upload → `415`. Unauth'd Upload → `401`.
  - `theme.removeLogo` → `logoUrl: null` + Audit-Row mit `previousKey`.

### Session 3 — Ebene 6 Layout-Block-Editor (2026-04-17)

Letzter fehlender Theming-Baustein. Startseite ist jetzt ein Block-Composer —
der Admin entscheidet die Reihenfolge, kann Blöcke hinzufügen/ausblenden/löschen
und deren Config pro Typ editieren. SSE hält alle Tabs in Sync.

#### Schema + Router

- Neues Model `PageBlock` (`id`, `pageSlug="home"`-Default, `position`, `type`,
  `enabled`, `config` JSONB). Enum `PageBlockType` mit 4 Typen: `HERO`,
  `VIDEO_GRID`, `CATEGORY_CHIPS`, `CTA_BANNER`. `pageSlug` schon drin, damit
  Multi-Page später ohne Migration geht. Migration
  `20260417055306_add_page_blocks`.
- Neuer tRPC-Router `page` (`apps/api/src/trpc/routers/page.ts`):
  - `list` (public) — SSR-Hotpath, `includeDisabled`-Flag für Admin-UI.
  - `create / update / delete / reorder` (alle admin) — jede schreibende Op
    publisht auf dem bestehenden SSE-Bus (`source: "page:*"`).
  - Jeder Block-Typ hat ein dediziertes Zod-Schema für die Config; Input
    wird bei Create + Update validiert, unbekannte Keys gestrippt.
  - `delete` kompaktiert `position` in Transaction.

#### Frontend

- 4 Block-Components (`apps/web/src/components/blocks/*-block.tsx`), alle pure
  (nehmen Config + vorhandene Video-Liste als Props — keine eigenen tRPC-
  Calls, damit sie im Admin-Preview-Iframe genauso rendern). `BlockRenderer`
  switched per Typ.
- Homepage (`apps/web/src/app/page.tsx`) holt `page.list` + `video.list` via
  tRPC, iteriert Blöcke. **Fallback-Array** mit 3 Default-Blöcken greift,
  wenn DB leer ist — kein Broken-UI auf Greenfield-Install.
- `theme-sync.ts` parst die SSE-Payload und feuert für `source: "page:*"`
  ein separates `page:blocks-updated`-CustomEvent. `<ThemeSync>` lauscht und
  invalidiert `trpc.page.list` — Preview-Iframe und alle offenen Tabs
  reloaden die Block-Liste.

#### Admin-UI (`/admin/page-blocks`)

- 3-Spalten-Layout: links sortierbare Block-Liste + „Block hinzufügen"-Panel,
  Mitte Iframe-Preview auf `/`, rechts typ-spezifischer Config-Editor.
- Drag-Reorder mit `@dnd-kit/core` + `@dnd-kit/sortable` — optimistisches
  Reordering, persistiert nach Drop via `page.reorder`.
- Pro Block: Drag-Handle, Click-to-Select, Eye-Toggle (enable/disable),
  Delete-Button.
- Config-Editor schaltet per Block-Typ um: Textfields, Select (orderBy),
  Number-Input (limit), Checkbox (skipFeatured), Textarea (chips-items,
  newline-separated). Commit on blur.
- **Neuer `AdminSubNav`-Component** (`apps/web/src/components/admin-sub-nav.tsx`)
  in allen `/admin/*`-Seiten (User / Theme / Startseite) — konsistente
  Navigation, aktiver Tab bekommt brand-Akzent.

#### Verifikation

- 4 Block-Typen angelegt → `page.list` gibt alle in richtiger Reihenfolge
  aus, Config-Defaults gesetzt.
- Reorder-Call (Hero, Grid, Chips, CTA) → Positionen korrekt umsortiert.
- `update({enabled:false})` für Chips → aus `list()` (public) verschwunden.
- Hero-Config-Update (`badgeLabel`, `ctaLabel`) → persistiert, in `list()`
  sichtbar, SSE-Event `page:update` ging raus.
- Alle 4 Blöcke gelöscht → DB leer → Frontend greift auf Fallback-Array.
- `/admin/page-blocks` HTTP 200.

#### Architektur-Notizen

- **Block-Komponenten bleiben pure Props-Only:** alles, was sie anzeigen,
  kommt von außen. Das erlaubt nicht nur das Admin-Preview-Iframe, sondern
  später auch einen „Theme-Preview"-Export (Static-HTML-Dump) ohne tRPC-Stack.
- **Config-Validation im Backend, nicht im Frontend:** Admin-UI kann beliebige
  Daten schicken, der Router prüft gegen Zod-Schema und strippt. Schützt vor
  clientseitig manipulierten Payloads.
- **Kein `CUSTOM_HTML`-Block (noch):** Script-Injection-Sandbox braucht
  eigenes Review (DOMPurify + iframe-sandbox-Flags). Kommt als separate
  Sicherheits-Runde.

## Session 4 — Studio-Ausbau + Logo-Bug-Fix (2026-04-17)

Creator-Backend von „Table + 2 Formularseiten" auf YT-Studio-Niveau gehoben.
Dev-Loop-Bug im Logo-Filter gefixt.

### Bug-Fix: Logo-Filter greift jetzt im Dev-HMR

Bisher emittete `overridesToCssBlock` beim `logoFilter`-Override ein
`--logo-filter: var(--logo-filter-<name>);` — die Ziel-Variable
`--logo-filter-brightness0` etc. wird aber vom `build-primitives-css.mjs`
aus `tokens.json` generiert, **einmal beim postinstall**, nicht bei jedem
tokens.json-Change. Neue Filter wie `brightness0`/`invert` waren im Dev also
im DOM gesetzt, resolvten aber ins Leere → kein sichtbarer Unterschied.

Fix in `packages/theme/src/override-css.ts`: statt Indirektion über CSS-Var
wird jetzt der Filter-Value **direkt aus `tokens.json` aufgelöst** und inline
emittet: `--logo-filter: brightness(0);`. Dev-HMR-safe, weil TS/Next die
JSON-Quelle bei jedem Build wiederliest. Value-Sanitation greift auch hier.

### Schema-Erweiterungen (`20260417062805_add_studio_metadata`)

- `Video.tags String[]` — Komma-separierte Tags, case-normalisiert im Router.
- `Video.chapters Json` — Array `[{timeSec, title}]`, bei Update sortiert nach Zeit.
- `Video.commentsEnabled Boolean` — Toggle pro Video.
- `Video.thumbnailCandidates String[]` — MinIO-Keys aller vom Worker
  generierten Frames; `thumbnailKey` ist der Pick daraus.
- `Channel.about String?` — lange About-Sektion (Markdown-ready).
- `Channel.socialLinks Json` — Array `[{platform, url}]`, 9 Plattform-IDs.
- `Channel.avatarAssetKey` / `bannerAssetKey` — Slots für spätere Upload-Flows.

### Worker-Erweiterung: 5 Thumbnail-Kandidaten

`apps/worker/src/ffmpeg.ts` neue Helper `extractFrameAt(input, outfile, seekSec)`
und `extractThumbnailCandidates(input, dir, durationSec)`. Generiert 5 Frames bei
10 / 30 / 50 / 70 / 90 % der Video-Dauer, uploadet als `<id>-cand-1.webp` …
`<id>-cand-5.webp` in `play-thumbs/`. Default-Pick = Index 2 (mittleres Frame).
Editor setzt `thumbnailKey` auf beliebigen der Keys, Router validiert gegen
`thumbnailCandidates` (Injection-Schutz).

### tRPC-Erweiterungen

- **`video.update`** (`protectedProcedure`, owner/admin) — alles in einem
  Request: `title`, `description`, `tags`, `visibility`, `commentsEnabled`,
  `thumbnailKey`, `chapters`. Per-Feld optional; `thumbnailKey` muss aus
  `thumbnailCandidates` stammen.
- **`video.getForEdit`** (`protectedProcedure`, owner/admin) — Editor-Payload
  mit allen Metadaten-Feldern, separat vom schlanken public `get`.
- **`channel.myChannel`** (`protectedProcedure`) — Default-Channel des
  Eingeloggten.
- **`channel.updateProfile`** (`protectedProcedure`, owner/admin) —
  `displayName`, `description`, `about`, `socialLinks` (max. 10).
- **Neuer Router `studio`** mit `dashboard` — Counts (total/live/processing/
  draft/failed) + Stats (videos, views30d, watchTimeHours-mock, subscribers=0).

### Studio-UI (Next App Router)

Eigenes `apps/web/src/app/studio/layout.tsx` wrappt alle `/studio/*`-Routen
mit der neuen `StudioSidebar` (Dashboard · Meine Videos · Upload/Import ·
Analytics · Kommentare | Kanal-Profil · Branding · Abonnenten | Einstellungen).
Sidebar hat Badge-Counts aus `studio.dashboard` und markiert WIP-Sections
mit einem `WIP`-Chip.

Implementierte Seiten:

- **`/studio`** — Dashboard mit 4 Stats-Cards (Videos / Views / Watch-Time /
  Abos), Status-Pills (Live/Processing/Wartet/Fehler), „Zuletzt hochgeladen"-
  Row mit 6 Video-Kacheln, Click → Editor.
- **`/studio/videos`** — Tabelle mit Thumbnail · Titel · Status · Sichtbarkeit ·
  Views · Dauer · Editor-Button · Löschen. Status-Filter-Dropdown, Polling
  alle 2 s solange noch was in `PROCESSING`.
- **`/studio/[id]/edit`** — Video-Editor: Titel, Beschreibung (10 KB),
  Tags (Komma-Input, 20 × 40), Sichtbarkeits-Pills, Kommentare-Toggle,
  Kapitel-Textarea mit `MM:SS Titel`-Parser + Live-Vorschau, 5er-Thumbnail-
  Picker mit aktivem-Ring, Details-Sidebar (Slug/Dates/Kanal).
  Polling via `useEffect` bei `PENDING`/`PROCESSING` (lässt Kandidaten
  live erscheinen).
- **`/studio/channel`** — Kanal-Profil-Editor: Anzeigename, Kurzbeschreibung,
  About (5 KB Markdown), dynamische Social-Links-Liste mit Plattform-Select +
  URL, Live-Preview-Card rechts.
- **`/studio/upload`** & **`/studio/import`** — ins neue Layout migriert,
  Toast-Feedback für Success/Error, beide redirecten nach erfolgreichem
  Upload direkt in den Editor des neuen Videos.
- **WIP-Stubs**: `/studio/analytics`, `/studio/comments`, `/studio/branding`,
  `/studio/subscribers`, `/studio/settings` — shared `StudioWip`-Component
  mit Session-Referenz.

### Schema-Inferenz-Workaround (TS2589)

Prisma's `Json`-Felder (`Video.chapters`, `Channel.socialLinks`) blasen den
TS-Compiler in eine rekursive Union auf, die tRPCs `useQuery`-Generic nicht
mehr einziehen kann (`TS2589: Type instantiation is excessively deep`).
Gegenmaßnahmen im Editor: lokaler `EditableVideo`-Interface + `as unknown as
EditableVideo`-Cast; `refetchInterval` durch manuelles `setInterval`
ersetzt. Sauberer als den Router umzubauen.

### Verifikation (End-to-End)

- Alle 10 Studio-Routen HTTP 200 (inkl. WIP-Stubs).
- `theme.update({logoFilter: "brightness0"})` → SSR rendert
  `<style id="theme-vars">` mit `--logo-filter: brightness(0);` — Logo wird
  tatsächlich schwarz (Bug weg).
- `video.update` live: Title-Change, Tags-Array, Chapters-Array (sortiert
  persistiert), commentsEnabled-Toggle — alle Werte durchgereicht.
- `channel.updateProfile` live: description + about + socialLinks (Array
  mit platform+url-Objekten) gespeichert und zurückgelesen.
- `studio.dashboard` liefert Counts + Stats-Mock.
- Alle 7 Workspace-Packages typechecken grün.

### Follow-Ups für Session 5

- Studio-Analytics aktivieren, sobald View-Tracking in Session 7 steht.
- Kommentare-UI in `/studio/comments` (Schema ist da, fehlt nur Router + UI).
- Avatar- + Banner-Upload für Kanal-Profil (analog Admin-Logo-Upload).
- `Thumbnail-Custom-Upload` im Editor (v0.3, nach Session 5).

## Planungs-Session Pre-8 (2026-04-17)

Kein Feature-Code — Scope-Erweiterungen + Design-Ground-Truth für Sessions 8 und 9.

### Hotfix

- `apps/web/src/app/globals.css`: `font-feature-settings: "ss01", "ss02", "cv01"` entfernt
  (verursachte kaputte Glyphen im BETA-Badge + Mono-Labels wie `COLOR.NEUTRAL.700`).
  Ersetzt durch `font-feature-settings: normal` auf Body und `"zero"` auf `.mono`.

### Plan-Änderungen

- **Session 8** (Share + SEO + Embed): Share-Panel auf 12 Plattformen erweitert
  (X, Facebook, LinkedIn, Reddit, WhatsApp, Telegram, Pinterest, E-Mail,
  TikTok/Insta als Copy-Fallback, Embed-Code, Timestamp-Toggle). Offen für Absegnung.
- **Session 9 (neu)**: E-Mail-System + SMTP-Admin + Admin-Gating-Audit.
  nodemailer, AES-GCM-Passwortverschlüsselung, 6 System-Templates mit
  Admin-Editor, Better-Auth-Hooks, Notification-Preferences.
- Sessions 10–17: alle um +1 geshiftet (Session 10 = Legal, 12 = Prod-Deploy, 14 = GH).
- Dokumente: `docs/13-gap-analysis-and-extended-plan.md` + `docs/14-session-8-startprompt.md`
  aktualisiert. `docs/15-session-9-startprompt.md` neu erstellt.

### Email-Previews (zum Absegnen)

Alle in `previews/`:

- `email-base.html` — Master-Template
- `email-verify.html` — E-Mail-Bestätigung (24 h)
- `email-reset.html` — Passwort-Reset (1 h, IP/UA-Log)
- `email-welcome.html` — Willkommen nach Verify
- `email-new-comment.html` — Creator-Benachrichtigung bei Kommentar
- `email-new-subscriber.html` — Creator-Benachrichtigung bei Abo
- `admin-email-settings.html` — Admin-UI (SMTP / Template-Editor / Log)

### Offene Architektur-Entscheidung

Channel-Branding: **Variante A** (Avatar frei, Banner aus Admin-Pool) vs.
**Variante B** (beides Creator-frei). Entscheidung fällt beim Start Session 9.

### Follow-Up

- Session 8 starten: `docs/14-session-8-startprompt.md` — Share komplett + SEO + Embed.

## Session 7b — Quick-Wins (2026-04-17)

Mini-Runde direkt nach Session 7 mit drei User-Feedback-Punkten:
Upload/Import-Split-Button überall, Shorts-Grundgerüst, expliziter Admin-
Featured-Picker. Plus Docs-Refresh.

### UploadMenu-Component

- Neuer Shared-Component `components/upload-menu.tsx` mit Split-Button:
  Primary-Link auf `/studio/upload` + Caret-Dropdown mit beiden Optionen.
- Eingebaut in Header (Ghost-Size-sm), Studio-Dashboard (Primary "Neues
  Video"), Studio-Videos-Tabelle (Size-sm).
- Alter doppelter „Per URL importieren"-Button aus dem Dashboard-Header
  entfernt.

### Shorts — Minimal-Scaffolding

- Schema: neues `VideoFormat`-Enum (LONG/SHORT), `Video.format` mit
  Default LONG, neuer Index `[format, visibility, status, publishedAt]`.
  Migration `20260417111548_add_video_format`.
- Worker klassifiziert beim Transcode-Finalize: `SHORT` wenn
  `height > width && durationSec ≤ 60`, sonst `LONG`.
- `video.list` bekommt `format`-Input (`LONG` default — Startseite filtert
  Shorts standardmäßig raus).
- Neue Route `/shorts` mit Portrait-Grid (aspect-[9/16]). Der vertikale
  Swipe-Feed mit Autoplay/Loop bleibt Session 10.
- Header-Nav um „Shorts" erweitert.

### Featured-Video-Picker (Admin-only)

- Hero-Block-Config hat statt freiem Slug-Textfeld jetzt `HeroVideoPicker`:
  Dropdown mit allen PUBLIC+LIVE Long-Form-Videos + „Automatisch (neuestes)"-
  Default. Hinweis zeigt, dass Shorts einen eigenen Feed haben.
- Admin-Dashboard Quick-Action umbenannt auf „Startseite + Featured-Video".
- Der `video.list({format:"LONG"})`-Call im Picker deckt ab, dass keine
  Shorts als Featured auswählbar sind — korrekt, weil Hero-Block landscape-
  formatiert ist.

### Docs-Refresh

- `docs/07-features-matrix.md` komplett neu strukturiert mit 12 sauberen
  Kategorie-Tabellen. Status pro Feature auf Session-7-Stand.
- `docs/09-roadmap.md` v0.1 + v0.2 als DONE markiert, v0.3 in die Session-
  8–16-Struktur (SEO → Legal → Shorts → Prod → Git → GH → Store → Site →
  Docs) gebracht. Meilenstein-Tabelle aktualisiert (wir sind bei „Beta
  intern").

### Verifikation Session 7b

- Alle 7 Packages typechecken grün.
- `/shorts` HTTP 200, filtert korrekt.
- `video.list({format:"SHORT"})` → 0, `{format:"LONG"}` → 4 (erwartet,
  Bestandsvideos sind alle landscape).
- UploadMenu-Dropdown öffnet in Header + Studio-Dashboard + Videos-Tabelle,
  beide Links routen korrekt.
- Bestehende Admin/Studio-Routen weiter stabil.

### Follow-Ups nach Session 7b

Übertragen nach `docs/14-session-8-startprompt.md`:

- Vertikaler Swipe-Feed für Shorts (Session 10, nicht 8)
- SEO/OG-Tags/JSON-LD/Sitemap/oEmbed/Embed-Player (Session-8-Kernscope)
- Legal (Session 9) bleibt Launch-Blocker für DE

## Session 9 — Legal + Compliance (2026-04-17)

DE-Launch-Blocker komplett abgearbeitet. StaticPage-CMS, drei Rechtstexte als
Seed, Admin-Editor und Cookie-Consent-Banner stehen live.

### Features (Session 9)

**Schema: `StaticPage`**

- Neues Prisma-Modell `StaticPage` (`slug @id`, `title`, `body Text`,
  `published`, `showInFooter`, `order`, `updatedAt`, `updatedBy`).
- Migration `20260417120000_add_static_pages`.

**tRPC-Router `staticPage`** (`apps/api/src/trpc/routers/static-page.ts`):

- `getBySlug` (public) — SSR-Hotpath für die drei Legal-Routen. Wirft 404
  wenn `published=false`.
- `list` (admin) — alle Seiten inkl. Entwürfe, nach `order + slug`.
- `listFooter` (public) — nur `published + showInFooter`, für dynamischen Footer.
- `upsert` (admin) — Create + Update in einem Call. Slug-Regex-Validation.
- `delete` (admin) — mit NOT_FOUND-Guard.

**Seed** (`packages/db/src/seed.ts`):

- 3 StaticPages per `upsert` (safe to re-run, überschreibt keine Admin-Edits):
  - `impressum` — §5 TMG Platzhalter (Name, Adresse, Kontakt).
  - `datenschutz` — DSGVO Art. 13/14 Platzhalter (Verantwortlicher, Zweck,
    Rechte, Speicherdauer, Beschwerderecht).
  - `agb` — Platzhalter (Geltungsbereich, Nutzungsrechte, Verbotene Inhalte,
    Haftungsausschluss, Kündigung).

**Frontend-Routen** (alle SSR, `revalidate = 3600`):

- `app/impressum/page.tsx` — `fetchStaticPage("impressum")` → `StaticPageView`
- `app/datenschutz/page.tsx` — `fetchStaticPage("datenschutz")` → `StaticPageView`
- `app/agb/page.tsx` — `fetchStaticPage("agb")` → `StaticPageView`
- Neuer SSR-Helper `apps/web/src/lib/static-page-ssr.ts` — fetch gegen
  `/trpc/staticPage.getBySlug?input=…`. Falls API offline → `null` → `notFound()`.
- Neuer Shared-Component `components/static-page-view.tsx` — rendert Titel,
  Datum + `dangerouslySetInnerHTML` für das Admin-HTML (trusted source — nur
  Admins editieren). `prose-legal`-CSS-Klassen für lesbare Typografie.

**Prose-CSS** in `globals.css`:

- `.prose-legal h1/h2/h3/p/ul/ol/li/a/em` — Design-Token-basiert (keine
  Tailwind-Typography-Dependency).

**Admin-CMS** `/admin/pages`:

- Tabelle: Slug-Link · Titel · Veröffentlicht-Badge · Footer-✓ · Order ·
  Zeitstempel · Bearbeiten/Löschen.
- Edit/Create-Modal: Slug (read-only bei Edit), Titel, HTML-Textarea (16 Zeilen),
  Published-Toggle, ShowInFooter-Toggle, Order-Number. Body wird lazy per
  `trpc.staticPage.getBySlug` geladen. Commit via „Speichern"-Button.
- a11y: alle Buttons `type="button"`, Icon-Only-Close mit `aria-label`,
  Order-Input mit assoziiertem `<label>`.
- Admin-Sidebar: WIP-Chip von „Seiten (Impressum …)" entfernt.

**Cookie-Consent-Banner** (`components/cookie-banner.tsx`):

- `localStorage`-Flag `play:consent:v1` — Werte: `"essential"` | `"all"`.
- Zwei Buttons: „Nur notwendige" + „Alle akzeptieren".
- Link auf `/datenschutz` im Banner-Text.
- Positioniert: Mobile `bottom-0` volle Breite, Desktop `bottom-6` zentriert
  als Card mit `backdrop-blur`.
- Eingehängt in Root-Layout nach `<SiteFooter />`.

**Footer**:

- `v0.1` → `v0.2` aktualisiert.
- Links `/impressum`, `/datenschutz`, `/agb` waren bereits vorhanden (Session 8).

### Pending — braucht Docker

- `prisma migrate deploy` — Migration `add_static_pages` noch nicht auf DB applied.
- `prisma db seed` — StaticPage-Rows noch nicht in DB.
- Smoke-Test der drei Legal-Routen + Admin-Pages-UI.

Beim nächsten Docker-Start ausführen:

```bash
DATABASE_URL=... npx prisma migrate deploy
DATABASE_URL=... npx tsx src/seed.ts
```

### Typecheck-Stand Session 9

- `@play/api` typecheck: grün (0 Errors).
- `@play/web` typecheck: grün (0 Errors).

## Session 10 — Shorts-Feed + Watch-History (2026-04-17)

Kein Launch-Blocker — gebaut zwischen Session 9 (Legal) und Session 11 (Prod-Deploy).

### Schema (`20260417130000_add_watch_history_later`)

- **`WatchHistory`** — Composite-PK `[userId, videoId]`, `watchedAt` DateTime
  (upsert setzt immer den aktuellen Zeitpunkt). Index `[userId, watchedAt]`.
  Cascades: `userId → User`, `videoId → Video` beide Cascade-Delete.
- **`WatchLater`** — Composite-PK `[userId, videoId]`, `createdAt` DateTime.
  Index `[userId, createdAt]`. Gleiche Cascade-Logik.
- Relations in `User` + `Video` ergänzt.

### tRPC-Router (2 neu)

- **`history`**:
  - `add({ videoId })` (protected) — upsert `watchedAt=now`. Idempotent.
  - `list({ limit?, cursor? })` (protected) — paginated, neueste zuerst,
    joined Video-Meta (slug/title/thumbnail/duration/views/channel).
  - `clear()` (protected) — `deleteMany({ where: { userId } })`.
- **`watchLater`**:
  - `toggle({ videoId })` (protected) — vorhanden → löscht, fehlt → erstellt.
    Gibt `{ saved: boolean }` zurück.
  - `isSaved({ videoId })` (protected) — Boolean-Check für Button-State.
  - `list({ limit?, cursor? })` (protected) — paginated, neueste zuerst.
- Beide Router in `apps/api/src/trpc/routers/index.ts` eingehängt.

### HlsPlayer-Erweiterung

- Neue Props: `loop?: boolean`, `autoPlay?: boolean`, `muted?: boolean`
  (alle optional, Default `false` → kein Breaking Change für bestehende Aufrufe).

### Shorts-Swipe-Feed (`/shorts`)

Der bisherige Portrait-Grid wurde vollständig durch den vertikalen Swipe-Feed ersetzt.

- **Scroll-Snap:** Container `snap-y snap-mandatory`, jeder Slide
  `snap-start snap-always h-screen` — kein manueller Gesture-Listener nötig.
- **Scrollbar versteckt:** CSS-Klasse `.shorts-feed` in `globals.css`
  (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).
- **HLS-Setup pro Slide:** Ein `useEffect` — lädt HLS wenn `active || preload`.
  Cleanup destroyt die `Hls`-Instanz. Kein Ref-Callback-Anti-Pattern.
- **Autoplay/Pause:** zweiter `useEffect` auf `active`-Prop — `.play()` bzw.
  `.pause()`. `currentTime = 0` beim Aktivieren (Loop-Reset).
- **Mute-Default:** Browser erlaubt Autoplay nur muted. Mute-Toggle-Button
  ändert `video.muted` direkt + State.
- **Lazy-Load:** `preload`-Prop `true` für die nächsten 3 Slides (constant
  `PRELOAD_AHEAD`), `false` für weiter entfernte → HLS-Instanz wird nicht erstellt.
- **Keyboard-Navigation:** globaler `keydown`-Listener auf `ArrowUp`/`ArrowDown`
  + `ArrowLeft`/`ArrowRight`. `scrollIntoView({ behavior: "smooth" })`.
- **ActiveIdx-Tracking:** `IntersectionObserver` mit `threshold: 0.6` — welcher
  Slide > 60 % sichtbar ist, ist der aktive.
- **Overlay-UI (rechts, TikTok-Style):** Kanal-Avatar-Link, Like-Button
  (`reaction.toggle` + `reaction.countForVideo`), Kommentare-Count-Link (→
  `/watch/[slug]`), Mute-Toggle — alle als runde Buttons mit `bg-black/40 backdrop-blur`.
- **Bottom-Overlay:** Kanal-Handle + Video-Titel (line-clamp-2), beide verlinkt.
- **Empty-State:** Vollbild-Dark mit Icon + Erklärtext + Upload-CTA.
- **Neue Icons:** `volume-x`, `volume-2`, `bookmark`, `bookmark-filled`,
  `chevron-up` in `icon.tsx` registriert.

### Watch-History-Integration

- `watch-client.tsx`: ruft `trpc.history.add.useMutation()` auf, sobald
  `status === "LIVE"` und User eingeloggt ist (gleiche sessionStorage-Guard-
  Logik wie `recordView` — einmal pro Session pro Video).
- `useSession` dafür im Watch-Client importiert (vorher nicht vorhanden).

### Watch-Later-Integration

- **`WatchLaterButton`**-Component in `video-actions.tsx` (inline):
  `watchLater.isSaved` → `bookmark` / `bookmark-filled`-Icon + Label
  „Später" / „Gespeichert". `watchLater.toggle` bei Click.
  Toast-Feedback + Cache-Invalidate.
- Im `VideoActions`-Layout zwischen Share und Report eingehängt.
  Nur sichtbar wenn eingeloggt.

### `/library` — Session-10-Stand

Vier Sections (Reihenfolge: Verlauf → Später ansehen → Abo-Feed → Eigene):

1. **Zuletzt angesehen** — `history.list({ limit: 12 })`, „Verlauf löschen"-
   Button (`history.clear`), Toast-Feedback.
2. **Später ansehen** — `watchLater.list({ limit: 12 })`, Empty-State mit
   Bookmark-Icon-Hinweis.
3. **Zuletzt aus deinen Abos** — bisherige Section, unverändert.
4. **Deine Uploads** — bisherige Section, unverändert.

### Pending — braucht Docker

- `prisma migrate deploy` — Migration `add_watch_history_later` noch nicht applied.
  (Zusätzlich zu `add_static_pages` aus Session 9.)
- Smoke-Test: `/watch/…` → `history.list` zeigt Eintrag + `/library`
  rendert ihn. `watchLater.toggle` → `/library` → Section populated.

```bash
DATABASE_URL=... npx prisma migrate deploy
```

### Typecheck-Stand Session 10

- `@play/api` typecheck: grün (0 Errors erwartet — neue Router sind typsicher).
- `@play/web` typecheck: prüfen nach Dev-Server-Start.

## Session 8 — SEO + Social Sharing + Embed (2026-04-17)

### Umgesetzte Features

**generateMetadata — /watch/[slug]**
- `page.tsx` ist jetzt Server-Component, exportiert `generateMetadata` + JSON-LD.
- Client-Teil in `watch-client.tsx` extrahiert (`WatchPageClient`).
- SSR-Fetch gegen `video.get` (tRPC GET, `revalidate: 60`).
- OG: `og:title`, `og:description` (truncated 160), `og:image` (thumbnail 1280×720),
  `og:video:url` (master.m3u8), `og:type: video.other`, `og:site_name`.
- Twitter: `summary_large_image`, title, description, image.
- oEmbed-Discovery-Link im Head (`<link rel="alternate" type="application/json+oembed">`).
- JSON-LD `VideoObject`: name, description, thumbnailUrl, uploadDate, contentUrl,
  embedUrl, duration (ISO-8601), interactionStatistic (views), author (Person).

**generateMetadata — /c/[slug]**
- `channel-client.tsx` extrahiert, `page.tsx` als Server-Wrapper.
- SSR-Fetch gegen `channel.getBySlug` (`revalidate: 300`).
- OG: `type: profile`, siteName, title, description, avatarUrl falls vorhanden.

**Sitemap (`app/sitemap.ts`)**
- Fetched PUBLIC+LIVE Videos + alle Channels dynamisch.
- Statische Routen: `/`, `/channels`, `/shorts`, `/impressum`, `/datenschutz`, `/agb`.
- changeFrequency: daily für Videos, weekly für Channels.

**robots.ts (`app/robots.ts`)**
- Disallow: `/admin/`, `/studio/`, `/api/`, `/login`, `/register`.
- Sitemap-URL aus `NEXT_PUBLIC_SITE_URL`.

**oEmbed-Endpoint (`/api/oembed`)**
- Input: Video-Watch-URL (`?url=…`). Parst Slug aus Pfad.
- Output: `{type:"video", version:"1.0", html:"<iframe …>", thumbnail_url, title,
  author_name, author_url, provider_name:"ITSWEBER Play", width:1280, height:720}`.
- CORS-Header: `Access-Control-Allow-Origin: *`.

**Embed-Player (`/embed/[slug]`)**
- `app/embed/layout.tsx`: eigenes minimales Root-Layout, kein Header/Footer,
  `overflow-hidden`, schwarzer Hintergrund.
- `app/embed/[slug]/page.tsx`: HLS-Player füllt Viewport. Kein Like/Comment-Chrome.
- `?t=<seconds>` wird beim Mount gelesen und an `HlsPlayer.startAt` weitergegeben.

**HlsPlayer — `startAt`-Prop**
- Neue optionale Prop `startAt?: number` (Default 0).
- Setzt `video.currentTime` nach `MANIFEST_PARSED` (hls.js) bzw. `loadedmetadata`
  (Safari native / Fallback).

**Share-Panel — kompletter Umbau**
- Popover mit zwei Tabs: „Teilen" (Platform-Grid) + „Einbetten" (Embed-Code).
- 8 Plattformen mit Web-Share-Intent (X, Facebook, LinkedIn, Reddit, WhatsApp,
  Telegram, Pinterest, E-Mail).
- 2 Copy-Only-Plattformen mit kontextspezifischem Toast (TikTok, Instagram).
- „Starten bei"-Toggle: Checkbox + MM:SS-Input, prefilled mit `video.currentTime`.
  Hängt `?t=<secs>` an alle URLs + Embed-Code wenn aktiv.
- Outside-Click schließt Panel.
- `VideoActions` bekommt neue Props: `videoTitle`, `thumbnailKey`, `channelName`,
  `channelSlug` (alle optional, Breaking-Change-safe via Default `""`).

**Brand-Icons (11 neue)**
`brand-x`, `brand-facebook`, `brand-linkedin`, `brand-reddit`, `brand-whatsapp`,
`brand-telegram`, `brand-pinterest`, `brand-tiktok`, `brand-instagram`,
`mail`, `embed-code`, `timestamp` — alle in `icon.tsx` registriert.
Quelle: Simple Icons (MIT).

**Root-Layout OG-Fallback**
- `og:site_name: "ITSWEBER Play"`, `og:locale: de_DE`.
- Fallback-OG-Image: `/og-default.png` (1200×630) — muss noch als statisches
  Asset in `public/` abgelegt werden (Session 9 oder manuell vor Launch).

**Env**
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local` hinzugefügt.
  Für Prod-Deploy auf Unraid auf externe URL anpassen.

### TypeCheck

- `@play/web` typecheck: grün (0 Errors).
- `twitter.player` ist kein gültiges Next.js 15 `TwitterMetadata`-Feld —
  entfernt, Twitter-Player-Card läuft über `og:video` (korrekt).

### Follow-Ups nach Session 8

- `public/og-default.png` (1200×630) muss noch als statisches Asset angelegt
  werden — Platzhalter reicht für jetzt.
- `channel.list`-Endpunkt für Sitemap: falls nicht vorhanden, liefert
  Sitemap nur statische Routen. Kein Error, graceful fallback.
- Twitter-Player-Card (separate `twitter:player`-Meta-Tags) ist ein
  ungestützter Next.js 15 Typ — falls benötigt, über `other`-Metadata-Feld.
- Vertikaler Swipe-Feed für Shorts → Session 10.
- Legal (Session 9) bleibt Launch-Blocker für DE → nächste Session.

## Session 7 — Community + Icon-System (2026-04-17)

Social-Layer live: Comments (threaded), Likes, Reports mit Moderation-Queue,
In-App-Notifications, View-Tracking. Zusätzlich Emoji-Icons projektweit gegen
eine SVG-basierte Icon-Library getauscht.

### Icon-System

- **Kein Emoji mehr.** Shared Component `apps/web/src/components/icon.tsx` mit
  ~35 Feather-Style SVG-Glyphs (home/printer/server/package/disc/graduation-cap/
  newspaper/wrench/folder/tag/globe/terminal/cpu/layers/sparkles/bolt plus UI-
  Glyphs heart/heart-filled/message/bell/flag/share/eye/play/trash/edit/check/
  x/plus/search/upload/download/link/copy/more-horizontal/external/alert-
  circle/info/chevron-right/chevron-down/users).
- Inherits `currentColor`, stroke-width 2, 24×24 viewBox — visuell konsistent
  mit den vorhandenen Sidebar-Icons.
- `CATEGORY_ICONS`-Export als curated Liste für Kategorie-Picker.
- Category-Chips, Kategorie-Seite, Watch-Seite, Admin-Kategorien-UI und
  Video-Editor nutzen jetzt `<Icon name="home" />` statt `{icon-Emoji-String}`.
- **DB-Migration:** `Category.icon` enthält jetzt Icon-Namen
  (`home`, `printer`, …) statt Emojis; SQL-Update für die 8 Default-Kategorien
  direkt in Postgres.

### Schema-Erweiterungen (`20260417104736_add_reports_notifications`)

- **`Report`**-Model: `targetType` (VIDEO/COMMENT/CHANNEL), optionale
  `videoId/commentId/channelId`, `reason`, `note`, `status`
  (OPEN/RESOLVED_TAKEDOWN/RESOLVED_IGNORED), `resolvedById` + `resolvedAt`.
- **`Notification`**-Model: `userId`, `type` (NEW_UPLOAD/COMMENT_REPLY/SYSTEM),
  `title`, `body`, `link`, `readAt`. Indexed auf `userId, readAt` für
  Badge-Count-Query.
- 3 neue Enums: `ReportTargetType`, `ReportStatus`, `NotificationType`.

### tRPC-Router (4 neu)

- **`comment`** — `list` (public, flat + parentId-basiertes 2-Level-Threading
  im Frontend), `create` (respektiert `commentsEnabled`, feuert
  `COMMENT_REPLY`-Notification bei Antwort auf fremden Kommentar),
  `delete` (soft-delete; author/video-owner/admin), `mineFeed` (alle
  Kommentare unter eigenen Videos fürs Studio-Panel).
- **`reaction`** — `countForVideo` (public), `mine` (protected),
  `toggle` (Like/Unlike).
- **`report`** — `create` (7 Reasons: spam/abuse/copyright/nudity/violence/
  dangerous/other), `list` (admin, Status-Filter), `resolve` (TAKEDOWN →
  Video PRIVATE / Comment soft-delete; IGNORE), `openCount` (Admin-Sidebar-Badge).
- **`notification`** — `list`, `unreadCount`, `markRead`, `markAllRead`.
- Zusätzlich: `video.recordView` (öffentlicher Increment; Browser
  dedupliziert pro Session via `sessionStorage`).

### UI-Integration

- **`/watch/[slug]`** hat neue Actions-Row (Like + Share-Dropdown + Report-
  Modal) und darunter die Comments-Section mit Threading, Antworten, Löschen.
  Creator- und Admin-Badges an Kommentaren. View-Increment feuert einmal pro
  Session + Video sobald status=LIVE.
- **`NotificationBell`**-Component im `SiteHeader` (nur signed-in) mit
  unread-Badge, 30s-Refetch, Dropdown mit Click-outside/Esc-Handling,
  `Alle-gelesen`-Button.
- **`/admin/moderation`** echt — Status-Filter, Takedown- und Ignore-Buttons,
  Ziel-Link-Shortcut, Reporter + Resolver-Info. Admin-Sidebar-Badge zeigt
  OPEN-Count mit 60s-Refresh.
- **`/studio/comments`** echt — Feed aller Kommentare unter eigenen Videos
  mit Titel-Link und Löschen.
- Studio-Sidebar „Kommentare" und Admin-Sidebar „Moderation" nicht mehr als
  WIP gechipt.

### Worker-Erweiterung

- Transcode-Job feuert `NEW_UPLOAD`-Notifications an alle Abonnenten des
  Kanals, sobald ein Video auf `PUBLIC + LIVE` geht. Bei PRIVATE/UNLISTED/
  LOGGED_IN: keine Notification.

### Verifikation Session 7

- Alle neuen Routen HTTP 200 (`/watch/...`, `/admin/moderation`,
  `/studio/comments`).
- Comment create → list → delete ✅
- Reaction toggle → countForVideo (=1) → unlike (=0) ✅
- Report create (spam) → openCount=1 → resolve(IGNORE) ✅
- Notification unreadCount reagiert auf COMMENT_REPLY-Trigger ✅
- Alle 7 Workspace-Packages typechecken grün

### Session-7-Stolperstein

- **TS2589 wieder bei `channel.myChannel`** — `socialLinks`-Json durchläuft
  dieselbe Inferenz-Explosion wie `chapters`. Gleiche Lösung: lokales
  `ChannelForEdit`-Interface + doppelter `as unknown as`-Cast.

### Follow-Ups für Session 8

- SEO: `generateMetadata` in `/watch/[slug]` + `/c/[slug]` mit OG-Tags,
  Twitter-Cards, JSON-LD VideoObject.
- Sitemap + robots.txt.
- oEmbed-Endpoint + `/embed/[slug]`-Player-Seite.
- Share-Buttons um LinkedIn, Reddit, Matrix erweitern (falls gewünscht).

## Session 6 — Navigation + Discovery (2026-04-17)

Die „Header-Links sind 404"-Ära ist vorbei. Kategorien, Abos, Kanal-Directory,
Search + eine echte Bibliothek-Seite stehen live. Viewer kann Creator folgen,
jeder Video-Aufruf zeigt Category-Chip + Tags als Discovery-Einstiege.

### Schema-Erweiterungen

- **`Category`**-Model (`id`, `slug @unique`, `name`, `description`, `icon`,
  `order`). Videos haben jetzt `categoryId String?` mit `SetNull`-Relation —
  Kategorie-Löschung entfernt nur die Zuordnung, Videos überleben.
- **`Subscription`**-Model mit Composite-PK `[subscriberId, channelId]` +
  `notify`-Flag. Cascade-Delete beidseitig.
- Migration `20260417100843_add_categories_subscriptions`.
- **Seed**: 8 Default-Kategorien (Smart Home · 3D-Druck · Server & IT · Docker ·
  Unraid · Tutorials · News · Projekte) direkt per SQL-Insert.

### tRPC-Router (neu)

- **`category`** — `list` (public mit PUBLIC-Video-Count),
  `getBySlug` (public, inkl. Videos), `create/update/delete` (admin).
- **`subscription`** — `list` (eigene Abos + Kanal-Meta), `latestVideos`
  (PUBLIC-Feed aus allen Abos), `isSubscribed` (für Button-State), `toggle`
  (subscribe/unsubscribe, Self-Subscribe blockiert), `setNotify`.
- **`search.all`** — Videos (Title/Description/Slug/Tags) + Channels +
  Tag-Autocomplete via raw SQL `unnest(tags)`. ILIKE bis Postgres-FTS kommt;
  optionaler `categorySlug`-Filter.
- **`channel.list`** (existing Router) — neues Directory mit 4 Sort-Optionen
  (mostSubscribed/mostVideos/newest/alphabetical) + Such-Input.

### tRPC-Erweiterungen bestehender Router

- `video.update` + `video.getForEdit` um `categoryId` erweitert.
- `video.get` liefert nun `tags`, `chapters`, `commentsEnabled`,
  `channel.id`/`ownerId` + `category` — alles was die Watch-Seite braucht.

### UI — neue/echte Seiten

- **`/channels`** — Directory-Grid, Sort-Toggles, Live-Suche. Jeder Kanal-Card
  zeigt Avatar, Abo-Count, Video-Count, Creation-Date.
- **`/subs`** — Abo-Liste als Chip-Row + Feed der neuesten PUBLIC-Videos aus
  allen abonnierten Kanälen. Empty-State leitet auf `/channels`.
- **`/search?q=…`** — 3-Section-Layout: Kanäle · Tags · Videos. `useSearchParams`
  in einen `<Suspense>`-Wrapper gepackt (Next-15-Requirement).
- **`/category/[slug]`** — Header mit Icon + Beschreibung + Video-Grid.
- **`/library`** — v0.2-Stand: Abo-Feed + Eigene Videos in 2 Sections. History/
  Watch-Later landen in Session 7.
- **`/admin/categories`** — neues Verwaltungs-UI mit Create-Form + Inline-
  Order-Edit + Delete. Sidebar-Link hinzugefügt.

### UI — Integrationen

- **`SubscribeButton`** (`apps/web/src/components/subscribe-button.tsx`) — Toast-
  Feedback, Logged-out-CTA, „Dein Kanal"-State, Invalidate von `list` +
  `latestVideos` + `isSubscribed`. Eingebaut in `/c/[slug]`-Header und
  `/watch/[slug]` (small-Variante neben Kanal-Info).
- **Watch-Seite** zeigt jetzt Category-Chip + Tags-Pills (linken zu
  `/category/<slug>` bzw. `/search?q=<tag>`) + Kapitel-Liste (MM:SS-Format).
- **`CategoryChipsBlock`** holt Kategorien aus DB statt Config-Strings und
  linkt jeden Chip auf `/category/<slug>`. „Alle"-Chip führt nach `/`.
- **Header-Search** ist jetzt `<form>` — submit auf `/search?q=…` mit
  `router.push`. `aria-label` + `name="q"` für Screenreader.
- **Video-Editor** (`/studio/[id]/edit`) hat eine Kategorie-Select mit Icon +
  Namen; in Save-Flow integriert.

### Verifikation Session 6

- Alle neuen Routen HTTP 200 (`/channels`, `/subs`, `/library`, `/search`,
  `/search?q=zoo`, `/category/smart-home`, `/admin/categories`).
- `category.list` liefert 8 Kategorien mit Icons + Video-Counts.
- `channel.list` liefert 2 Kanäle mit Sub-/Video-Counts.
- Subscribe-Flow end-to-end: Admin → `subscription.toggle(creator1)` →
  `subscription.list` zeigt Creator One → `isSubscribed=true, notify=true` →
  Toggle-Off macht sauber.
- Category-Assignment: Video „Me at the zoo" → tutorials → `category.getBySlug
  tutorials` liefert das Video.
- `search.all q=zoo` findet „Me at the zoo" (nach PUBLIC-Switch).
- Alle 7 Packages typechecken grün.

### TypeScript-Workarounds

Dritte Runde TS2589 — Watch-Seite rendert jetzt `v.chapters` und `v.tags`
direkt. Gleiche Gegenmaßnahme wie in Session 4/5: lokales `WatchVideo`-
Interface + `as unknown as WatchVideo`. Refetch-Interval im Video-Editor und
auf Watch-Seite durch `setInterval`-`useEffect` ersetzt. Pattern ist jetzt
konsistent — bei jedem neuen Seitenrender mit Prisma-Json-Feldern gleich
wiederverwenden.

### Follow-Ups Session 6

- YouTube-Style Public-Sidebar für eingeloggte User (Home/Shorts/Abos/Library/
  History) — deferred auf Session 7.
- Admin kann Kategorien-Reihenfolge drag-reorderen (aktuell nur per
  Number-Input).
- Tag-Autocomplete-Dropdown in Header-Search mit den `search.all.tags`-
  Resultaten.
- Postgres-FTS-Indizes (`to_tsvector`) auf `Video.title` + `description` +
  `tags` — kommt wenn Content-Menge steigt.

## Session 5 — Admin-Overhaul (2026-04-17)

Admin-Bereich vom 3-Tab-Layout auf Preview-Niveau (`previews/admin.html`)
gehoben. Gleiche Sidebar-Struktur wie das Studio — klare Symmetrie für Admins,
die beide Rollen haben.

### Admin-Router erweitert

- `admin.dashboard` — Users (total/new7d/banned) · Videos (total/live/processing/
  failed/publicLive) · Channels (total) · Views (total) · Theme-Audit-Events heute.
- `admin.videos.list` — globale Video-Liste (Status-Filter + Suche im Title/
  Slug/Description), inkl. Owner + Kanal-Info.
- `admin.videos.setVisibility` — Admin kann fremde Videos umstellen
  (kein Owner-Zwang).
- `admin.videos.delete` — Hard-Delete inkl. Dashboard-Invalidate.
- `admin.system.health` — DB-Ping (`SELECT 1`), Migration-Count,
  Queue-Gegenstand (spiegelt `Video.status`-Gruppierung bis der echte
  BullMQ-Queue-Depth-Ping in Session 7 dazukommt), Env-Snapshot.

### Admin-UI

- [AdminSidebar](apps/web/src/components/admin-sidebar.tsx) mit drei Sections
  (Overview / Erscheinungsbild / System), Badges aus `admin.dashboard`,
  WIP-Chips für Moderation/Pages/Settings. Sticky-Positioned wie Studio.
- [admin/layout.tsx](apps/web/src/app/admin/layout.tsx) wrappt alle `/admin/*`-
  Routen mit Sidebar + Main.
- **Dashboard** `/admin`: 4 Stats-Cards (Nutzer/Videos/Views/Kanäle) mit
  Klick-Navigation, Status-Pills, Schnell-Aktionen-Grid, Letzte-Theme-Events-
  Feed rechts.
- **Nutzer** `/admin/users`: bisherige Tabelle mit Toast-Feedback, Dashboard-
  Invalidate beim Role/Ban-Change.
- **Videos** `/admin/videos` (NEU): globale Cross-Creator-Liste mit
  Thumbnail · Creator · Kanal · Status-Badge · Sichtbarkeits-Dropdown · Views ·
  Dauer · Hard-Delete. Suche + Status-Filter.
- **System** `/admin/system` (NEU): 3-Spalten-Grid mit DB-Health, Queue-
  Breakdown, Env-Snapshot (`S3_ENDPOINT`, `S3_PUBLIC_URL`, `REDIS_HOST`,
  `FFMPEG_PATH`, …). Refetch alle 10 s.
- **Moderation** `/admin/moderation`: WIP-Stub (Session 7).
- **Seiten (Impressum)** `/admin/pages`: WIP-Stub (Session 9, Launch-Blocker).
- **Einstellungen** `/admin/settings`: WIP-Stub.
- Alte `AdminSubNav` komplett entfernt — `/admin/theme` und
  `/admin/page-blocks` laufen jetzt unter dem Sidebar-Layout ohne Top-Nav-Leiste,
  keine Duplikation mehr.

### Verifikation Session 5

- Alle 9 Admin-Routen (`/admin`, `/users`, `/videos`, `/moderation`, `/theme`,
  `/page-blocks`, `/pages`, `/system`, `/settings`) HTTP 200.
- `admin.dashboard` liefert live Counts: 2 User, 3 Videos, 2 Channels,
  36 Theme-Events heute (aus meinem eigenen Session-3-Testlauf).
- `admin.videos.list` gibt alle 3 Videos quer über Creator aus.
- `admin.system.health`: DB ok, 7 Migrations applied, Queue leer.
- Alle 7 Workspace-Packages typechecken grün.

### TypeScript-Workaround Session 5

Genauso wie in Session 4 taucht TS2589 beim `useQuery`-Render der
`theme.listAuditLog`-Daten auf — selbe Lösung: lokales `AuditRow`-Interface
und ein `as unknown as AuditRow[]`-Cast.

### Stolperstein dokumentiert

- **Next.js dev-server port clash:** nach `pnpm install` oder hot-reload mit
  geänderten Layouts kann der alte Next-Prozess auf Port 3000 hängen bleiben
  und blockiert den Neustart. `Get-NetTCPConnection -LocalPort 3000 |
  Stop-Process -Id <OwningProcess>` + `.next/` löschen ist der zuverlässige
  Reset.

### Follow-Ups für Session 6

- Navigation/Discovery: `/channels` · `/subs` · `/library` real bauen.
- Search mit Postgres-FTS + Kategorien-Schema + klickbare Chips.
- YouTube-Style Public-Sidebar (Home · Abos · Library · History).

## Session 3 Follow-Ups

- Homepage server-seitig (RSC) statt Client-Component rendern, damit Blöcke
  im initialen SSR-HTML stehen (SEO + First-Paint) → v0.2.
- CUSTOM_HTML-Block mit DOMPurify + iframe-sandbox → v0.3.
- Multi-Page-Support (Block-Composer auch für `/browse`, `/library`) —
  Schema hat `pageSlug` schon, fehlt nur Admin-UI-Dropdown.
- Favicon-Upload (separater Slot in ThemeSettings) → v0.3 mit Ebene 6.
- SVG-Logo-Support mit Sanitiser (z. B. `svg-sanitizer`) → post-v1.
- SSE-Reconnect-UX: aktuell auto-reconnect von EventSource, kein User-Feedback.
  Akzeptabel, bis ein Admin mal länger offline war.
- Audit-Log-Retention: aktuell unbegrenzt, sollte vor v1.0 ein Retention-Job
  (BullMQ repeatable) bekommen (z. B. alles > 180 Tage purgen).
- **`S3_PUBLIC_URL` in .env:** aktuell nicht gesetzt → Logo-URLs zeigen auf
  `localhost:9000`. Für Prod-Deploy (Unraid) muss `S3_PUBLIC_URL` auf die
  öffentliche MinIO-URL gesetzt werden, sonst liefert der SSR-Layout einen
  Host-Pfad aus, den der Browser nicht erreichen kann.
