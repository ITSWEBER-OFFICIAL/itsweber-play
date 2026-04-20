import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import IORedis from "ioredis";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { ensureBuckets } from "@play/storage";
import { auth } from "./auth";
import { appRouter } from "./trpc/routers/index";
import { createContext } from "./trpc/context";
import { uploadHandler } from "./upload";
import { logoUploadHandler } from "./logo-upload";
import { setupLogoUploadHandler } from "./setup-logo-upload";
import {
  channelAvatarUploadHandler,
  channelBannerUploadHandler,
} from "./channel-assets-upload";
import {
  videoThumbnailUploadHandler,
  videoCaptionUploadHandler,
} from "./video-assets-upload";
import { subscribeThemeUpdates } from "./theme-bus";

const PORT = Number(process.env.API_PORT ?? 4000);
const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:3000";
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 120);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  },
  // Hinter NPM: trustProxy lässt Fastify X-Forwarded-For auswerten, sodass
  // Rate-Limit + Logs die echte Client-IP sehen statt der NPM-Container-IP.
  trustProxy: true,
});

// Standardisierte HTTP-Error-Helper (app.httpErrors.badRequest(...) etc.).
await app.register(sensible);

// Restrictive Default-CSP mit expliziter MinIO-Allow-List für Thumbnails + HLS.
// Die Browser-Frontends laden Assets direkt aus NEXT_PUBLIC_S3_PUBLIC_URL, deshalb
// nehmen wir den Origin aus Env auf (https://minio.play.itsweber.net o.ä.).
const s3Origin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? process.env.S3_PUBLIC_URL ?? "http://localhost:9000").origin;
  } catch {
    return "http://localhost:9000";
  }
})();

await app.register(helmet, {
  // CSP bewusst moderat: wir liefern nur JSON/SSE, kein HTML an Browser mit
  // inline-Scripts. Next-Frontend rendert HTML — dessen CSP liegt in apps/web.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", s3Origin],
      mediaSrc: ["'self'", s3Origin],
      connectSrc: ["'self'", s3Origin, PUBLIC_URL],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  // HSTS wird bereits von NPM gesetzt — hier no-op, damit keine doppelten Header entstehen.
  hsts: false,
  // crossOriginResourcePolicy bremst Thumbnail-Fetches aus dem Web-Container aus.
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

await app.register(cors, {
  origin: PUBLIC_URL,
  credentials: true,
});

// Redis-backed Rate-Limiter (persistiert Zähler über API-Restart hinweg und
// verteilt sie, falls wir mal horizontal skalieren). Enforcement nur auf
// sensiblen Routen via { config: { rateLimit: { max, timeWindow } } } am Route-
// Level — Global-Default ist großzügig.
const rateLimitRedis = new IORedis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  // rate-limit-Plugin erwartet Connect-Retry, nicht block-on-maxRetries.
  enableReadyCheck: false,
  maxRetriesPerRequest: 1,
});

await app.register(rateLimit, {
  global: false, // opt-in pro Route via config.rateLimit — /health + SSE sollen nie limitiert werden.
  redis: rateLimitRedis,
  max: RATE_LIMIT_MAX,
  timeWindow: RATE_LIMIT_WINDOW_MS,
  nameSpace: "play-rl:",
  keyGenerator: (req) => req.ip,
});

// Video-Upload: Body bleibt unparsed — `request.raw` wird direkt in MinIO
// gestreamt. Ohne diesen Parser würde Fastify mit „Unsupported Media Type"
// 415-en, bevor unser Handler überhaupt dran ist.
app.addContentTypeParser(/^video\//, (_req, _payload, done) => {
  done(null, null);
});

// Gleiche Logik für Logo-Uploads (image/*).
app.addContentTypeParser(/^image\//, (_req, _payload, done) => {
  done(null, null);
});

// Captions: VTT ist `text/vtt`, SRT kommt oft als `application/x-subrip` oder
// `text/plain`. Wir lesen das Body-Stream im Handler, deshalb hier nur
// unparsed durchreichen.
app.addContentTypeParser("text/vtt", (_req, _payload, done) => {
  done(null, null);
});
app.addContentTypeParser("application/x-subrip", (_req, _payload, done) => {
  done(null, null);
});

// MinIO-Buckets beim Boot anlegen (idempotent).
await ensureBuckets();

// Upload: raw binary → MinIO raw bucket → Video-Row + transcode-job.
// 10 Uploads/Minute pro IP ist bewusst großzügig — legitime Creator sind drunter,
// automatisierte Spam-Uploader laufen rein.
app.route({
  method: "POST",
  url: "/api/upload",
  config: { rateLimit: { max: 10, timeWindow: 60_000 } },
  handler: uploadHandler,
});

// Admin logo upload: raw image → MinIO play-assets → ThemeSettings.logoAssetKey.
app.route({
  method: "POST",
  url: "/api/admin/theme/logo",
  handler: logoUploadHandler,
});

