# Session 9 — Startprompt: Legal + Compliance (Launch-Blocker DE)

Wir bauen ITSWEBER Play weiter. Lies zuerst in dieser Reihenfolge:

1. CLAUDE.md — Projektübersicht + Konventionen
2. docs/11-progress.md — aktueller Stand bis Session 8 (SEO + Embed)
3. docs/13-gap-analysis-and-extended-plan.md — komplette Roadmap
4. docs/07-features-matrix.md — Feature-Scope + Status

## Stand vor Session 9

**v0.1 + v0.2 + Session 8 sind DONE.** Kurzform Session 8:
- generateMetadata in /watch/[slug] + /c/[slug] (Server-Wrapper + Client-Extract)
- JSON-LD VideoObject Schema.org im Watch-Head
- app/sitemap.ts — dynamisch (Videos + Channels) + statische Routen
- app/robots.ts — Disallow Admin/Studio/API/Login/Register
- /api/oembed — oEmbed-Endpoint für Discord/Slack/Notion/WP-Previews
- /embed/[slug] — Minimal-Frame HLS-Player mit eigenem Layout (kein Header/Footer)
- HlsPlayer: neue startAt-Prop, setzt currentTime nach Manifest
- Share-Panel: Popover mit Grid (8 Plattformen + 2 Copy-Only) + Embed-Tab +
  „Starten bei"-Toggle mit ?t=<secs>
- 11 neue Brand-Icons (Simple Icons, MIT) + mail, embed-code, timestamp
- Root-Layout OG-Fallback: og:site_name, og:locale, Fallback-Image-Slot

**Offene Kleinigkeit vor Session 9:**
- public/og-default.png (1200x630) fehlt noch als statisches Asset.

## Session 9 — Scope: Legal + Compliance (Launch-Blocker für DE)

Dies ist der **einzige Launch-Blocker** vor dem Öffentlich-Gehen.

### Muss in dieser Session

1. **StaticPage-CMS** (/admin/pages):
   - Prisma-Modell StaticPage: slug (unique), title, body (HTML), updatedAt.
   - Admin-UI: Tabelle + Edit-Modal mit Textarea.
   - tRPC-Router page (apps/api/src/trpc/routers/page.ts — prüfen was da ist).
   - Public-Endpoint page.getBySlug für Frontend-Render.

2. **Impressum** (/impressum):
   - Route app/impressum/page.tsx — rendert StaticPage slug=impressum.
   - SSR (kein Client-Component).
   - Seed: Platzhalter §5 TMG (Name, Adresse, Kontakt).

3. **Datenschutzerklärung** (/datenschutz):
   - Route app/datenschutz/page.tsx — rendert StaticPage slug=datenschutz.
   - Seed: Platzhalter DSGVO Art. 13/14 (Verantwortlicher, Zweck, Rechte).

4. **AGB** (/agb):
   - Route app/agb/page.tsx — rendert StaticPage slug=agb.
   - Seed: Platzhalter Geltungsbereich, Nutzungsrechte, Haftungsausschluss.

5. **Cookie-Consent-Banner**:
   - localStorage-Flag play:consent:v1. Zwei Buttons: „Nur notwendige" + „Alle akzeptieren".
   - Component components/cookie-banner.tsx, in Root-Layout eingehängt.
   - Link auf /datenschutz im Banner-Text.

6. **Footer-Links** erweitern:
   - SiteFooter bekommt Links /impressum, /datenschutz, /agb.

7. **Seed-Daten**:
   - Migration für StaticPage-Tabelle.
   - Prisma-Seed mit Platzhalter-Inhalt für alle drei Pages.

### Muss NICHT in dieser Session

- Cookie-Consent mit echtem Consent-Manager — overkill für Single-Instance ohne Tracking.
- GDPR-Datenlösch-Flow — vor v1.0 aber nach Launch.
- Mehrsprachigkeit der Legal-Texte.

## Technische Regeln

- SVG statt Emoji überall.
- User = Architekt, Claude = PL. Operative Entscheidungen führen.
- Prisma-Migration-Flow: migrate dev --create-only --name <x> dann migrate deploy.
- Release-Pipeline: nichts auf GitHub bevor Session 11 (Prod-Deploy) erfolgreich war.
- Modell-Empfehlung: **Sonnet 4.6** reicht für Session 9 komplett.

## Dev-Setup-Reminder

- Admin-Login: admin@itsweber.de / play-dev-admin
- Docker-Services: Postgres/Redis/MinIO via docker-compose.dev.yml

## Nach Session 9

- docs/11-progress.md um Session 9 erweitern.
- Startprompt Session 10 (Shorts-Feed + Watch-History) als docs/16-session-10-startprompt.md.
- Session 10 ist kein Launch-Blocker — erst nach Session 11 (Prod-Deploy).
