// Layout-Block-Composer router (Theming Ebene 6). The `list` procedure is
// public — every homepage render reads it during SSR. Mutations are admin-only.
// Write operations publish on the same SSE bus as theme changes so the admin
// preview iframe reflects ordering/config changes live.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@play/db";
import { router, publicProcedure, adminProcedure } from "../init";
import { publishThemeUpdate } from "../../theme-bus";

const BLOCK_TYPES = [
  "HERO",
  "VIDEO_GRID",
  "CATEGORY_CHIPS",
  "CTA_BANNER",
  "SHORTS_ROW",
  "CHANNEL_ROW",
  "COMMUNITY_ROW",
] as const;
const BlockTypeSchema = z.enum(BLOCK_TYPES);

// ─── Per-type config schemas ────────────────────────────────────────────
// Each block's `config` JSON column is validated against its type's schema on
// every create/update. Unknown keys are stripped (z.object default).

const HeroConfigSchema = z.object({
  // Which video to feature. Null → auto-pick latest LIVE PUBLIC video.
  videoSlug: z.string().min(1).nullable().optional(),
  badgeLabel: z.string().max(40).default("Featured"),
  ctaLabel: z.string().max(40).default("Jetzt ansehen"),
});

const VideoGridConfigSchema = z.object({
  title: z.string().max(80).default("Neueste Videos"),
  badgeLabel: z.string().max(20).nullable().default("LATEST"),
  orderBy: z.enum(["latest", "mostViewed"]).default("latest"),
  limit: z.number().int().min(1).max(48).default(12),
  // Format-Filter: LONG = Standard-Grid, SHORT = nur Shorts, ALL = beide.
  // Default LONG, weil Shorts eigenen SHORTS_ROW-Block haben.
  format: z.enum(["ALL", "LONG", "SHORT"]).default("LONG"),
  // Skip the featured video (usually shown by a Hero block on the same page).
  skipFeatured: z.boolean().default(true),
});

const ShortsRowConfigSchema = z.object({
  title: z.string().max(80).default("Neueste Shorts"),
  badgeLabel: z.string().max(20).nullable().default("SHORTS"),
  orderBy: z.enum(["latest", "mostViewed"]).default("latest"),
  limit: z.number().int().min(1).max(24).default(10),
});

const ChannelRowConfigSchema = z.object({
  title: z.string().max(80).default("Empfohlene Kanäle"),
  badgeLabel: z.string().max(20).nullable().default("KANÄLE"),
  orderBy: z
    .enum(["mostSubscribed", "mostVideos", "newest"])
    .default("mostSubscribed"),
  limit: z.number().int().min(1).max(20).default(8),
});

const CommunityRowConfigSchema = z.object({
  title: z.string().max(80).default("Aus der Community"),
  badgeLabel: z.string().max(20).nullable().default("COMMUNITY"),
  limit: z.number().int().min(1).max(12).default(6),
});

const CategoryChipsConfigSchema = z.object({
  items: z
    .array(z.string().min(1).max(40))
    .min(1)
    .max(20)
    .default([
      "Alle",
      "Smart Home",
      "3D-Druck",
      "Server & IT",
      "Docker",
      "Unraid",
      "Tutorials",
      "News",
      "Projekte",
    ]),
});

const CtaBannerConfigSchema = z.object({
  headline: z.string().max(120).default("Leg los — lad dein erstes Video hoch."),
  body: z
    .string()
    .max(280)
    .default(
      "ITSWEBER Play nimmt MP4/MOV/MKV, transcoded zu HLS und served adaptive Streams.",
    ),
  ctaLabel: z.string().max(40).default("Video hochladen"),
  ctaHref: z.string().max(200).default("/studio/upload"),
});

