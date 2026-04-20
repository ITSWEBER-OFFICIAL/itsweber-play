# 22 — Prompt für neue Session: Pre-Deploy-Block A (E-Mail + Favicon + Auth-Pages)

> Copy-paste den unteren Block in die neue Claude-Code-Session als erste Nachricht.
> Datum bei Wiederaufnahme: nach 2026-04-18.

## Hintergrund-Doku

Der vollständige Plan + die Aufteilung in Block A/B/C steht in [`docs/21-pre-deploy-blockers.md`](21-pre-deploy-blockers.md). Aktueller Implementierungsstand in [`docs/11-progress.md`](11-progress.md). Memory-Snapshot in `c:\Users\itswe\.claude\projects\c--Users-itswe-Documents-ITSWEBER-Projekte-ITSWEBER-Play-Docker\memory\`.

## Empfohlene Skills für diese Session

- **`frontend-design`** — für die drei neuen Auth-Pages (`/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`). Distinctive, nicht-generisch, passend zum bestehenden Studio/Admin-Layout.
- **`ui-styling`** — wenn shadcn/ui-Components für Form-Inputs gebraucht werden (oder bei den Mail-Templates schicke HTML-Layouts).
- **`design`** — falls du das neue ITSWEBER-Brand-Preset auf die Login-Seiten anwenden willst.
- **`codex:rescue`** — als Fallback für tiefere Debugs (Better-Auth-Mail-Hooks sind manchmal kniffig).
- **`obsidian-markdown`** — für die Daily-Notes-Updates am Ende.

Skills NICHT relevant: `claude-api` (das Projekt nutzt Better-Auth + nodemailer, nicht den Anthropic SDK), `home-assistant-*`, `banner-design`, `slides`.

---

## ================ COPY AB HIER ================

Wir bauen ITSWEBER Play weiter. Lies zuerst diese Dateien (in dieser Reihenfolge):

1. [CLAUDE.md](CLAUDE.md) — Projektübersicht + Konventionen
2. `c:\Users\itswe\.claude\projects\c--Users-itswe-Documents-ITSWEBER-Projekte-ITSWEBER-Play-Docker\memory\project_session_13_status.md` — letzter Stand
3. [docs/21-pre-deploy-blockers.md](docs/21-pre-deploy-blockers.md) — vollständige Block-A/B/C-Liste
4. [docs/11-progress.md](docs/11-progress.md) — was bereits live ist (Sessions 1–13 + E + F)

Sessions A–F + Format-Hint sind durch. Plattform funktional v0.3-komplett, alle 7 Workspace-Packages typechecken grün. Demo-Content via `SEED_DEMO=1`. Neuer ITSWEBER-Brand-Theme-Preset (`packages/theme/presets/itsweber-brand.json`) ist angelegt — der spiegelt den itsweber.de-Header (dunkles Navy + Atom-Grün-Akzent).

**Diese Session bearbeitet Block A komplett — die echten Launch-Blocker für das öffentliche DE-Release.** Block B (Unraid-Verifikation) und Block C (GH-Hygiene) kommen in Folge-Sessions.

### Reihenfolge (PL-Anweisung — direkt umsetzen)

1. **Schema** (zuerst, Migrationsblock vor allem anderen):
   - Neues Singleton-Model `SmtpSettings` in `packages/db/prisma/schema.prisma` (host, port, secure, user, password, fromName, fromAddress, lastTestAt, lastTestResult, updatedAt, updatedBy).
   - Migration anlegen via `node ./node_modules/prisma/build/index.js migrate dev --create-only --name add_smtp_settings --schema prisma/schema.prisma` (Prisma direkt, weil pnpm-Script `--` falsch parsed). VOR pnpm install/migrate alle Node-Prozesse killen (Windows-DLL-Lock).

2. **Backend E-Mail-Modul** (`apps/api/src/email/`):
   - `transport.ts` — Lazy-Singleton-Nodemailer-Transporter, lädt SMTP-Settings aus DB beim ersten Aufruf, refresht via SSE wenn Admin Settings ändert.
   - `templates.ts` — 6 Templates als TypeScript-Funktionen `(vars) => { subject, html, text }`:
     - `welcome` — nach Registrierung
     - `email-verify` — mit Token-Link
     - `password-reset` — mit Token-Link
     - `comment-notify` — wenn jemand auf eigenen Comment antwortet (User-Pref `emailOnComment`)
     - `subscriber-notify` — wenn neuer Abonnent (User-Pref `emailOnSubscriber`)
     - `takedown-notify` — wenn Admin Video taked-downed
   - `send.ts` — `sendMail({ to, template, vars })`, mit Fallback `console.warn` wenn keine Settings konfiguriert.
   - HTML-Templates schick: ITSWEBER-Brand-Farben (#3FE48B Akzent, dunkles Navy BG), Inline-Styles für Mail-Client-Kompatibilität, Footer mit Plattform-Logo.

3. **Better-Auth-Hooks** in `apps/api/src/auth.ts`:
   - `emailVerification.sendVerificationEmail` → `sendMail({ template: "email-verify" })`
   - `emailAndPassword.sendResetPassword` → `sendMail({ template: "password-reset" })`
   - `emailVerification.requireVerification: true` (wenn neue User Email verifizieren müssen — pragmatisch: false für jetzt, weil INVITE-Mode noch kommt).

4. **tRPC-Router** `admin.smtp` in `apps/api/src/trpc/routers/admin.ts`:
   - `get` — aktuelle Settings (admin-only)
   - `update` — Settings speichern, Transport-Cache invalidieren
   - `testConnection` — versucht Verbindung, gibt Resultat zurück
   - `sendTestMail({ to })` — sendet Test-E-Mail an angegebene Adresse, default Admin-Email

5. **Frontend-Auth-Pages** (`apps/web/src/app/auth/`):
   - `forgot-password/page.tsx` — Email-Input, ruft `authClient.forgetPassword({ email, redirectTo: "/auth/reset-password" })`
   - `reset-password/page.tsx` — liest `?token=...`, neuer Passwort-Form, ruft `authClient.resetPassword({ newPassword, token })`
   - `verify-email/page.tsx` — liest `?token=...`, ruft `authClient.verifyEmail({ query: { token } })`, redirect auf `/`
   - Login-Page (`apps/web/src/app/login/page.tsx` oder analog) um „Passwort vergessen?"-Link erweitern
   - **Skill `frontend-design` einsetzen** für distinctive, nicht-generische Layouts. Glassmorphism oder Bento-Grid passt gut zum dunklen Navy-Theme.

6. **Admin-UI für SMTP** in `apps/web/src/app/admin/settings/page.tsx`:
   - Vierten Tab „E-Mail" hinzufügen (neben Allgemein/Registrierung/Video-Defaults/Umgebung)
   - SMTP-Form mit allen Feldern aus dem Schema
   - „Testverbindung"-Button (Live-Spinner, grün/rot Resultat)
   - „Test-Mail an mich"-Button mit aktueller Admin-Email als Default
   - Sektion „Letzter Test" mit Datum + Resultat
   - Skill `ui-styling` falls shadcn-Form-Components helfen.

7. **Favicon-Set** in `apps/web/public/`:
   - `favicon.ico` (Standard 32×32 + 16×16, multi-size)
   - `icon-192.png` + `icon-512.png` (für PWA-Manifest später)
   - `apple-touch-icon.png` (180×180)
   - **Wichtig:** als ITSWEBER-Atom-Logo in Brand-Farben (Atom-Grün #3FE48B auf Navy #0A1A26)
   - Integration in `apps/web/src/app/layout.tsx` via `metadata.icons.{ icon, apple, shortcut }`

8. **Verifikation**:
   - `node "C:/Program Files/nodejs/node_modules/corepack/dist/pnpm.js" -r typecheck` — alle 7 Packages grün
   - SMTP-Test gegen lokalen MailHog oder echten SMTP-Server (Admin gibt Adresse vor — fragen falls unklar)
   - Forgot-Password-Flow: Email anfordern → Token im SMTP-Empfang prüfen → neuen Passwort setzen → Login funktioniert
   - Verify-Email-Flow analog
   - Browser-Test: alle drei Auth-Seiten optisch sauber, responsive

9. **Docs + Memory updaten**:
   - `docs/11-progress.md` mit neuem Session-G-Block ergänzen
   - `c:\Users\itswe\Documents\ITSWEBER\Second-Brain\05 Daily Notes\YYYY-MM-DD.md` Daily-Note schreiben
   - `c:\Users\itswe\Documents\ITSWEBER\Second-Brain\02 Projekte\ITSWEBER Play Docker.md` Status updaten
   - Memory `project_session_13_status.md` updaten (Session G done, Session H = Block B Unraid-Deploy nächster Schritt)

### Wichtige Konventionen aus dem Projekt

- **PL-Delegation:** User ist Architekt, Claude ist PL. Operative Entscheidungen ausführen, nicht Optionen vorlegen. Wenn etwas nicht klar ist, eine Empfehlung mit Begründung — nicht 3 Optionen.
- **SVG-Icons statt Emojis** überall (Shared `<Icon />` aus `apps/web/src/components/icon.tsx`).
- **Theme-Tokens-only** — keine hardcoded Farben in Komponenten. Brand-Farben kommen aus `var(--color-brand)` etc.
- **TS2589-Workaround:** Bei Prisma-Json-Feldern lokales Interface + `as unknown as X`-Cast (Pattern in `channel-client.tsx`).
- **Windows-pnpm-Pfad:** `node "C:/Program Files/nodejs/node_modules/corepack/dist/pnpm.js" --filter <pkg> <cmd>`.
- **Vor migrate/install:** Node-Prozesse killen wegen DLL-Lock (oder zumindest Web/API-Prozesse stoppen — Prisma-Engine-Lock).
- **Migrations:** `dotenv -e ../../.env -- node ./node_modules/prisma/build/index.js migrate dev --create-only --name X --schema prisma/schema.prisma` aus `packages/db/`.

### Gates für Block A "done"

- [ ] `SmtpSettings`-Migration applied
- [ ] 6 E-Mail-Templates rendern, Test-Send funktioniert
- [ ] Better-Auth-Mail-Hooks aktiv
- [ ] `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` HTTP 200, optisch sauber
- [ ] Admin-SMTP-UI funktional (Test-Connection grün)
- [ ] Favicon-Set live, Browser-Tab zeigt ITSWEBER-Atom
- [ ] Alle 7 Packages typechecken grün
- [ ] Docs + Memory updated

Wenn alles durch ist, sind wir bereit für **Block B (Unraid-Deploy + Verifikation)** in der Folge-Session.

## ================ COPY BIS HIER ================

## Was nach Block A kommt

- **Block B (Session I):** Unraid-Deploy. Docker-Compose-Bauen + auf Host pushen, Reverse-Proxy, DNS, Backup-Skript, Smoke-Tests. Skill: keine spezifischen — eher Bash + Doku-Konsultation. Optional `home-assistant-*` ist hier NICHT relevant.
- **Block C (Session J):** GH-Push-Hygiene. LICENSE (AGPL-3.0), CONTRIBUTING.md, SECURITY.md, README-Hero-Überarbeitung mit Screenshots, GH-Actions-CI. Skill: `github-actions-docs` für die CI-Workflow-Datei.
- **Backlog (post-Launch):** PWA, Postgres-FTS, MediaCMS-Migration, Authentik-OIDC, Responsive-Pass.
