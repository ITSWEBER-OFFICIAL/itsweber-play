# Project-level Claude Skills — ITSWEBER Play

Diese Skills sind projektbezogen installiert und werden von Claude **automatisch** aktiviert, sobald der Arbeitskontext passt (keine manuelle Auswahl nötig).

## Installiert

| Skill | Auto-Trigger bei |
|---|---|
| `frontend-design` | Bau von UI-Komponenten, HTML-Previews, Next.js-Pages |
| `ui-ux-pro-max` | UX-Entscheidungen, Farbsysteme, Layout, Accessibility |
| `ui-styling` | shadcn/ui, Tailwind v4, Theme-Anwendung in Komponenten |
| `design-system` | **Token-Architektur (Kern des Theming!)**, Semantic Layer |
| `brand` | ITSWEBER Brand-Voice, Logo-Regeln, Asset-Konsistenz |
| `design` | Logo-Generierung, Mockups, Presentations, Banner |
| `banner-design` | Default-Thumbnails, Hero-Bilder, Social-Share-Images |
| `typescript-advanced-types` | tRPC-Router, Prisma-Typen, Theme-Token-Types |
| `github-actions-docs` | CI/CD-Workflows für Docker-Image-Build |
| `find-skills` | Falls neue Skill-Bedarfe auftauchen |

## Nicht installiert (aber empfohlen, falls verfügbar)

Die folgenden Skills wurden im Benutzer-Scope nicht gefunden und bleiben systemweit verfügbar (falls per Plugin geladen):

- `obsidian-markdown`, `obsidian-cli` → für Second-Brain-Arbeit
- `simplify` → Code-Review nach Iterationen
- `defuddle` → Web-Content-Extraktion (z. B. itsweber.de Farb-Recherche)

## Pflege

- Neue projektrelevante Skills hier installieren (`cp -r ~/.claude/skills/<name> .claude/skills/`)
- Skills aktualisieren bei Updates der User-Level-Skills: erneutes `cp -r` überschreibt
- Nicht benötigte Skills entfernen, damit der Kontext schlank bleibt

## Warum projektbezogen?

- Versioniert mit dem Repo → andere Maintainer haben denselben Skill-Satz
- Unabhängig von User-Level-Änderungen an `~/.claude/skills/`
- Konsistentes Claude-Verhalten über Zeit und Rechner
