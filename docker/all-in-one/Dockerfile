# ──────────────────────────────────────────────────────────────────────
#  ITSWEBER Play — All-in-One Container
#
#  Bündelt Postgres 16, Redis 7, MinIO, Nginx, Next.js Web, Fastify
#  API, BullMQ Worker, FFmpeg, yt-dlp und whisper.cpp unter s6-overlay.
#
#  - Single exposed Port: 3000 (Nginx als Reverse-Proxy vor Web/API/S3)
#  - Single Data-Volume: /data (postgres + redis + minio darunter)
#  - First-Run: legt Admin-User über INITIAL_ADMIN_EMAIL beim Register-
#    Flow an (siehe apps/api/src/auth.ts databaseHooks)
#  - NEXT_PUBLIC_* wird zur Build-Zeit auf relative URLs gesetzt
#    (/api, /s3) — Nginx multiplext same-origin gegen 4000 und 9000.
#
#  Build:
#    docker build -t itsweber-play:dev -f docker/all-in-one/Dockerfile .
#
#  Run:
#    docker run -d --name play -p 3000:3000 -v play-data:/data \
#      --env-file .env.all-in-one itsweber-play:dev
# ──────────────────────────────────────────────────────────────────────

ARG S6_OVERLAY_VERSION=3.2.0.2
ARG WHISPER_VERSION=1.7.6
ARG NODE_MAJOR=22

# ── whisper-cli build stage ──────────────────────────────────────────
FROM debian:bookworm-slim AS whisper-build
ARG WHISPER_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake curl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /whisper
RUN curl -fL "https://github.com/ggerganov/whisper.cpp/archive/refs/tags/v${WHISPER_VERSION}.tar.gz" \
      -o whisper.tar.gz \
    && tar -xzf whisper.tar.gz --strip-components=1 \
    && cmake -B build \
        -DWHISPER_BUILD_TESTS=OFF \
        -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --target whisper-cli -j"$(nproc)"

# ── Node build stage (Monorepo + Next.js standalone) ─────────────────
FROM node:22-slim AS node-build
RUN corepack enable
WORKDIR /app

# Manifeste + lock zuerst → Layer-Cache solange Deps stabil bleiben
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY apps/remotion/package.json apps/remotion/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
COPY packages/theme/package.json packages/theme/tokens.json packages/theme/
COPY packages/theme/scripts packages/theme/scripts

# Volle Install inkl. devDeps — API + Worker nutzen tsx zur Laufzeit.
# Remotion-Filter raus: der Render-Step gehört nicht ins Runtime-Image.
RUN YOUTUBE_DL_SKIP_PYTHON_CHECK=1 pnpm install --frozen-lockfile

# Source einspielen
COPY . .

# Build-Args sind absolute Dummy-URLs, damit BetterAuth beim Prerender
# nicht an einer relativen URL crasht. Zur Browser-Runtime verwenden
# apps/web/src/lib/{trpc,storage-urls,auth-client}.ts stattdessen
# `window.location.origin`, sodass das Bundle hinter beliebigem Host
# hinter dem All-in-One-Nginx läuft (same-origin via /api und /s3).
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:4000
ARG NEXT_PUBLIC_S3_PUBLIC_URL=http://127.0.0.1:9000
ARG NEXT_PUBLIC_SITE_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_S3_PUBLIC_URL=$NEXT_PUBLIC_S3_PUBLIC_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

# Prisma-Client mit Engine für Linux generieren. Der `postinstall`-Hook in
# packages/db läuft zwar bei `pnpm install`, aber wir wollen sicher sein, dass
# nach `COPY . .` (Schema-Stand des Repos) regeneriert wird — sonst trägt das
# Image einen veralteten Client mit falscher binaryTarget.
RUN pnpm --filter @play/db exec prisma generate --schema prisma/schema.prisma

RUN pnpm --filter @play/theme build
RUN pnpm --filter @play/web build

# ── Runtime (Debian bookworm + s6-overlay) ───────────────────────────
FROM debian:bookworm-slim AS runtime
ARG S6_OVERLAY_VERSION
ARG NODE_MAJOR

ENV DEBIAN_FRONTEND=noninteractive \
    S6_KEEP_ENV=1 \
    S6_BEHAVIOUR_IF_STAGE2_FAILS=2 \
    S6_VERBOSITY=1 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/lib/postgresql/16/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Systempakete: Postgres-16 aus PGDG, Node 22 aus NodeSource.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg xz-utils tini locales \
      nginx-light \
      redis-server \
      ffmpeg python3 libgomp1 \
      openssl \
      rsync \
    && install -d /etc/apt/keyrings \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor > /etc/apt/keyrings/pgdg.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor > /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends \
      postgresql-16 postgresql-client-16 \
      nodejs \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* \
    && corepack enable && corepack prepare pnpm@9.12.0 --activate

# MinIO + mc-Client (static binaries, kein apt-repo nötig)
RUN curl -fL https://dl.min.io/server/minio/release/linux-amd64/minio -o /usr/local/bin/minio \
    && chmod +x /usr/local/bin/minio \
    && curl -fL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc \
    && chmod +x /usr/local/bin/mc

# yt-dlp (self-updating static binary)
RUN curl -fL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# whisper-cli aus build-stage übernehmen
COPY --from=whisper-build /whisper/build/bin/whisper-cli /usr/local/bin/whisper-cli

# s6-overlay v3 (PID 1, Service-Supervision, Dependency-Graph)
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp/
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-x86_64.tar.xz /tmp/
RUN tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz \
    && tar -C / -Jxpf /tmp/s6-overlay-x86_64.tar.xz \
    && rm /tmp/s6-overlay-*.tar.xz

# s6-rc-Definitionen, Nginx-Config, Init-Scripts
COPY docker/all-in-one/rootfs/ /
RUN chmod +x /etc/s6-overlay/scripts/*.sh \
    && chmod +x /etc/s6-overlay/s6-rc.d/*/run 2>/dev/null || true \
    && chmod +x /etc/s6-overlay/s6-rc.d/*/up 2>/dev/null || true

# App-Dateien aus node-build übernehmen
WORKDIR /app
COPY --from=node-build /app ./

# Next.js standalone-Output erwartet static/ und public/ relativ zu sich
# selbst; der Monorepo-Build legt sie aber eine Ebene höher ab. Symlinks
# statt Kopien, damit Assets-Updates im Build-Cache wirksam bleiben.
RUN mkdir -p /app/apps/web/.next/standalone/apps/web/.next \
    && ln -sfn /app/apps/web/.next/static /app/apps/web/.next/standalone/apps/web/.next/static \
    && ln -sfn /app/apps/web/public /app/apps/web/.next/standalone/apps/web/public

# Binärpfade für Worker → überschreibt die @ffmpeg-installer-Defaults,
# die als Windows-Fallback in den Source-Files stehen.
ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe \
    YT_DLP_PATH=/usr/local/bin/yt-dlp \
    WHISPER_PATH=/usr/local/bin/whisper-cli

# Healthcheck gegen Nginx (antwortet /health mit 200 OK, siehe play.conf).
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
    CMD curl -fsS http://127.0.0.1:3000/health || exit 1

EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["/init"]
