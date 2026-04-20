# 21 — Pre-Deploy-Blockers (vor Unraid-Cutover zwingend)

> Stand: **2026-04-18** — nach Sessions 13 A–F + Format-Hint-Pipeline.
> Diese Doku listet alle Items, die abgeschlossen sein **müssen**, bevor der
> Unraid-Deploy in Frage kommt. Ergänzt um das neue ITSWEBER-Brand-Preset.

## Stand der Plattform

Funktional ist die Plattform v0.3-komplett:

- Upload + yt-dlp-Import mit Long/Short-Wahl
- HLS-Transcode + Captions + Trim-Editor
- Sichtbarkeit (PUBLIC/UNLISTED/PRIVATE/LOGGED_IN), Kategorien
- Abos, Comments (threaded), Likes, Reports, Notifications, Watch-History/-Later, Playlists
- 6-Ebenen-Theming inkl. Live-Editor + Block-Composer (6 Block-Typen)
- Plattform-weite Trennung Long-Videos vs Shorts
- Studio + Admin komplett (Dashboard, Users, Videos, Moderation, Theme, Page-Blocks, Pages, System, Settings, Branding, Analytics, Captions, Subscribers)
- Demo-Content per `SEED_DEMO=1`
- Embed-Player (`/embed/[slug]`), Sitemap, robots.ts, Cookie-Banner
- Logo-Filter inkl. `brightness0`/`invert`
- StaticPage-CMS (Impressum/Datenschutz/AGB seeded)
- DSGVO-Export + Account-Löschung
- Alle 7 Workspace-Packages typechecken grün

## Aufgeteilt in drei Blöcke

### Block A — Launch-Blocker für öffentliches DE-Release

Diese Items machen die Plattform **nicht launch-fähig**, wenn sie fehlen.

#### A1 — E-Mail-System (komplett fehlend)

- `nodemailer` als Dependency in `apps/api/package.json` ergänzen.
- Neuer Singleton `SmtpSettings` in Prisma (host, port, secure, user, password, fromName, fromAddress, lastTestAt, lastTestResult).
- Migration anlegen.
- API-Modul `apps/api/src/email/` mit:
  - `transport.ts` — Lazy-Singleton-Transporter, lädt Settings aus DB
  - `templates.ts` — 6 System-Templates (welcome, email-verify, password-reset, comment-notify, subscriber-notify, takedown-notify) als HTML+Plain-Text
  - `send.ts` — `sendMail({ to, template, vars })` mit Fallback-Log bei fehlendem SMTP
- tRPC-Router `admin.smtp` (`get`, `update`, `testConnection`) — admin-only.
- Better-Auth-Hooks aktivieren:
  - `emailVerification.sendVerificationEmail` → ruft `send("email-verify", { user, token })`
  - `emailAndPassword.sendResetPassword` → ruft `send("password-reset", { user, token })`
- `User.notificationPrefs` schon vorhanden — der Worker liest die Prefs vor dem Versand der Comment/Subscriber-Notifications.

#### A2 — Frontend-Pages für Auth-Flows

- `/auth/forgot-password` — E-Mail-Input, ruft `authClient.forgetPassword()`, success-Page mit „Check Mailbox".
- `/auth/reset-password?token=…` — neuer Passwort-Form, ruft `authClient.resetPassword()`.
- `/auth/verify-email?token=…` — bestätigt Token, ruft `authClient.verifyEmail()`, redirect auf `/`.
- Login-Seite um „Passwort vergessen?"-Link erweitern.

#### A3 — Admin-UI für SMTP

- Neue Sektion in `/admin/settings` mit 4. Tab „E-Mail":
  - SMTP-Host/Port/User/Password-Felder
  - „TLS verwenden"-Toggle
  - From-Name + From-Address
  - „Testverbindung"-Button mit Live-Feedback
  - „Test-Mail an mich"-Button
  - Letztes Test-Datum + Resultat-Anzeige

#### A4 — Favicon-Set

- `apps/web/public/favicon.ico` (Standard 32×32 + 16×16)
- `apps/web/public/icon-192.png` + `icon-512.png` für PWA-Manifest
- `apps/web/public/apple-touch-icon.png` (180×180)
- Integration in `app/layout.tsx` via Metadata.icons

### Block B — Vor Unraid-Cutover verifizieren

Diese Items müssen auf einem realen Unraid-Host getestet werden, bevor der DNS-Switch passieren kann.

#### B1 — Worker-Binaries auf Linux

- yt-dlp-Static-Binary muss im Worker-Container laufen (Windows-Workaround mit `execFile + shell:false` ist Linux-kompatibel, aber ungetestet).
- `@ffmpeg-installer` ARM/x86-Detection auf dem Unraid-Host (Intel-Xeon-CPU laut Serverdoku → x64 sollte passen).
- End-to-End-Test: Upload + Transcode + HLS-Streaming aus dem Container heraus.

