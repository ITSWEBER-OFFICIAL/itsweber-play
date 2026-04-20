# 03 — Theming-System

Das Kern-Differenzierungsmerkmal gegen MediaCMS/PeerTube. **6 Ebenen** visueller Anpassung, vollständig vom Admin über das Web-UI steuerbar.

## Ebenen-Überblick

| # | Ebene | Wer? | Persistenz |
|---|---|---|---|
| 1 | Primitive Tokens | Entwickler | Code (`packages/theme/tokens.json`) |
| 2 | Semantic Tokens | Entwickler | Code (Tokens zeigen auf Primitives) |
| 3 | Admin Live-Editor | Admin | DB (`theme_settings`-Tabelle) |
| 4 | Preset Themes | Admin (Switch) | Code + DB |
| 5 | Custom CSS Injection | Admin (Sandbox) | DB (versioniert + Audit) |
| 6 | Layout-Blöcke (Startseite) | Admin | DB (`page_blocks`) |

## Ebene 1+2: Token-Struktur

**Primitive** (`packages/theme/tokens.json`):
```json
{
  "color": {
    "neutral": { "50": "#f6f8fa", "...": "...", "900": "#0e1116" },
    "teal":    { "500": "#3ba7a7", "600": "#2d8a8a" },
    "red":     { "500": "#d9534f" }
  },
  "radius": { "sm": "6px", "md": "10px", "lg": "16px" },
  "shadow": { "card": "0 4px 20px rgba(0,0,0,.35)" },
  "font":   { "sans": "'Inter', system-ui, sans-serif" }
}
```

**Semantic** (`packages/theme/semantic.ts`):
```ts
export const semantic = {
  bg: { base: "var(--color-neutral-900)", surface: "var(--color-neutral-800)" },
  fg: { primary: "var(--color-neutral-50)", muted: "var(--color-neutral-400)" },
  brand: { default: "var(--color-teal-500)", hover: "var(--color-teal-600)" },
  danger: "var(--color-red-500)"
};
```

Komponenten (shadcn/Tailwind) konsumieren **nur semantic**. Primitives zu ändern wirkt sich automatisch auf alles aus.

## Ebene 3: Admin Live-Editor

**UI** (`/admin/theme`):
- Linke Spalte: Accordion mit Token-Gruppen (Farben / Typo / Abstände / Radien / Schatten)
- Jeder Token: Colorpicker oder Slider mit Live-Input
- Mitte: Iframe mit `/` (Startseite) — reagiert live auf Änderungen
- Rechte Spalte: Preset-Wahl · Export JSON · Import JSON · Custom-CSS-Tab

**Persistenz**:
- Änderung → PATCH `/trpc/theme.update` → DB
- DB-Row `theme_settings` hat Spalte `tokens_override: jsonb`
- Beim SSR wird `<style id="theme-vars">:root { --color-teal-500: #...; ... }</style>` gerendert

**Live-Update ohne Reload**:
- WS-Event `theme:updated` → Frontend holt neue Token-Map → ersetzt `<style id="theme-vars">`.
- Kein React-Rerender nötig (CSS-Variablen kaskadieren).

## Ebene 4: Presets

Mitgeliefert in `packages/theme/presets/`:
- `itsweber-dark.json` (Default, passend zu itsweber.de)
- `itsweber-light.json`
- `high-contrast.json` (A11y)
- `retro.json` (Fun-Preset)

Preset-Wahl im Admin setzt `tokens_override` auf das Preset-JSON.

## Ebene 5: Custom CSS

**Use-Case**: Admin will einen spezifischen Selektor anpassen (z. B. `.video-card:hover { transform: scale(1.02); }`), der über Tokens nicht erreichbar ist.

**Sicherheit**:
- Nur Rolle `admin` darf editieren
- Input wird durch einen Basic-CSS-Parser validiert (kein `@import`, kein `url(javascript:...)`, kein `expression()`)
- Gespeichert in `theme_settings.custom_css`
- Gerendert als `<style id="theme-custom">` NACH Tokens-Style
- Versionshistorie (letzte 20 Änderungen) für Rollback
- Audit-Log: `User X änderte Custom-CSS um Y`

## Ebene 6: Layout-Blöcke (Startseite)

Startseite ist Block-Composer. Blöcke verfügbar:
- **Hero** (groß, featured video)
- **Kategorien-Chip-Row**
- **Video-Grid** (gefiltert nach: Latest / Most-Viewed / Channel / Tag)
- **Channel-Spotlight**
- **Custom-HTML-Block** (sandbox-iframe)
- **CTA-Banner**

Admin-UI: Drag-Reorder, Block-Config per Dialog. Persistiert in `page_blocks` (JSONB config pro Block).

## Ebene-Reihenfolge im DOM

```html
<head>
  <!-- Ebene 1+2: Default Tokens (immer da) -->
  <style id="theme-tokens-default">...</style>

  <!-- Ebene 3+4: Admin-Overrides -->
  <style id="theme-vars">:root { --color-teal-500: #xx; }</style>

  <!-- Ebene 5: Custom CSS -->
  <style id="theme-custom">.video-card:hover { ... }</style>
</head>
```

Spätere Stil-Layer überschreiben frühere. Reihenfolge ist deterministisch.

## Logo-Handling

- Logo-Upload im Admin → gespeichert in MinIO (`play-assets/logo.png`)
- Im Header als `<img src="/api/asset/logo" style="filter: var(--logo-filter)">`
- `--logo-filter` ist ein eigenes Token (Presets: `none`, `drop-shadow(0 0 12px var(--color-teal-500))`, `brightness(1.2) saturate(1.3)`, …)
- Favicon separat uploadbar

## Export / Import

**Export**: `theme_settings.tokens_override` + `custom_css` + `logo_filter` → JSON-Download
**Import**: JSON upload, Schema-Validierung (`zod`), Preview diff, bestätigen → DB

Ermöglicht Theme-Sharing zwischen Instanzen und Backup vor Experimenten.