function validateConfig(
  type: (typeof BLOCK_TYPES)[number],
  raw: unknown,
): Record<string, unknown> {
  switch (type) {
    case "HERO":
      return HeroConfigSchema.parse(raw ?? {});
    case "VIDEO_GRID":
      return VideoGridConfigSchema.parse(raw ?? {});
    case "CATEGORY_CHIPS":
      return CategoryChipsConfigSchema.parse(raw ?? {});
    case "CTA_BANNER":
      return CtaBannerConfigSchema.parse(raw ?? {});
    case "SHORTS_ROW":
      return ShortsRowConfigSchema.parse(raw ?? {});
    case "CHANNEL_ROW":
      return ChannelRowConfigSchema.parse(raw ?? {});
    case "COMMUNITY_ROW":
      return CommunityRowConfigSchema.parse(raw ?? {});
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function reorderToContiguous(prisma: PrismaClient, pageSlug: string) {
  // After a delete we compact positions so the UI numbers stay meaningful.
  const rows = await prisma.pageBlock.findMany({
    where: { pageSlug },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  await prisma.$transaction(
    rows.map((r, i) =>
      prisma.pageBlock.update({
        where: { id: r.id },
        data: { position: i },
      }),
    ),
  );
}

// ─── Router ─────────────────────────────────────────────────────────────

export const pageRouter = router({
  // Public — SSR-consumed on the homepage. Only enabled blocks.
  list: publicProcedure
    .input(
      z
        .object({
          pageSlug: z.string().default("home"),
          includeDisabled: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const pageSlug = input?.pageSlug ?? "home";
      const rows = await ctx.prisma.pageBlock.findMany({
        where: {
          pageSlug,
          ...(input?.includeDisabled ? {} : { enabled: true }),
        },
        orderBy: { position: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        pageSlug: r.pageSlug,
        position: r.position,
        type: r.type,
        enabled: r.enabled,
        config: r.config as Record<string, unknown>,
        updatedAt: r.updatedAt.toISOString(),
      }));
    }),

  create: adminProcedure
    .input(
      z.object({
        pageSlug: z.string().default("home"),
        type: BlockTypeSchema,
        config: z.record(z.string(), z.unknown()).optional(),
        // Insert at the end by default; admin UI may override.
        position: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const config = validateConfig(input.type, input.config);
      const last = await ctx.prisma.pageBlock.findFirst({
        where: { pageSlug: input.pageSlug },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = input.position ?? (last ? last.position + 1 : 0);

      const row = await ctx.prisma.pageBlock.create({
        data: {
          pageSlug: input.pageSlug,
          type: input.type,
          position,
          config: config as never,
        },
      });
      await publishThemeUpdate({ source: "page:create", id: row.id });
      return row;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        config: z.record(z.string(), z.unknown()).optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pageBlock.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const data: Record<string, unknown> = {};
      if (input.config !== undefined) {
        data.config = validateConfig(
          existing.type,
          input.config,
        ) as never;
      }
      if (input.enabled !== undefined) data.enabled = input.enabled;

      await ctx.prisma.pageBlock.update({
        where: { id: input.id },
        data: data as never,
      });
      await publishThemeUpdate({ source: "page:update", id: input.id });
      return { ok: true as const };
    }),

  // Bulk reorder: one round-trip, same ids stay in place, only `position`
  // changes. Admin UI passes the full ordered id-list.
  reorder: adminProcedure
    .input(
      z.object({
        pageSlug: z.string().default("home"),
        ids: z.array(z.string().min(1)).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pageBlock.findMany({
        where: { pageSlug: input.pageSlug },
        select: { id: true },
      });
      const existingSet = new Set(existing.map((r) => r.id));
      for (const id of input.ids) {
        if (!existingSet.has(id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Block ${id} gehört nicht zu ${input.pageSlug}`,
          });
        }
      }
      await ctx.prisma.$transaction(
        input.ids.map((id, i) =>
          ctx.prisma.pageBlock.update({
            where: { id },
            data: { position: i },
          }),
        ),
      );
      await publishThemeUpdate({ source: "page:reorder" });
      return { ok: true as const };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.pageBlock.findUnique({
        where: { id: input.id },
        select: { pageSlug: true },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.pageBlock.delete({ where: { id: input.id } });
      await reorderToContiguous(ctx.prisma, row.pageSlug);
      await publishThemeUpdate({ source: "page:delete" });
      return { ok: true as const };
    }),
});
