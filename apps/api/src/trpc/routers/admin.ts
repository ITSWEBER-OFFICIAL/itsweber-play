import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { execFile } from "child_process";
import { ROLES, VISIBILITIES, type Visibility } from "@play/shared";
import { router, adminProcedure } from "../init";
import { invalidateTransport, testTransport } from "../../email/transport.js";
import { sendMail } from "../../email/send.js";
import { TEMPLATE_META, getDefaultTemplate } from "../../email/template-defaults.js";
import type { TemplateName } from "../../email/templates.js";

// Cached at module level — spawning ffmpeg/yt-dlp on every request is wasteful.
let cachedFfmpegVersion: string | null = null;
let cachedYtdlpVersion: string | null = null;

function probe(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      resolve(stdout.split("\n")[0]?.trim() ?? null);
    });
  });
}

async function getFfmpegVersion(): Promise<string | null> {
  if (cachedFfmpegVersion !== undefined && cachedFfmpegVersion !== null) return cachedFfmpegVersion;
  const path = (process.env.FFMPEG_PATH ?? "").trim() || "ffmpeg";
  const result = await probe(path, ["-version"]);
  cachedFfmpegVersion = result ? result.replace("ffmpeg version ", "") : null;
  return cachedFfmpegVersion;
}

async function getYtdlpVersion(): Promise<string | null> {
  if (cachedYtdlpVersion !== undefined && cachedYtdlpVersion !== null) return cachedYtdlpVersion;
  const path = (process.env.YTDLP_PATH ?? "").trim() || "yt-dlp";
  const result = await probe(path, ["--version"]);
  cachedYtdlpVersion = result ?? null;
  return cachedYtdlpVersion;
}

