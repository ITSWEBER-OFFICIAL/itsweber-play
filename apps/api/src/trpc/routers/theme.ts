// Theme router (Ebene 3-5): admin live-editor backend.
// Most paths are admin-only; `get` is public because every page render reads
// it during SSR — going through a session round-trip would make first-paint
// measurably slower.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@play/db";
import { config as storageConfig, removeObject } from "@play/storage";
import { loadPreset, listPresets } from "@play/theme/presets";
import { router, publicProcedure, adminProcedure } from "../init";
import { publishThemeUpdate } from "../../theme-bus";

// Public HTTP URL for a MinIO object in the public play-assets bucket. The
// browser hits MinIO directly (anon-read policy is set in ensureBuckets).
function logoUrlForKey(key: string | null): string | null {
  if (!key) return null;
  const base = (process.env.S3_PUBLIC_URL ?? storageConfig.endpoint).replace(
    /\/+$/,
    "",
  );
  return `${base}/${storageConfig.buckets.assets}/${key}`;
}

const SINGLETON_ID = "singleton";
const REVISION_LIMIT = 20;
const AUDIT_PAGE_LIMIT = 50;

// Keep audit payloads bounded — token-diffs can balloon on a big import.
function truncateForAudit<T>(value: T, maxLen = 500): T | string {
  const s = JSON.stringify(value);
  if (s.length <= maxLen) return value;
  return s.slice(0, maxLen) + "…(truncated)";
}

async function writeAudit(
  prisma: PrismaClient,
  userId: string | null,
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.themeAuditLog.create({
    data: { userId, action, payload: payload as never },
  });
}

