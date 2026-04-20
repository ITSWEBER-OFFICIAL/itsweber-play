# Contributing

Danke für dein Interesse an ITSWEBER Play. Dieses Repo ist aktuell in
aktiver Entwicklung — externe PRs sind willkommen, aber Scope-Absprachen
bitte vorher per Issue.

## Entwicklungs-Setup

```bash
git clone git@github.com:ITSWEBER-OFFICIAL/itsweber-play.git
cd itsweber-play
cp .env.example .env
pnpm install
docker compose -f docker-compose.dev.yml up -d --build
```

Siehe [docs/08-development.md](docs/08-development.md) für den vollen
Entwickler-Flow (pnpm-Workspaces, Turborepo, Prisma-Migrations).

## Commit-Style

- Format: `type(scope): subject` — z. B. `feat(studio): analytics mobile cards`
- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`
- Subject auf Deutsch oder Englisch, imperativ, klein, keine Punkte

## Tests & Checks vor jedem PR

```bash
pnpm --filter @play/web typecheck
pnpm --filter @play/api typecheck
pnpm lint
```

Neue tRPC-Endpoints brauchen mindestens ein Happy-Path-Test.

## Pull Requests

- Branch gegen `main`
- PR-Description: Warum (Problem) + Was (Lösung) + Wie getestet
- Screenshots bei UI-Änderungen (Desktop **und** Mobile)
- Kein direkter Push auf `main` — Branch-Protection blockt

## Themen, die momentan NICHT reinpassen

- ActivityPub / Föderation (bewusste Single-Instance-Entscheidung)
- Nicht-Token-basierte Theming-Änderungen (keine hardcoded Farben)
- Migration aus MediaCMS/PeerTube (erst nach MVP)
- GPU-Transcoding (Backlog, `TRANSCODE_USE_GPU`-Opt-in geplant)
