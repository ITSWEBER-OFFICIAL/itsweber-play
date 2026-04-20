// First-Run-Setup-Wizard (Session M).
//
// Alle Routen sind publicProcedure — der Wizard läuft VOR dem ersten
// Admin-Login, eine Session existiert noch nicht. Schutz gegen Missbrauch
// nach Inbetriebnahme: jede Mutation prüft `requireSetupOpen()` und wirft
// FORBIDDEN, sobald `SiteSettings.setupCompleted` true ist.
//
// Backward-Compat-Bypass: wenn `INITIAL_ADMIN_EMAIL` gesetzt ist UND keine
// User existieren UND der Wizard noch nicht durchlief, gilt das Setup als
// "nicht erzwungen" — `status.required = false`. Die Middleware leitet dann
// nicht hart auf /setup um, der Wizard bleibt aber unter /setup erreichbar.
// So bricht das alte ENV-driven-Bootstrap-Verfahren nicht.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@play/db";
import { loadPreset, listPresets } from "@play/theme/presets";
import { router, publicProcedure } from "../init";
import { auth } from "../../auth";
import { invalidateTransport, testTransport } from "../../email/transport.js";
import { publishThemeUpdate } from "../../theme-bus";

const SINGLETON_ID = "singleton";

const RegistrationModeEnum = z.enum(["OPEN", "INVITE", "CLOSED"]);

const HANDLE_RE = /^[a-z0-9_-]{3,30}$/;

async function getInitialAdminEmail(): Promise<string | null> {
  const env = process.env.INITIAL_ADMIN_EMAIL?.trim();
  return env && env.length > 0 ? env : null;
}

async function loadStatus(prisma: PrismaClient) {
  const [settings, userCount] = await Promise.all([
    prisma.siteSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
      select: { setupCompleted: true, setupCompletedAt: true },
    }),
    prisma.user.count(),
  ]);
  const initialAdminEmail = await getInitialAdminEmail();
  const completed = settings.setupCompleted;
  // Required = der Wizard MUSS abgespielt werden (Middleware-Redirect).
  // Bypass: ENV-Bootstrap-Pfad gesetzt + DB unberührt → required=false,
  // damit alte Skripte/Dev-Compose-Setups weiterhin via /register durchkommen.
  const bypassWithEnv = Boolean(initialAdminEmail) && userCount === 0;
  const required = !completed && !bypassWithEnv;
  return {
    completed,
    required,
    bypassWithEnv,
    userCount,
    initialAdminEmail,
    completedAt: settings.setupCompletedAt?.toISOString() ?? null,
  };
}

async function requireSetupOpen(prisma: PrismaClient) {
  const row = await prisma.siteSettings.findUnique({
    where: { id: SINGLETON_ID },
    select: { setupCompleted: true },
  });
  if (row?.setupCompleted) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Setup wurde bereits abgeschlossen.",
    });
  }
}

