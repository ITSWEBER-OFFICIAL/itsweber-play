# ──────────────────────────────────────────────────────────────────────
#  apps/worker — BullMQ + FFmpeg + yt-dlp + whisper.cpp
#  FFmpeg wird als OS-Paket installiert; @ffmpeg-installer bleibt als
#  Fallback für lokale Dev-Runs. In Prod gewinnt der Env-Override
#  FFMPEG_PATH=/usr/bin/ffmpeg.
# ──────────────────────────────────────────────────────────────────────

# ── whisper.cpp build stage ───────────────────────────────────────────
# Compiliert nur das whisper-cli-Binary; Builder-Layer kommt nicht in
# das finale Image. AUTO_CAPTIONS_ENABLED=1 aktiviert den Caption-Worker.
ARG WHISPER_VERSION=1.7.3
FROM debian:bookworm-slim AS whisper-build
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /whisper
RUN curl -fL "https://github.com/ggerganov/whisper.cpp/archive/refs/tags/v${WHISPER_VERSION}.tar.gz" \
      -o whisper.tar.gz && \
    tar -xzf whisper.tar.gz --strip-components=1 && \
    cmake -B build \
      -DWHISPER_BUILD_TESTS=OFF \
      -DWHISPER_BUILD_EXAMPLES=OFF \
      -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --target whisper-cli -j$(nproc) && \
    cp build/bin/whisper-cli /usr/local/bin/whisper-cli

# ── runtime base ──────────────────────────────────────────────────────
FROM node:22-slim AS base
RUN corepack enable && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      ca-certificates \
      curl \
      openssl \
      libgomp1 && \
    # yt-dlp als Static-Binary (yt-dlp selbst aktualisiert sich selbst,
    # wir pinnen hier nur den Start-Stand).
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

# Whisper-CLI-Binary aus Build-Stage übernehmen
COPY --from=whisper-build /usr/local/bin/whisper-cli /usr/local/bin/whisper-cli

# Whisper-Modell wird NICHT im Image gebaked (500 MB).
# Stattdessen: Volume /models mounten und Modell manuell herunterladen:
#   wget -P /models \
#     https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
# Dann in docker-compose.yml: volumes: [models:/models]
# + ENV AUTO_CAPTIONS_ENABLED=1 + WHISPER_MODEL=/models/ggml-small.bin

ENV WHISPER_PATH=/usr/local/bin/whisper-cli \
    WHISPER_MODEL=/models/ggml-small.bin

WORKDIR /app

# deps-Stage: nur Manifeste + lock → pnpm install in sauberem Layer
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
RUN pnpm install --frozen-lockfile --filter @play/worker...

# runner-Stage: deps komplett übernehmen, Source-Code überlagern.
FROM base AS runner
ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe \
    YT_DLP_PATH=/usr/local/bin/yt-dlp
COPY --from=deps /app ./
COPY . .

WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