export const adminRouter = router({
  // ─── Dashboard ──────────────────────────────────────────────────────
  // High-level counters for the Admin overview page. All queries run in
  // parallel; numbers are "right now" (no 24 h window yet — comes with
  // tracking in Session 7).
  dashboard: adminProcedure.query(async ({ ctx }) => {
    const [
      userTotal,
      userNew7d,
      userBanned,
      videoTotal,
      videoLive,
      videoProcessing,
      videoFailed,
      videoPublic,
      channelTotal,
      auditToday,
      viewsSum,
    ] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      ctx.prisma.user.count({ where: { banned: true } }),
      ctx.prisma.video.count(),
      ctx.prisma.video.count({ where: { status: "LIVE" } }),
      ctx.prisma.video.count({ where: { status: "PROCESSING" } }),
      ctx.prisma.video.count({ where: { status: "FAILED" } }),
      ctx.prisma.video.count({
        where: { visibility: "PUBLIC", status: "LIVE" },
      }),
      ctx.prisma.channel.count(),
      ctx.prisma.themeAuditLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      ctx.prisma.video.aggregate({ _sum: { viewCount: true } }),
    ]);

    return {
      users: { total: userTotal, new7d: userNew7d, banned: userBanned },
      videos: {
        total: videoTotal,
        live: videoLive,
        processing: videoProcessing,
        failed: videoFailed,
        publicLive: videoPublic,
      },
      channels: { total: channelTotal },
      views: { total: viewsSum._sum.viewCount ?? 0 },
      theme: { auditToday },
    };
  }),

  // ─── Global video management ────────────────────────────────────────
  videos: router({
    list: adminProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(200).default(100),
            status: z
              .enum(["ALL", "LIVE", "PROCESSING", "PENDING", "FAILED"])
              .default("ALL"),
            format: z.enum(["ALL", "LONG", "SHORT"]).default("ALL"),
            search: z.string().trim().optional(),
          })
          .optional(),
      )
      .query(({ ctx, input }) => {
        const where: Record<string, unknown> = {};
        if (input?.status && input.status !== "ALL") {
          where.status = input.status;
        }
        if (input?.format && input.format !== "ALL") {
          where.format = input.format;
        }
        if (input?.search) {
          where.OR = [
            { title: { contains: input.search, mode: "insensitive" } },
            { description: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
          ];
        }
        return ctx.prisma.video.findMany({
          where: where as never,
          orderBy: { createdAt: "desc" },
          take: input?.limit ?? 100,
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            visibility: true,
            viewCount: true,
            durationSec: true,
            thumbnailKey: true,
            createdAt: true,
            publishedAt: true,
            format: true,
            owner: { select: { handle: true, displayName: true } },
            channel: { select: { slug: true, displayName: true } },
          },
        });
      }),

    setVisibility: adminProcedure
      .input(
        z.object({
          id: z.string().min(1),
          visibility: z.enum(VISIBILITIES),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.prisma.video.update({
          where: { id: input.id },
          data: { visibility: input.visibility as Visibility },
          select: { id: true, visibility: true },
        }),
      ),

    delete: adminProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await ctx.prisma.video.delete({ where: { id: input.id } });
        return { ok: true as const };
      }),
  }),

  // ─── System panel ───────────────────────────────────────────────────
  system: router({
    health: adminProcedure.query(async ({ ctx }) => {
      // Lightweight checks — no actual Redis ping yet (BullMQ queue-depth
      // counts come once we expose them from @play/worker). Keep the
      // shape stable so the UI can render even when counters are zero.
      const [dbOk, migrations, videoStats, ffmpegVersion, ytdlpVersion] = await Promise.all([
        ctx.prisma.$queryRawUnsafe("SELECT 1 as ok").then(
          () => true,
          () => false,
        ),
        ctx.prisma
          .$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"`,
          )
          .then((rows) => Number(rows[0]?.count ?? 0))
          .catch(() => -1),
        ctx.prisma.video.groupBy({
          by: ["status"],
          _count: { status: true },
        }),
        getFfmpegVersion(),
        getYtdlpVersion(),
      ]);

      const queue = {
        pending: 0,
        processing: 0,
        failed: 0,
      };
      for (const row of videoStats) {
        if (row.status === "PENDING") queue.pending = row._count.status;
        if (row.status === "PROCESSING") queue.processing = row._count.status;
        if (row.status === "FAILED") queue.failed = row._count.status;
      }

      const maxUploadMB = process.env.MAX_UPLOAD_SIZE
        ? Math.round(Number(process.env.MAX_UPLOAD_SIZE) / 1024 / 1024)
        : 8192;

      return {
        database: { ok: dbOk, migrations },
        queue,
        env: {
          nodeEnv: process.env.NODE_ENV ?? "development",
          publicUrl: process.env.PUBLIC_URL ?? null,
          apiUrl: process.env.API_URL ?? null,
          s3Endpoint: process.env.S3_ENDPOINT ?? null,
          s3PublicUrl: process.env.S3_PUBLIC_URL ?? null,
          redisHost: process.env.REDIS_HOST ?? null,
          ffmpegPath: process.env.FFMPEG_PATH ?? null,
          ffmpegVersion,
          ytdlpVersion,
          maxUploadMB,
        },
      };
    }),
  }),

  // ─── User management (existing, unchanged) ──────────────────────────
  users: router({
    list: adminProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(200).default(100),
            search: z.string().trim().optional(),
          })
          .optional(),
      )
      .query(({ ctx, input }) => {
        const search = input?.search;
        return ctx.prisma.user.findMany({
          where: search
            ? {
                OR: [
                  { email: { contains: search, mode: "insensitive" } },
                  { handle: { contains: search, mode: "insensitive" } },
                  { displayName: { contains: search, mode: "insensitive" } },
                ],
              }
            : undefined,
          orderBy: { createdAt: "desc" },
          take: input?.limit ?? 100,
          select: {
            id: true,
            email: true,
            handle: true,
            displayName: true,
            role: true,
            banned: true,
            createdAt: true,
            _count: { select: { videos: true, channels: true } },
          },
        });
      }),

    setRole: adminProcedure
      .input(
        z.object({
          userId: z.string().min(1),
          role: z.enum(ROLES),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // Safety-net: Admin kann sich nicht selbst degradieren, sonst lockout.
        if (
          ctx.session.user.id === input.userId &&
          input.role !== "ADMIN"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Kannst dich nicht selbst degradieren — degradier dich erst mit einem zweiten Admin.",
          });
        }
        return ctx.prisma.user.update({
          where: { id: input.userId },
          data: { role: input.role },
          select: { id: true, role: true },
        });
      }),

    setBan: adminProcedure
      .input(
        z.object({
          userId: z.string().min(1),
          banned: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.session.user.id === input.userId && input.banned) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Kannst dich nicht selbst sperren.",
          });
        }
        const updated = await ctx.prisma.user.update({
          where: { id: input.userId },
          data: { banned: input.banned },
          select: { id: true, banned: true },
        });
        if (input.banned) {
          await ctx.prisma.session.deleteMany({ where: { userId: input.userId } });
        }
        return updated;
      }),

    update: adminProcedure
      .input(
        z.object({
          userId: z.string().min(1),
          displayName: z.string().trim().min(1).max(64).optional(),
          handle: z.string().trim().min(2).max(32).regex(/^[a-z0-9_-]+$/, "Nur Kleinbuchstaben, Ziffern, - und _").optional(),
          email: z.string().email().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { userId, ...data } = input;
        if (Object.keys(data).length === 0) return { id: userId };
        // Handle-Uniqueness prüfen
        if (data.handle) {
          const existing = await ctx.prisma.user.findFirst({
            where: { handle: data.handle, NOT: { id: userId } },
            select: { id: true },
          });
          if (existing) throw new TRPCError({ code: "CONFLICT", message: "Handle bereits vergeben." });
        }
        // Email-Uniqueness prüfen
        if (data.email) {
          const existing = await ctx.prisma.user.findFirst({
            where: { email: data.email, NOT: { id: userId } },
            select: { id: true },
          });
          if (existing) throw new TRPCError({ code: "CONFLICT", message: "E-Mail bereits vergeben." });
        }
        return ctx.prisma.user.update({
          where: { id: userId },
          data,
          select: { id: true, displayName: true, handle: true, email: true },
        });
      }),

    delete: adminProcedure
      .input(z.object({ userId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.session.user.id === input.userId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Kannst deinen eigenen Account nicht löschen." });
        }
        // Sessions + Videos (cascade über Prisma-Schema) mitlöschen
        await ctx.prisma.session.deleteMany({ where: { userId: input.userId } });
        await ctx.prisma.user.delete({ where: { id: input.userId } });
        return { ok: true };
      }),

    sendPasswordReset: adminProcedure
      .input(z.object({ userId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const user = await ctx.prisma.user.findUnique({
          where: { id: input.userId },
          select: { email: true, displayName: true },
        });
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User nicht gefunden." });
        // Better-Auth Token generieren via interner API
        const siteUrl = process.env.PUBLIC_URL ?? "http://localhost:3000";
        const apiBase = `http://127.0.0.1:${process.env.PORT ?? 4000}`;
        const res = await fetch(`${apiBase}/api/auth/request-password-reset`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: user.email, redirectTo: `${siteUrl}/auth/reset-password` }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Better-Auth Fehler: ${text}` });
        }
        return { ok: true, email: user.email };
      }),
  }),

  // ─── SMTP / E-Mail-Einstellungen ─────────────────────────────────────
  // Singleton-Row wie SiteSettings/ThemeSettings. `update` invalidiert den
  // Lazy-Transporter-Cache. `testConnection` + `sendTestMail` schreiben
  // Zeitstempel + Resultat, damit das Admin-UI den letzten Lauf anzeigt.
  smtp: router({
    get: adminProcedure.query(async ({ ctx }) => {
      const row = await ctx.prisma.smtpSettings.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton" },
      });
      // Password nie an Client schicken — UI zeigt nur „gesetzt/leer".
      return {
        host: row.host,
        port: row.port,
        secure: row.secure,
        user: row.user,
        // Leeres String-Pattern für „Feld leer im Form" — Front-End-UX.
        passwordSet: row.password.length > 0,
        fromName: row.fromName,
        fromAddress: row.fromAddress,
        lastTestAt: row.lastTestAt,
        lastTestResult: row.lastTestResult,
        updatedAt: row.updatedAt,
      };
    }),

    update: adminProcedure
      .input(
        z.object({
          host: z.string().trim().max(255).optional(),
          port: z.number().int().min(1).max(65535).optional(),
          secure: z.boolean().optional(),
          user: z.string().trim().max(255).optional(),
          // Leere String = "nicht ändern"; expliziter Null-Reset über
          // `clearPassword` unten.
          password: z.string().max(255).optional(),
          clearPassword: z.boolean().optional(),
          fromName: z.string().trim().max(120).optional(),
          fromAddress: z
            .union([z.string().email(), z.literal("")])
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = (ctx.session.user as { id: string }).id;
        const data: Record<string, unknown> = { updatedBy: userId };
        for (const [k, v] of Object.entries(input)) {
          if (k === "password" || k === "clearPassword") continue;
          if (v !== undefined) data[k] = v;
        }
        if (input.clearPassword) data.password = "";
        else if (input.password && input.password.length > 0) data.password = input.password;

        await ctx.prisma.smtpSettings.upsert({
          where: { id: "singleton" },
          update: data as never,
          create: { id: "singleton", ...data } as never,
        });
        invalidateTransport();
        return { ok: true as const };
      }),

    testConnection: adminProcedure.mutation(async ({ ctx }) => {
      const row = await ctx.prisma.smtpSettings.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton" },
      });
      if (!row.host) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "SMTP-Host nicht konfiguriert.",
        });
      }
      const result = await testTransport({
        host: row.host,
        port: row.port,
        secure: row.secure,
        user: row.user,
        password: row.password,
      });
      const lastTestResult = result.ok ? "ok" : `error: ${result.error}`;
      await ctx.prisma.smtpSettings.update({
        where: { id: "singleton" },
        data: { lastTestAt: new Date(), lastTestResult },
      });
      return result;
    }),

    sendTestMail: adminProcedure
      .input(
        z.object({
          to: z.string().email(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const sessionUser = ctx.session.user as {
          email?: string | null;
          name?: string | null;
          id?: string;
        };
        // Test-Mail nutzt das Welcome-Template — realistischer Render-Check,
        // kein separates Test-Template nötig.
        const result = await sendMail({
          to: input.to,
          template: "welcome",
          vars: {
            displayName: sessionUser.name ?? "Admin",
            handle: "admin",
          },
        });
        const lastTestResult = result.ok
          ? "ok (Test-Mail gesendet)"
          : `error: ${result.reason}`;
        await ctx.prisma.smtpSettings.update({
          where: { id: "singleton" },
          data: { lastTestAt: new Date(), lastTestResult },
        }).catch(() => null);
        if (!result.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.reason,
          });
        }
        return { ok: true as const, messageId: result.messageId };
      }),
  }),

  // ─── E-Mail-Template-Editor ──────────────────────────────────────────
  emailTemplates: router({
    list: adminProcedure.query(async ({ ctx }) => {
      // Alle 6 Templates als Rows zurückgeben — ggf. mit Default-Inhalten per upsert anlegen.
      const ids = TEMPLATE_META.map((m) => m.id);
      // Fehlende Rows anlegen
      for (const id of ids) {
        const defaults = getDefaultTemplate(id as TemplateName);
        await ctx.prisma.emailTemplate.upsert({
          where: { id },
          update: {},
          create: { id, subject: defaults.subject, htmlBody: defaults.htmlBody, textBody: defaults.textBody },
        });
      }
      const rows = await ctx.prisma.emailTemplate.findMany({
        where: { id: { in: ids } },
        select: { id: true, subject: true, updatedAt: true },
        orderBy: { id: "asc" },
      });
      return rows.map((row) => ({
        ...row,
        meta: TEMPLATE_META.find((m) => m.id === row.id)!,
      }));
    }),

    get: adminProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const meta = TEMPLATE_META.find((m) => m.id === input.id);
        if (!meta) throw new TRPCError({ code: "NOT_FOUND", message: "Template nicht gefunden." });
        const defaults = getDefaultTemplate(input.id as TemplateName);
        const row = await ctx.prisma.emailTemplate.upsert({
          where: { id: input.id },
          update: {},
          create: { id: input.id, subject: defaults.subject, htmlBody: defaults.htmlBody, textBody: defaults.textBody },
          select: { id: true, subject: true, htmlBody: true, textBody: true, updatedAt: true, updatedBy: true },
        });
        return { ...row, meta, defaults };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.string().min(1),
        subject: z.string().trim().min(1).max(200),
        htmlBody: z.string().min(1),
        textBody: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!TEMPLATE_META.find((m) => m.id === input.id)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template nicht gefunden." });
        }
        return ctx.prisma.emailTemplate.upsert({
          where: { id: input.id },
          update: { subject: input.subject, htmlBody: input.htmlBody, textBody: input.textBody, updatedBy: ctx.session.user.id },
          create: { id: input.id, subject: input.subject, htmlBody: input.htmlBody, textBody: input.textBody, updatedBy: ctx.session.user.id },
          select: { id: true, subject: true, updatedAt: true },
        });
      }),

    reset: adminProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!TEMPLATE_META.find((m) => m.id === input.id)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template nicht gefunden." });
        }
        const defaults = getDefaultTemplate(input.id as TemplateName);
        return ctx.prisma.emailTemplate.update({
          where: { id: input.id },
          data: { subject: defaults.subject, htmlBody: defaults.htmlBody, textBody: defaults.textBody, updatedBy: ctx.session.user.id },
          select: { id: true, subject: true, updatedAt: true },
        });
      }),

    sendPreview: adminProcedure
      .input(z.object({ id: z.string().min(1), to: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        const meta = TEMPLATE_META.find((m) => m.id === input.id);
        if (!meta) throw new TRPCError({ code: "NOT_FOUND", message: "Template nicht gefunden." });
        // Beispiel-Variablen aus der Meta-Definition
        const exampleVars = Object.fromEntries(meta.vars.map((v) => [v.name, v.example]));
        // sendMail liest aus DB + interpoliert
        const result = await sendMail({
          to: input.to,
          template: input.id as TemplateName,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          vars: exampleVars as any,
        });
        if (!result.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.reason });
        return { ok: true as const };
      }),
  }),
});
