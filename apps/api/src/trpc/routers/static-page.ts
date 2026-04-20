// Static-Page CMS router — Impressum / Datenschutz / AGB und beliebige
// weitere statische HTML-Seiten. getBySlug ist public (SSR-Hotpath).
// Alle schreibenden Prozeduren sind admin-only.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, adminProcedure } from "../init";

const SlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);

const UpsertInput = z.object({
  slug: SlugSchema,
  title: z.string().min(1).max(200),
  body: z.string().max(200_000),
  published: z.boolean().optional(),
  showInFooter: z.boolean().optional(),
  order: z.number().int().min(0).max(999).optional(),
});

export const staticPageRouter = router({
  // SSR-consumed on /impressum, /datenschutz, /agb, etc.
  getBySlug: publicProcedure
    .input(z.object({ slug: SlugSchema }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.prisma.staticPage.findUnique({
        where: { slug: input.slug },
      });
      if (!page || !page.published) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return page;
    }),

  // Admin list — includes unpublished pages.
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.staticPage.findMany({
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      select: {
        slug: true,
        title: true,
        published: true,
        showInFooter: true,
        order: true,
        updatedAt: true,
        updatedBy: true,
      },
    });
  }),

  // Footer pages — public, only published + showInFooter.
  listFooter: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.staticPage.findMany({
      where: { published: true, showInFooter: true },
      orderBy: { order: "asc" },
      select: { slug: true, title: true },
    });
  }),

  upsert: adminProcedure
    .input(UpsertInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await ctx.prisma.staticPage.upsert({
        where: { slug: input.slug },
        update: {
          title: input.title,
          body: input.body,
          ...(input.published !== undefined && { published: input.published }),
          ...(input.showInFooter !== undefined && {
            showInFooter: input.showInFooter,
          }),
          ...(input.order !== undefined && { order: input.order }),
          updatedBy: userId,
        },
        create: {
          slug: input.slug,
          title: input.title,
          body: input.body,
          published: input.published ?? true,
          showInFooter: input.showInFooter ?? true,
          order: input.order ?? 0,
          updatedBy: userId,
        },
      });
      return { ok: true as const };
    }),

  delete: adminProcedure
    .input(z.object({ slug: SlugSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.staticPage.findUnique({
        where: { slug: input.slug },
        select: { slug: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.staticPage.delete({ where: { slug: input.slug } });
      return { ok: true as const };
    }),
});
