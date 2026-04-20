// Redis Pub/Sub fan-out for theme updates. The admin editor's `theme.update`
// mutation writes to Postgres then `publish("theme:updated", …)`; the SSE
// endpoint at /api/theme/events subscribes and fans the event out to every
// connected browser tab (own + other tabs + other instances behind a load
// balancer later).
//
// We keep two Redis connections: one for PUBLISH (shared, reusable) and one
// dedicated SUBSCRIBE connection (ioredis requires subscribers to have no
// non-pub/sub commands in flight).

import Redis, { type RedisOptions } from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);

export const THEME_CHANNEL = "theme:updated";

const opts: RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
};

export const redisPub = new Redis(opts);

// Lazy-init the subscriber — only created when the first SSE client connects.
let redisSub: Redis | null = null;

type Listener = (payload: string) => void;
const listeners = new Set<Listener>();

function ensureSubscriber() {
  if (redisSub) return;
  redisSub = new Redis(opts);
  redisSub.subscribe(THEME_CHANNEL).catch((err) => {
    console.error("[theme-bus] subscribe failed:", err);
  });
  redisSub.on("message", (channel, message) => {
    if (channel !== THEME_CHANNEL) return;
    for (const l of listeners) {
      try {
        l(message);
      } catch (err) {
        console.error("[theme-bus] listener error:", err);
      }
    }
  });
}

export function subscribeThemeUpdates(listener: Listener): () => void {
  ensureSubscriber();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function publishThemeUpdate(
  payload: Record<string, unknown> = {},
): Promise<void> {
  const body = JSON.stringify({ ...payload, ts: Date.now() });
  await redisPub.publish(THEME_CHANNEL, body);
}