export const setupRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    return loadStatus(ctx.prisma);
  }),

  // Theme-Preset-Liste, damit der Wizard ohne Admin-Session aussuchen kann.
  // Spiegelt theme.listPresets, das aber adminProcedure ist.
  listThemePresets: publicProcedure.query(async () => {
    return listPresets();
  }),

  // Live-SMTP-Test, OHNE die Werte zu persistieren — der Admin sieht das
  // Ergebnis vor dem finalen `complete`. Identisch zum Pfad in admin.smtp.
  testSmtp: publicProcedure
    .input(
      z.object({
        host: z.string().trim().min(1).max(255),
        port: z.number().int().min(1).max(65535),
        secure: z.boolean(),
        user: z.string().trim().max(255),
        password: z.string().max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireSetupOpen(ctx.prisma);
      return testTransport(input);
    }),

  // Atomarer Wizard-Abschluss. Ein Round-Trip — Schema-Felder, Theme-Preset,
  // SMTP-Settings UND der Admin-Account werden hier gemacht. Danach flippt
  // `setupCompleted` auf true; jeder weitere Aufruf der Mutation wirft
  // FORBIDDEN.
  complete: publicProcedure
    .input(
      z.object({
        site: z.object({
          siteName: z.string().trim().min(1).max(80),
          siteTagline: z.string().trim().max(200),
          contactEmail: z
            .union([z.string().email(), z.literal("")]),
          defaultLocale: z.enum(["de", "en"]),
          registrationMode: RegistrationModeEnum,
        }),
        admin: z.object({
          email: z.string().email(),
          handle: z.string().regex(HANDLE_RE),
          displayName: z.string().trim().min(1).max(80),
          password: z.string().min(10).max(255),
        }),
        themePresetId: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .nullable(),
        smtp: z
          .object({
            host: z.string().trim().min(1).max(255),
            port: z.number().int().min(1).max(65535),
            secure: z.boolean(),
            user: z.string().trim().max(255),
            password: z.string().max(255),
            fromName: z.string().trim().min(1).max(120),
            fromAddress: z.string().email(),
          })
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireSetupOpen(ctx.prisma);

      // Race-Schutz: zwei parallele Wizard-Tabs könnten gleichzeitig
      // submitten. Wir prüfen Konflikte (bereits vergebene E-Mail/Handle)
      // BEVOR wir Better-Auth aufrufen, sonst landet der erste durch und der
      // zweite kriegt einen 500 mitten in der Pipeline.
      const [emailExists, handleExists] = await Promise.all([
        ctx.prisma.user.findUnique({
          where: { email: input.admin.email },
          select: { id: true },
        }),
        ctx.prisma.user.findUnique({
          where: { handle: input.admin.handle },
          select: { id: true },
        }),
      ]);
      if (emailExists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Diese E-Mail-Adresse ist schon vergeben.",
        });
      }
      if (handleExists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Dieser Handle ist schon vergeben.",
        });
      }

      // Optional: Theme-Preset bereits am Anfang validieren — wenn die Datei
      // fehlt, frühzeitig 400 statt halb-konfiguriertes Setup.
      const preset = input.themePresetId
        ? await loadPreset(input.themePresetId).catch(() => null)
        : null;
      if (input.themePresetId && !preset) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Theme-Preset nicht gefunden: ${input.themePresetId}`,
        });
      }

      // 1) Admin-User via Better-Auth anlegen — geht durch denselben
      //    sign-up-Pfad wie /register, inkl. databaseHooks.user.create.after,
      //    der den Default-Channel anlegt. registrationMode wurde noch nicht
      //    geschrieben (passiert weiter unten), Default ist OPEN — kein
      //    Auto-403.
      const signUp = await auth.api
        .signUpEmail({
          body: {
            email: input.admin.email,
            password: input.admin.password,
            name: input.admin.displayName,
            handle: input.admin.handle,
          },
        })
        .catch((err: unknown) => {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              err instanceof Error
                ? `Admin-Account konnte nicht angelegt werden: ${err.message}`
                : "Admin-Account konnte nicht angelegt werden.",
          });
        });

      const userId = signUp?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Better-Auth lieferte keinen User zurück.",
        });
      }

      // 2) Rolle ADMIN sicherstellen. Better-Auth-Hook setzt das nur, wenn
      //    INITIAL_ADMIN_EMAIL match'd — der Wizard kennt diesen ENV nicht
      //    notwendigerweise, deswegen explizit hier.
      await ctx.prisma.user.update({
        where: { id: userId },
        data: { role: "ADMIN", emailVerified: true },
      });

      // 3) SiteSettings + Setup-Marker.
      await ctx.prisma.siteSettings.upsert({
        where: { id: SINGLETON_ID },
        create: {
          id: SINGLETON_ID,
          siteName: input.site.siteName,
          siteTagline: input.site.siteTagline,
          contactEmail: input.site.contactEmail,
          defaultLocale: input.site.defaultLocale,
          registrationMode: input.site.registrationMode,
          setupCompleted: true,
          setupCompletedAt: new Date(),
          setupCompletedBy: userId,
          updatedBy: userId,
        },
        update: {
          siteName: input.site.siteName,
          siteTagline: input.site.siteTagline,
          contactEmail: input.site.contactEmail,
          defaultLocale: input.site.defaultLocale,
          registrationMode: input.site.registrationMode,
          setupCompleted: true,
          setupCompletedAt: new Date(),
          setupCompletedBy: userId,
          updatedBy: userId,
        },
      });

      // 4) Theme-Preset anwenden, wenn gewählt. Spiegelt theme.applyPreset.
      if (preset && input.themePresetId) {
        await ctx.prisma.themeSettings.upsert({
          where: { id: SINGLETON_ID },
          create: {
            id: SINGLETON_ID,
            tokensOverride: preset.overrides ?? {},
            logoFilter: preset.logoFilter ?? null,
            activePreset: input.themePresetId,
            updatedBy: userId,
          },
          update: {
            tokensOverride: preset.overrides ?? {},
            logoFilter: preset.logoFilter ?? null,
            activePreset: input.themePresetId,
            updatedBy: userId,
          },
        });
        await ctx.prisma.themeAuditLog.create({
          data: {
            userId,
            action: "applyPreset",
            payload: { presetId: input.themePresetId, source: "setup-wizard" },
          },
        });
        await publishThemeUpdate({
          source: "preset",
          presetId: input.themePresetId,
        });
      }

      // 5) SMTP-Settings persistieren, wenn der Admin sie konfiguriert hat.
      if (input.smtp) {
        await ctx.prisma.smtpSettings.upsert({
          where: { id: SINGLETON_ID },
          create: {
            id: SINGLETON_ID,
            host: input.smtp.host,
            port: input.smtp.port,
            secure: input.smtp.secure,
            user: input.smtp.user,
            password: input.smtp.password,
            fromName: input.smtp.fromName,
            fromAddress: input.smtp.fromAddress,
            updatedBy: userId,
          },
          update: {
            host: input.smtp.host,
            port: input.smtp.port,
            secure: input.smtp.secure,
            user: input.smtp.user,
            password: input.smtp.password,
            fromName: input.smtp.fromName,
            fromAddress: input.smtp.fromAddress,
            updatedBy: userId,
          },
        });
        invalidateTransport();
      }

      return {
        ok: true as const,
        userId,
        adminEmail: input.admin.email,
      };
    }),
});