// First-Run-Setup-Wizard logo upload (Session M). Nicht admin-gated, dafür
// nur erreichbar solange `SiteSettings.setupCompleted = false` — Handler
// erzwingt das selbst. Tight rate-limit: 6 Versuche/Minute pro IP, mehr
// braucht keine Wizard-UI.
app.route({
  method: "POST",
  url: "/api/setup/logo",
  config: { rateLimit: { max: 6, timeWindow: 60_000 } },
  handler: setupLogoUploadHandler,
});

// Channel branding: Avatar + Banner. Owner-only.
app.route({
  method: "POST",
  url: "/api/studio/avatar",
  handler: channelAvatarUploadHandler,
});
app.route({
  method: "POST",
  url: "/api/studio/banner",
  handler: channelBannerUploadHandler,
});

// Video-spezifische Assets: Custom-Thumbnail + Caption-Tracks.
app.route({
  method: "POST",
  url: "/api/studio/video/:id/thumbnail",
  handler: videoThumbnailUploadHandler,
});
app.route({
  method: "POST",
  url: "/api/studio/video/:id/caption",
  handler: videoCaptionUploadHandler,
});

// ─── Better Auth proxy ────────────────────────────────────────────────────
// Better Auth liefert einen framework-agnostischen WHATWG-Handler. Fastify hat
// den Body bereits geparsed — wir re-serialisieren JSON für den Adapter. Für
// GET/HEAD-Requests wird kein Body durchgereicht.
async function betterAuthHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const host = request.headers.host ?? `localhost:${PORT}`;
  const url = new URL(request.url, `http://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (value !== undefined) {
      headers.append(key, String(value));
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body =
      typeof request.body === "string" || request.body == null
        ? (request.body as string | null | undefined)
        : JSON.stringify(request.body);
  }

  const response = await auth.handler(new Request(url.toString(), init));

  reply.status(response.status);
  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });
  const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;
  reply.send(body);
}

app.route({
  method: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  url: "/api/auth/*",
  // Tight: 20 Requests/Minute — Brute-Force-Schutz auf Login/Register/Reset.
  // Legitime UI-Flows liegen deutlich darunter (Login = 1-2 Requests pro Versuch).
  config: {
    rateLimit: {
      max: 20,
      timeWindow: 60_000,
    },
  },
  handler: betterAuthHandler,
});

// ─── tRPC ────────────────────────────────────────────────────────────────
// Mount unter /api/trpc — alle Public-Routen liegen unter /api/* (Auth,
// Upload, Studio, tRPC). Browser-Calls gehen einheitlich gegen `${origin}/api/...`,
// Nginx routet das ohne Strip an Fastify weiter.
await app.register(fastifyTRPCPlugin, {
  prefix: "/api/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
  },
});

// Fastify-nativer Health-Check (unterhalb von tRPC, damit Ping keinen DB-
// oder Auth-Round-Trip braucht — für Docker/NPM-Healthchecks).
app.get("/health", async () => ({ ok: true, ts: Date.now() }));

// ─── Web-Vitals Sink ──────────────────────────────────────────────────────
// Leichtgewichtiger Analytics-Endpoint. Body wird via Pino geloggt (keine
// DB-Row pro Pageview). Admins können per Loki/Promtail aggregieren.
app.post("/api/analytics/web-vitals", async (request, reply) => {
  try {
    const b = request.body as Record<string, unknown> | null;
    if (b && typeof b === "object") {
      app.log.info({ webVital: b }, "web-vital");
    }
  } catch {
    // swallow
  }
  reply.code(204).send();
});

// ─── Theme live-update (Server-Sent Events) ──────────────────────────────
// Open-ended stream that every browser tab subscribes to once. Emits on every
// theme.{update,applyPreset,setCustomCss,rollback,import}. Payloads are small
// JSON hints; the actual new theme state is re-fetched via `theme.get` after
// the tab receives the ping — this keeps the bus memory bounded and lets
// React Query dedupe concurrent fetches from sibling components.
app.get("/api/theme/events", async (request, reply) => {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // CORS is handled by @fastify/cors above, but the EventSource spec needs
    // the credentialed-origin header explicitly present.
    "Access-Control-Allow-Origin": PUBLIC_URL,
    "Access-Control-Allow-Credentials": "true",
    "X-Accel-Buffering": "no",
  });

  reply.raw.write(`event: hello\ndata: ${Date.now()}\n\n`);

  // Heartbeat keeps proxies (NPM) from closing the idle connection.
  const heartbeat = setInterval(() => {
    reply.raw.write(`:hb ${Date.now()}\n\n`);
  }, 25_000);

  const unsubscribe = subscribeThemeUpdates((payload) => {
    reply.raw.write(`event: theme:updated\ndata: ${payload}\n\n`);
  });

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
    reply.raw.end();
  };
  request.raw.on("close", cleanup);
  request.raw.on("error", cleanup);
});

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`API listening on :${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
