import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@play/api/auth";

// Better-Auth client appended Routen direkt an baseURL ohne automatischen
// basePath. Server-seitig liegen die Routen unter "/api/auth/*" (siehe
// apps/api/src/server.ts) — daher MUSS baseURL hier den vollen Mount-Pfad
// inkl. "/api/auth" enthalten. Sonst landet sign-up auf "/api/sign-up/email"
// und Fastify gibt 404.
const AUTH_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/auth`
    : `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000"}/api/auth`;

export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