// ─── Custom-CSS validation ──────────────────────────────────────────────
// Per docs/03-theming.md: block @import (exfil), url(javascript:…) (XSS),
// expression() (IE-era XSS but still historically exploited). Also block
// </style> which would let an admin escape the style tag and inject HTML.
const FORBIDDEN_CSS = [
  /@import\b/i,
  /url\s*\(\s*['"]?\s*javascript:/i,
  /url\s*\(\s*['"]?\s*data:text\/html/i,
  /expression\s*\(/i,
  /<\/?\s*style/i,
  /<script/i,
  /behavior\s*:/i,
];

function assertSafeCss(css: string) {
  for (const rx of FORBIDDEN_CSS) {
    if (rx.test(css)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Custom-CSS enthält verbotenes Konstrukt: ${rx}`,
      });
    }
  }
  if (css.length > 100_000) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Custom-CSS > 100 KB — das hat fast sicher einen Bug.",
    });
  }
}

// Token-override keys are dot-paths like `color.neutral.900`. Constrain to
// safe charset so `overridesToCssBlock` in @play/theme can trust the input.
const TOKEN_PATH_RE = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)*$/;
const TOKEN_VALUE_RE = /^[^;{}<>]{0,200}$/;

const TokensOverrideSchema = z
  .record(z.string(), z.string().nullable())
  .superRefine((val, ctx) => {
    for (const [k, v] of Object.entries(val)) {
      if (!TOKEN_PATH_RE.test(k)) {
        ctx.addIssue({
          code: "custom",
          message: `Ungültiger Token-Pfad: ${k}`,
        });
      }
      if (v !== null && !TOKEN_VALUE_RE.test(v)) {
        ctx.addIssue({
          code: "custom",
          message: `Ungültiger Token-Wert für ${k}`,
        });
      }
    }
  });

// ─── Helpers ────────────────────────────────────────────────────────────

type OverrideMap = Record<string, string>;

async function getOrCreateSettings(prisma: PrismaClient) {
  // Upsert in a single round-trip, idempotent bootstrap on first call.
  return prisma.themeSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
}

function mergeOverrides(
  current: unknown,
  patch: Record<string, string | null>,
): OverrideMap {
  const out: OverrideMap = {
    ...((current ?? {}) as OverrideMap),
  };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

// ─── Router ─────────────────────────────────────────────────────────────

export const themeRouter = router({
  // Public: consumed by SSR on every render. Keep lean.
  get: publicProcedure.query(async ({ ctx }) => {
    const row = await getOrCreateSettings(ctx.prisma);
    return {
      tokensOverride: (row.tokensOverride ?? {}) as OverrideMap,
      customCss: row.customCss,
      logoFilter: row.logoFilter,
      logoUrl: logoUrlForKey(row.logoAssetKey),
      activePreset: row.activePreset,
      updatedAt: row.updatedAt.toISOString(),
    };
  }),

  listPresets: adminProcedure.query(async () => {
    return listPresets();
  }),

  // Partial-merge into tokensOverride. `null` in the patch removes a key.
  update: adminProcedure
    .input(
      z.object({
        tokensOverride: TokensOverrideSchema.optional(),
        logoFilter: z.string().max(64).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const current = await getOrCreateSettings(ctx.prisma);
      const merged = input.tokensOverride
        ? mergeOverrides(current.tokensOverride, input.tokensOverride)
        : undefined;

      const userId = (ctx.session.user as { id: string }).id;

      await ctx.prisma.themeSettings.update({
        where: { id: SINGLETON_ID },
        data: {
          ...(merged ? { tokensOverride: merged } : {}),
          ...(input.logoFilter !== undefined
            ? { logoFilter: input.logoFilter }
            : {}),
          // A manual token edit invalidates the preset link.
          ...(merged ? { activePreset: null } : {}),
          updatedBy: userId,
        },
      });

      await writeAudit(ctx.prisma, userId, "update", {
        patch: truncateForAudit(input.tokensOverride ?? {}),
        logoFilter: input.logoFilter,
      });
      await publishThemeUpdate({ source: "update" });
      return { ok: true as const };
    }),

  applyPreset: adminProcedure
    .input(z.object({ presetId: z.string().regex(/^[a-z0-9-]+$/) }))
    .mutation(async ({ ctx, input }) => {
      const preset = await loadPreset(input.presetId).catch(() => null);
      if (!preset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Preset nicht gefunden: ${input.presetId}`,
        });
      }
      const userId = (ctx.session.user as { id: string }).id;

      await getOrCreateSettings(ctx.prisma);
      await ctx.prisma.themeSettings.update({
        where: { id: SINGLETON_ID },
        data: {
          tokensOverride: preset.overrides ?? {},
          logoFilter: preset.logoFilter ?? null,
          activePreset: input.presetId,
          updatedBy: userId,
        },
      });

      await writeAudit(ctx.prisma, userId, "applyPreset", {
        presetId: input.presetId,
        presetName: preset.name,
      });
      await publishThemeUpdate({ source: "preset", presetId: input.presetId });
      return { ok: true as const, preset: preset.name };
    }),

  setCustomCss: adminProcedure
    .input(z.object({ customCss: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (input.customCss) assertSafeCss(input.customCss);

      const userId = (ctx.session.user as { id: string }).id;
      await getOrCreateSettings(ctx.prisma);

      await ctx.prisma.$transaction(async (tx) => {
        await tx.themeRevision.create({
          data: { customCss: input.customCss, updatedBy: userId },
        });
        // Keep only the most recent REVISION_LIMIT rows.
        const keep = await tx.themeRevision.findMany({
          orderBy: { createdAt: "desc" },
          take: REVISION_LIMIT,
          select: { id: true },
        });
        const keepIds = keep.map((r) => r.id);
        await tx.themeRevision.deleteMany({
          where: { id: { notIn: keepIds } },
        });
        await tx.themeSettings.update({
          where: { id: SINGLETON_ID },
          data: { customCss: input.customCss, updatedBy: userId },
        });
      });

      await writeAudit(ctx.prisma, userId, "setCustomCss", {
        cleared: input.customCss == null,
        length: input.customCss?.length ?? 0,
      });
      await publishThemeUpdate({ source: "customCss" });
      return { ok: true as const };
    }),

  listRevisions: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.themeRevision.findMany({
      orderBy: { createdAt: "desc" },
      take: REVISION_LIMIT,
      select: {
        id: true,
        customCss: true,
        updatedBy: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      preview: r.customCss?.slice(0, 80) ?? null,
    }));
  }),

  rollback: adminProcedure
    .input(z.object({ revisionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rev = await ctx.prisma.themeRevision.findUnique({
        where: { id: input.revisionId },
      });
      if (!rev) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const userId = (ctx.session.user as { id: string }).id;
      await ctx.prisma.themeSettings.update({
        where: { id: SINGLETON_ID },
        data: { customCss: rev.customCss, updatedBy: userId },
      });
      await writeAudit(ctx.prisma, userId, "rollback", {
        revisionId: input.revisionId,
      });
      await publishThemeUpdate({ source: "rollback" });
      return { ok: true as const };
    }),

  // Full dump for backup / inter-instance sharing.
  exportJson: adminProcedure.query(async ({ ctx }) => {
    const row = await getOrCreateSettings(ctx.prisma);
    return {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      tokensOverride: row.tokensOverride ?? {},
      customCss: row.customCss,
      logoFilter: row.logoFilter,
      activePreset: row.activePreset,
    };
  }),

  importJson: adminProcedure
    .input(
      z.object({
        version: z.literal(1),
        tokensOverride: TokensOverrideSchema.optional(),
        customCss: z.string().nullable().optional(),
        logoFilter: z.string().nullable().optional(),
        activePreset: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.customCss) assertSafeCss(input.customCss);

      const userId = (ctx.session.user as { id: string }).id;
      await getOrCreateSettings(ctx.prisma);

      // Drop nulls in the import so the zod record type matches Prisma's Json.
      const tokens: OverrideMap = {};
      for (const [k, v] of Object.entries(input.tokensOverride ?? {})) {
        if (v != null) tokens[k] = v;
      }

      await ctx.prisma.themeSettings.update({
        where: { id: SINGLETON_ID },
        data: {
          tokensOverride: tokens,
          customCss: input.customCss ?? null,
          logoFilter: input.logoFilter ?? null,
          activePreset: input.activePreset ?? null,
          updatedBy: userId,
        },
      });
      await writeAudit(ctx.prisma, userId, "importJson", {
        tokenKeys: Object.keys(tokens).length,
        activePreset: input.activePreset ?? null,
        customCssLength: input.customCss?.length ?? 0,
      });
      await publishThemeUpdate({ source: "import" });
      return { ok: true as const };
    }),

  removeLogo: adminProcedure.mutation(async ({ ctx }) => {
    const userId = (ctx.session.user as { id: string }).id;
    const current = await getOrCreateSettings(ctx.prisma);
    if (current.logoAssetKey) {
      removeObject(storageConfig.buckets.assets, current.logoAssetKey).catch(
        (err) => console.warn("[theme.removeLogo] delete failed:", err),
      );
    }
    await ctx.prisma.themeSettings.update({
      where: { id: SINGLETON_ID },
      data: { logoAssetKey: null, updatedBy: userId },
    });
    await writeAudit(ctx.prisma, userId, "removeLogo", {
      previousKey: current.logoAssetKey ?? null,
    });
    await publishThemeUpdate({ source: "logo" });
    return { ok: true as const };
  }),

  listAuditLog: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(AUDIT_PAGE_LIMIT).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.themeAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 20,
      });
      // Best-effort user-name lookup; one round-trip, handles deleted users.
      const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
      const users = userIds.length
        ? await ctx.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, handle: true, email: true },
          })
        : [];
      const byId = new Map(users.map((u) => [u.id, u]));
      return rows.map((r) => ({
        id: r.id,
        action: r.action,
        payload: r.payload,
        createdAt: r.createdAt.toISOString(),
        user: r.userId
          ? byId.get(r.userId) ?? { id: r.userId, handle: "(unknown)", email: "" }
          : null,
      }));
    }),
});
