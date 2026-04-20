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
  channel: { select: { slug: true, displayName: true } },
} as const;

export const historyRouter = router({
  // Upsert: setzt watchedAt auf jetzt. Idempotent pro Video.
  add: protectedProcedure
    .input(z.object({ videoId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      await ctx.prisma.watchHistory.upsert({
        where: { userId_videoId: { userId, videoId: input.videoId } },
        create: { userId, videoId: input.videoId },
        update: { watchedAt: new Date() },
      });
      return { ok: true as const };
    }),

  // Paginated History-Liste, neueste zuerst.
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

      const rows = await ctx.prisma.watchHistory.findMany({
        where: { userId },
        orderBy: { watchedAt: "desc" },
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
          watchedAt: true,
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

  // Löscht alle History-Einträge des eingeloggten Users.
  clear: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = (ctx.session.user as { id: string }).id;
    await ctx.prisma.watchHistory.deleteMany({ where: { userId } });
    return { ok: true as const };
  }),
});
