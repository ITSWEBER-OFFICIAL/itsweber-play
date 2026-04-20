# ──────────────────────────────────────────────────────────────────────
#  apps/web — Next.js 15 (App Router, RSC)
#  standalone-Output hält das Runtime-Image schlank (~200 MB statt ~800).
# ──────────────────────────────────────────────────────────────────────

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# deps-Stage: nur Manifeste + lock → pnpm install in sauberem Layer
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
COPY packages/theme/package.json packages/theme/tokens.json packages/theme/
COPY packages/theme/scripts packages/theme/scripts
RUN YOUTUBE_DL_SKIP_PYTHON_CHECK=1 pnpm install --frozen-lockfile --filter @play/web...

# builder-Stage: deps komplett übernehmen, Source-Code überlagern, bauen.
# COPY /app aus deps bringt alle node_modules-Symlinks mit. Danach überschreibt
# COPY . . nur die Dateien aus dem Build-Kontext (node_modules sind via
# .dockerignore ausgeschlossen → bleiben intakt).
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* müssen zur Build-Zeit bekannt sein (werden in JS-Bundle eingebettet).
# Übergabe via docker compose build.args → docker-compose.yml.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_S3_PUBLIC_URL=http://localhost:9000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_S3_PUBLIC_URL=$NEXT_PUBLIC_S3_PUBLIC_URL
COPY --from=deps /app ./
COPY . .
# Generiert packages/theme/dist/primitives.css (postinstall-Script)
RUN pnpm --filter @play/theme build
RUN pnpm --filter @play/web build

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Next.js standalone liefert alle benötigten Runtime-Files hier ab.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