#### B2 — Storage + DB Bootstrap

- `ensureBuckets()` läuft beim API-Start automatisch — verifizieren, dass MinIO leer beim ersten Hochfahren OK ist.
- Prisma-Migrations laufen via `migrate deploy` im Worker- oder API-Entrypoint (NICHT `migrate dev`).
- INITIAL_ADMIN-Hook bei erster Registrierung — manuell nach Deploy testen.

#### B3 — Backup-Skript

- Shell-Skript `scripts/backup.sh` (oder Compose-Service):
  - Postgres-Dump (`pg_dump --no-owner --clean`)
  - MinIO-Bucket-Sync via `mc mirror` zu `/mnt/user/backups/itsweber-play/`
  - Tagesweise rotierend, max. 14 Tage
- Restore-Drill: leeren Test-Container mit dem Backup hochfahren, prüfen ob Videos abspielbar sind.

#### B4 — Reverse-Proxy + DNS

- NPM-Config dokumentieren (in `config/npm-proxy-host.md`).
- Subdomain `play-next.itsweber.net` (Dev-Stage) → 10.10.8.50.
- LetsEncrypt-Cert via NPM.
- WebSocket-Pass-Through für SSE (`/api/theme-bus`) verifizieren.

#### B5 — Env-Audit für Prod

- `S3_PUBLIC_URL` muss auf öffentlich erreichbare MinIO-URL zeigen (nicht localhost).
- `AUTH_SECRET` für Prod neu generieren (nicht den Dev-Secret aus `.env` mitschleppen).
- `INITIAL_ADMIN_*` für ersten Login.
- `MAX_UPLOAD_SIZE_MB` auf realistischen Wert (8192 = 8 GB ist OK für Homelab).
- `TRANSCODE_QUALITIES` evtl. auf `1080p,720p` reduzieren wenn die CPU knapp ist.

### Block C — Repo-Hygiene vor GitHub-Push

Diese Items werden gebraucht, damit das Repo public gestellt werden kann (Sessions 13–17 der ursprünglichen Release-Pipeline).

#### C1 — Lizenz + Legal

- `LICENSE`-Datei (Empfehlung **AGPL-3.0**, passt zur PeerTube/MediaCMS-Nachbarschaft).
- `CONTRIBUTING.md` — Branch-Strategie, Conventional Commits, Coding-Standards.
- `SECURITY.md` — Vulnerability-Reporting-Adresse, Disclosure-Policy.

#### C2 — README-Überarbeitung

- Hero-Section mit Tagline + Screenshot
- Feature-Liste (statt Stub)
- Tech-Stack-Block
- Quickstart-Anweisungen für `docker-compose up`
- Badges (build, license, version)
- Link zu docs/

#### C3 — GitHub-Actions-CI

- `.github/workflows/ci.yml` — auf Push: typecheck, build, kein automatisches Deploy.
- Optional: `dependency-review.yml` für Sicherheits-Scan auf PRs.

#### C4 — Secret-Scan

- `git-secrets`- oder `trufflehog`-Lauf vor dem ersten Push.
- Sicherstellen, dass `.env`/`.env.prod` NICHT committed sind (bestätigt via `.gitignore`).

## Neues Theme-Preset: ITSWEBER Brand

Datei: `packages/theme/presets/itsweber-brand.json` (bereits angelegt 2026-04-18).

**Designsprache:** spiegelt den itsweber.de-Header — dunkles Navy als Grundton, kräftiges Atom-Grün (`#3FE48B`) als Brand-Akzent. Logo-Filter `glow` für die signature Atom-Optik. Soll als neues Default-Preset für die Plattform-Version dienen.

Der Admin schaltet das Preset über `/admin/theme` → „Preset anwenden". Die `tokensOverride` werden in der `ThemeSettings`-Singleton gespeichert und live über SSE an alle Clients gepusht.

## Reihenfolge

1. **Sofort vor Unraid-Deploy:** Block A komplett (A1–A4) plus A4 (Favicon).
2. **Auf Unraid:** Block B (B1–B5) verifizieren.
3. **Vor öffentlichem GH-Push:** Block C.

Block C kann auch parallel zu B laufen, weil es rein repo-bezogen ist.

## Nicht-Blocker (Backlog für post-Launch)

- PWA-Manifest + Service-Worker (cool, aber nicht launch-kritisch)
- Audit-Log-Retention-Job (bei < 1000 Audit-Rows pro Tag noch entspannt)
- Postgres-FTS für Search (lohnt erst bei Content-Wachstum)
- Multi-Page-Block-Composer (`/browse`, `/library`)
- CUSTOM_HTML-Block mit DOMPurify
- MediaCMS-Migrations-Skript
- Authentik-OIDC-Reaktivierung
- Responsive-Pass / Mobile-First-Audit
