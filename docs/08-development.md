# 08 — Lokale Entwicklung

## Voraussetzungen

- Node.js 22 LTS
- pnpm 9
- Docker Desktop (für DB/Redis/MinIO im Dev-Compose)
- FFmpeg global installiert (nur für `apps/worker` lokale Runs, optional — Dev-Compose bringt's mit)

## Erstsetup

```bash
git clone <repo> itsweber-play && cd itsweber-play
cp .env.example .env
pnpm install
docker compose -f docker-compose.dev.yml up -d play-postgres play-redis play-minio
pnpm --filter @play/db migrate:dev
pnpm --filter @play/db seed
```

## Alle Apps starten

```bash
pnpm dev
# Turborepo startet parallel:
# - apps/web   :3000
# - apps/api   :4000
# - apps/worker
```

## Einzeln

```bash
pnpm --filter @play/web dev
pnpm --filter @play/api dev
pnpm --filter @play/worker dev
```

## Datenbank

- Prisma Studio: `pnpm --filter @play/db studio` → http://localhost:5555
- Schema-Änderung: `packages/db/prisma/schema.prisma` editieren → `pnpm --filter @play/db migrate:dev --name <desc>`

## Tests

```bash
pnpm test             # alle
pnpm --filter @play/api test
pnpm --filter @play/api test:e2e
```

## Lint & Typecheck

```bash
pnpm lint
pnpm typecheck
```

Im CI (GitHub Actions, später): beide laufen bei jedem PR.

## Ordnerstruktur zur Orientierung

```
apps/
  web/         — Next.js 15. Routes gruppiert in (public), (auth), studio, admin.
  api/         — Fastify. Einstieg: src/server.ts → routes/, services/, trpc/.
  worker/      — BullMQ Consumer. Einstieg: src/index.ts.

packages/
  db/          — Prisma (schema + client + seed).
  theme/       — Tokens + Presets + Helpers.
  ui/          — shadcn-basierte Komponenten (Tailwind).
  shared/      — Typen, Validation (zod), Utils, Visibility-Logik.
```

## Commit-Konventionen

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- Scope optional: `feat(studio): trim-editor`

## Branch-Strategie

- `main` — deployable
- `feat/<topic>` — Feature-Branches, PR-Review vor Merge
- Squash-Merge default
