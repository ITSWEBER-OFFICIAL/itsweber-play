import { z } from "zod";
import { router, protectedProcedure } from "../init";

const VIDEO_SELECT = {
  id: true,
  slug: true,
  title: true,
  thumbnailKey: true,
  durationSec: true,
  viewCount: true,
  publishedAt: true,
  channel: { select: { slug: true, displayName: true, avatarUrl: true } },
} as const;

export const watchLaterRouter = router({
  // Toggle: vorhanden → löschen, nicht vorhanden → hinzufügen.
  toggle: protectedProcedure
    .input(z.object({ videoId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const existing = await ctx.prisma.watchLater.findUnique({
        where: { userId_videoId: { userId, videoId: input.videoId } },
        select: { userId: true },
      });
      if (existing) {
        await ctx.prisma.watchLater.delete({
          where: { userId_videoId: { userId, videoId: input.videoId } },
        });
        return { saved: false };
      } else {
        await ctx.prisma.watchLater.create({
          data: { userId, videoId: input.videoId },
        });
        return { saved: true };
      }
    }),

  // Prüft ob ein bestimmtes Video in der Watch-Later-Liste ist.
  isSaved: protectedProcedure
    .input(z.object({ videoId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const row = await ctx.prisma.watchLater.findUnique({
        where: { userId_videoId: { userId, videoId: input.videoId } },
        select: { userId: true },
      });
      return { saved: !!row };
    }),

  // Paginated Watch-Later-Liste, neueste zuerst.
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          cursor: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const limit = input?.limit ?? 20;
      const cursor = input?.cursor;

      const rows = await ctx.prisma.watchLater.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor
          ? {
              cursor: {
                userId_videoId: {
                  userId,
                  videoId: cursor,
                },
              },
              skip: 1,
            }
          : {}),
        select: {
          createdAt: true,
          video: { select: VIDEO_SELECT },
        },
      });

      let nextCursor: string | undefined;
      if (rows.length > limit) {
        const last = rows.pop()!;
        nextCursor = last.video.id;
      }

      return { items: rows, nextCursor };
    }),
});
