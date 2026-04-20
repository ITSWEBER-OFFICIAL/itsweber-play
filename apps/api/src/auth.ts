import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@play/db";
import { sendMail } from "./email/send.js";

// Env-Inputs werden am Bootstrap gecheckt — hier kein Fallback auf Dummy,
// sonst produziert Dev einen „läuft, aber Cookies sind kaputt"-Pfad.
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  throw new Error("AUTH_SECRET fehlt — in .env setzen (64-char hex).");
}

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:3000";
const INITIAL_ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: AUTH_SECRET,
  baseURL: API_URL,

  // apps/web läuft auf einem anderen Origin als die API — ohne diese Liste
  // lehnt Better-Auth Cross-Origin-Sign-In-Requests mit 403 ab.
  trustedOrigins: [PUBLIC_URL],

  emailAndPassword: {
    enabled: true,
    // v0.3: kein Zwang zur E-Mail-Verifikation — der Invite-Mode kommt noch.
    // Verify-Link geht aber bereits raus (siehe emailVerification unten).
    requireEmailVerification: false,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      const typed = user as { email: string; name?: string | null };
      // Better-Auth baut standardmäßig auf die baseURL der API. Wir leiten
      // stattdessen auf /auth/reset-password im Frontend, damit der User
      // sein neues Passwort dort eingibt.
      const token = new URL(url).searchParams.get("token") ?? "";
      const frontendUrl = `${PUBLIC_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
      await sendMail({
        to: typed.email,
        template: "password-reset",
        vars: {
          displayName: typed.name ?? typed.email.split("@")[0] ?? "dort",
          resetUrl: frontendUrl,
        },
      });
    },
  },

  emailVerification: {
    // Nicht zwingend (requireEmailVerification bleibt false) — aber der Link
    // geht trotzdem raus, sodass User sich freiwillig verifizieren können.
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const typed = user as { email: string; name?: string | null };
      const token = new URL(url).searchParams.get("token") ?? "";
      const frontendUrl = `${PUBLIC_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
      await sendMail({
        to: typed.email,
        template: "email-verify",
        vars: {
          displayName: typed.name ?? typed.email.split("@")[0] ?? "dort",
          verifyUrl: frontendUrl,
        },
      });
    },
  },

  // Feldmapping: unsere Prisma-Spalten heißen displayName/avatarUrl,
  // Better Auth adressiert sie intern als name/image.
  user: {
    fields: {
      name: "displayName",
      image: "avatarUrl",
    },
    additionalFields: {
      handle: { type: "string", required: true },
      role: { type: "string", defaultValue: "CREATOR" },
      banned: { type: "boolean", defaultValue: false },
    },
  },

  advanced: {
    cookiePrefix: "play",
  },

  // Post-Registration-Hook:
  //  0) RegistrationMode prüfen (CLOSED/INVITE blockieren neue Sign-ups)
  //  1) wenn die erste registrierte E-Mail == INITIAL_ADMIN_EMAIL → role=ADMIN
  //  2) jedem User wird ein Default-Channel (slug = handle) angelegt
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const typed = user as unknown as { email: string };
          // Bootstrapping: Initial-Admin darf sich immer registrieren,
          // unabhängig vom Mode — sonst locked man sich versehentlich aus.
          if (
            INITIAL_ADMIN_EMAIL &&
            typed.email === INITIAL_ADMIN_EMAIL
          ) {
            return;
          }
          const settings = await prisma.siteSettings
            .findUnique({
              where: { id: "singleton" },
              select: { registrationMode: true },
            })
            .catch(() => null);
          const mode = settings?.registrationMode ?? "OPEN";
          if (mode === "CLOSED") {
            throw new APIError("FORBIDDEN", {
              message: "Registrierung ist aktuell deaktiviert.",
              code: "REGISTRATION_CLOSED",
            });
          }
          if (mode === "INVITE") {
            // v0.3 bringt echte Invite-Tokens. Bis dahin: harte 403 mit Hint,
            // damit der Admin diese Lücke bewusst macht.
            throw new APIError("FORBIDDEN", {
              message: "Registrierung nur mit Invite.",
              code: "INVITE_REQUIRED",
            });
          }
        },
        after: async (user) => {
          const typed = user as unknown as {
            id: string;
            email: string;
            name?: string | null;
            handle?: string;
          };

          if (INITIAL_ADMIN_EMAIL && typed.email === INITIAL_ADMIN_EMAIL) {
            await prisma.user.update({
              where: { id: typed.id },
              data: { role: "ADMIN" },
            });
          }

          if (typed.handle) {
            await prisma.channel.create({
              data: {
                ownerId: typed.id,
                slug: typed.handle,
                displayName: typed.name ?? typed.handle,
              },
            });
          }

          // Fire-and-forget Welcome-Mail — Fehler darf Registrierung nicht
          // blocken, SMTP kann in frischem Setup noch nicht konfiguriert sein.
          if (typed.handle) {
            void sendMail({
              to: typed.email,
              template: "welcome",
              vars: {
                displayName: typed.name ?? typed.handle,
                handle: typed.handle,
              },
            }).catch((err) => {
              console.warn("[auth] Welcome-Mail fehlgeschlagen:", err);
            });
          }
        },
      },
    },
  },
});

export type Auth = typeof auth;
