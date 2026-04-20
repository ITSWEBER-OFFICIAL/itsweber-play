import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@play/api/trpc";

// Typisierter tRPC-Client-Hook-Tree. `AppRouter` kommt type-only rüber —
// der Next-Bundler schnürt keinen Server-Code mit ein.
export const trpc = createTRPCReact<AppRouter>();

// API_URL ist die nackte Origin-/Host-URL OHNE /api-Suffix. Alle Caller
// hängen den vollen Pfad inkl. /api/... selbst an (`${API_URL}/api/trpc/...`,
// `${API_URL}/api/upload`). Damit ist Browser- und SSR-Pfad symmetrisch:
//   Browser → `${origin}/api/...` (Nginx routet an Backend ohne Strip)
//   SSR     → `${env}/api/...`    (direkt gegen Backend, das /api/* mountet)
export const API_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000");
