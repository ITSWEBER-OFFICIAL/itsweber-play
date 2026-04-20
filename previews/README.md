# Previews — ITSWEBER Play

Drei standalone HTML-Demos. Einfach im Browser öffnen (doppelklicken oder `file://…`), **kein Build**, **keine Server-Dependency**.

## Die Seiten

**Kern-Screens (interaktiv, Preview-CSS):**

| Datei | Zweck |
|---|---|
| [`home.html`](home.html) | **Öffentliche Startseite** — Hero (Featured), Kategorie-Chips, zwei Video-Grids (Latest + Abos) |
| [`studio.html`](studio.html) | **Play Studio** (Creator-Backend) — Dashboard-Stats, Video-Tabelle mit Status-Badges, Inline-Editor mit Timeline-Trim, Thumbnail-Picker, Kapitel, Metadaten-Formular |
| [`admin.html`](admin.html) | **Admin-Dashboard mit LIVE Theme-Editor** — das Kern-Differenzierungsmerkmal. Token-Sidebar links, Live-Preview Mitte, Presets + Custom CSS rechts |
| [`admin-email-settings.html`](admin-email-settings.html) | **Admin · E-Mail** — SMTP-Einstellungen, Test-Mail-Diagnostik, Template-Editor mit Live-Preview, Versand-Log |

**E-Mail-Templates (inline-CSS, Outlook-safe, max 600 px):**

| Datei | Ausgelöst bei |
|---|---|
| [`email-base.html`](email-base.html) | **Master-Template** mit Header/Footer — Grundlage aller anderen Mails |
| [`email-verify.html`](email-verify.html) | Registrierung → Adresse bestätigen (24 h gültig) |
| [`email-reset.html`](email-reset.html) | Passwort-Reset angefordert (1 h gültig, mit IP/UA-Log) |
| [`email-welcome.html`](email-welcome.html) | Nach erfolgreichem Verify — 3-Step-Einführung |
| [`email-new-comment.html`](email-new-comment.html) | Neuer Kommentar zu eigenem Video (pref-gesteuert) |
| [`email-new-subscriber.html`](email-new-subscriber.html) | Neuer Abonnent des eigenen Kanals (pref-gesteuert) |

## Das Killer-Feature: Theme-Editor

`admin.html` ist **interaktiv**. Probier:

1. **Colorpicker** in der linken Spalte ändern → Preview rechts reagiert in Echtzeit
2. **Preset-Wechsel** (Dark/Light/High-Contrast/Retro) → komplettes Umschalten aller Tokens
3. **Radien-Slider** → Borders aller Komponenten passen sich live an
4. **Logo-Filter** ändern → Glow, Duotone, Invert usw. direkt am Logo sichtbar
5. **Custom CSS** editieren → „anwenden" injiziert es live (Sandbox-Ebene 5)
6. **Export JSON** → lädt das aktuelle Theme als JSON (Import-Flow in der echten App dann via Upload)
7. **Reset** → lädt die Seite neu (Default-Theme)

## Design-Entscheidungen (per Skills begründet)

- **Typografie**: `Geist` + `Geist Mono` (Vercel, variable) — entspricht `frontend-design`-Guidance („avoid Inter, pick distinctive"). Mono dient als **Akzent** für Zahlen, Timestamps, Tags → signalisiert „tech creator"-Tone ohne brutalistisch zu werden.
- **Farbsystem**: Dark-first mit Teal-Akzent (ITSWEBER-Signal, übernommen aus MediaCMS für Markenkontinuität). Heller Hero-Eindruck von itsweber.de bewusst **nicht** übernommen.
- **Layout**: Card-basiertes Grid wie itsweber.de (Blog-Post-Stil), aber dunkler. Sidebar für Studio/Admin — keine Top-Tabs (skalierfähig für mehr Menüpunkte).
- **Motion**: Nur auf Page-Load (`.rise`-Animation mit Staggering) und Hover. `prefers-reduced-motion` respektiert. Keine Dekorations-Animationen.
- **Accessibility**: Focus-Rings (2-3px), Kontrast ≥ 4.5:1 (getestet Dark-Preset), Touch-Targets ≥ 40px, Semantic HTML, `aria-label` auf Icon-Buttons.
- **Typ-Hierarchie**: Mono für Daten (Zeiten, Zählerwerte, Token-Namen) — so wird Tech-Content visuell vom Fließtext abgegrenzt, ohne dass die Seite überladen wirkt.

## Logo-Handling

Alle drei Seiten laden das Logo **live von itsweber.de**:
`https://itsweber.de/uploads/media/logos/media_d5e82b218f8b98cd.png`

Beim Build der echten App wird es lokal gespiegelt (MinIO `play-assets/logo.png`). Der CSS-Filter (`drop-shadow` glow) ist Token-gesteuert (`--logo-filter`), im Admin änderbar.

## Bekannte Einschränkungen der Previews

- Video-Thumbnails kommen von Unsplash (nur für Demo-Zweck — werden in Produktion vom Worker aus den Uploads generiert)
- Keine echten Datenquellen — alle Zahlen sind Mockups
- Responsives Verhalten unter 900px bricht das Admin-3-Spalten-Layout auf 1-Spalte um, ist aber nicht für Mobile optimiert (die echte Admin-UI wird Desktop-first sein, mobile-friendly erst v1)

## Zum Ausprobieren

```bash
# Windows
start previews/home.html

# oder einfach im Explorer doppelklicken.
```
