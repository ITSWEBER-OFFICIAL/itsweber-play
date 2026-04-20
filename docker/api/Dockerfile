# ──────────────────────────────────────────────────────────────────────
#  apps/api — Fastify + Better Auth + tRPC
#  Läuft tsx zur Laufzeit (kein Bundler-Schritt). v0.2 ersetzen wir das
#  durch esbuild --bundle, sobald die API-Oberfläche stabil ist.
# ──────────────────────────────────────────────────────────────────────

FROM node:22-slim AS base
RUN corepack enable && \
    apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app

# deps-Stage: nur Manifeste + lock → pnpm install in sauberem Layer
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
COPY packages/theme/package.json packages/theme/tokens.json packages/theme/
COPY packages/theme/scripts packages/theme/scripts
# youtube-dl-exec braucht Python nur auf Windows — im Container überspringen.
RUN YOUTUBE_DL_SKIP_PYTHON_CHECK=1 pnpm install --frozen-lockfile --filter @play/api...

# runner-Stage: deps komplett übernehmen, Source-Code überlagern.
# COPY /app aus deps bringt alle node_modules-Symlinks mit. COPY . . overlay
# macht node_modules nicht kaputt (via .dockerignore ausgeschlossen).
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app ./
COPY . .

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["pnpm", "start"]
