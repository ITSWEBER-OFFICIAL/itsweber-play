// Video-Categories. `list` + `getBySlug` are public (used by Chips-Block,
// /category/[slug] page, filter dropdowns). Write ops are admin-only.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, adminProcedure } from "../init";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

export const categoryRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.prisma.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        icon: true,
        order: true,
        _count: {
          select: {
            videos: {
              where: { visibility: "PUBLIC", status: "LIVE" },
            },
          },
        },
      },
    }),
  ),

  getBySlug: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        // Default LONG — Shorts haben einen eigenen Feed (/shorts).
        // Frontend kann ALL anfordern, dann selbst sektionieren.
        format: z.enum(["ALL", "LONG", "SHORT"]).default("LONG"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cat = await ctx.prisma.category.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          icon: true,
        },
      });
      if (!cat) throw new TRPCError({ code: "NOT_FOUND" });
      const videos = await ctx.prisma.video.findMany({
        where: {
          categoryId: cat.id,
          visibility: "PUBLIC",
          status: "LIVE",
          ...(input.format !== "ALL" ? { format: input.format } : {}),
        },
        orderBy: { publishedAt: "desc" },
        take: 48,
        select: {
          id: true,
          slug: true,
          title: true,
          thumbnailKey: true,
          durationSec: true,
          viewCount: true,
          publishedAt: true,
          format: true,
          channel: { select: { slug: true, displayName: true } },
        },
      });
      return { category: cat, videos };
    }),

  create: adminProcedure
    .input(
      z.object({
        slug: z.string().regex(SLUG_RE),
        name: z.string().trim().min(1).max(60),
        description: z.string().max(280).nullable().optional(),
        icon: z.string().max(8).nullable().optional(),
        order: z.number().int().min(0).max(9999).default(100),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.category.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          icon: input.icon ?? null,
          order: input.order,
        },
      }),
    ),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(60).optional(),
        description: z.string().max(280).nullable().optional(),
        icon: z.string().max(8).nullable().optional(),
        order: z.number().int().min(0).max(9999).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await ctx.prisma.category.update({
        where: { id },
        data: rest as never,
      });
      return { ok: true as const };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Video.categoryId is SetNull — kein Datenverlust an Videos.
      await ctx.prisma.category.delete({ where: { id: input.id } });
      return { ok: true as const };
    }),
});
