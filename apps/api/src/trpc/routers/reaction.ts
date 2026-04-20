// Multi-Reactions: ein User kann pro Video genau EINE Reaction halten; kind
// bestimmt den Emoji (LIKE/FIRE/LOL/WOW/SAD). Toggle ohne kind = LIKE.

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../init";

const ReactionKindSchema = z.enum(["LIKE", "FIRE", "LOL", "WOW", "SAD"]);

export const reactionRouter = router({
  // Summe aller Reactions (alle Kinds) — Backwards-Compatible mit v0.3-UI.
  countForVideo: publicProcedure
    .input(z.object({ videoId: z.string().min(1) }))
    .query(({ ctx, input }) =>
      ctx.prisma.reaction.count({ where: { videoId: input.videoId } }),
    ),

  // Map { LIKE: N, FIRE: N, … } — ungesetzte Keys fehlen. UI summiert Total.
  counts: publicProcedure
    .input(z.object({ videoId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.reaction.groupBy({
        by: ["kind"],
        where: { videoId: input.videoId },
        _count: { kind: true },
      });
      const out: Record<string, number> = {};
      for (const r of rows) out[r.kind] = r._count.kind;
      return out;
    }),

  mine: protectedProcedure
    .input(z.object({ videoId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const row = await ctx.prisma.reaction.findUnique({
        where: {
          userId_videoId: { userId, videoId: input.videoId },
        },
        select: { createdAt: true, kind: true },
      });
      return row
        ? {
            liked: true as const,
            kind: row.kind,
            likedAt: row.createdAt.toISOString(),
          }
        : { liked: false as const };
    }),

  // Toggle:
  // - kein Eintrag + kind → create
  // - Eintrag mit gleichem kind → delete
  // - Eintrag mit anderem kind → switch (update kind)
  toggle: protectedProcedure
    .input(
      z.object({
        videoId: z.string().min(1),
        kind: ReactionKindSchema.default("LIKE"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const existing = await ctx.prisma.reaction.findUnique({
        where: { userId_videoId: { userId, videoId: input.videoId } },
      });
      if (existing && existing.kind === input.kind) {
        await ctx.prisma.reaction.delete({
          where: {
            userId_videoId: { userId, videoId: input.videoId },
          },
        });
        return { liked: false as const };
      }
      if (existing) {
        await ctx.prisma.reaction.update({
          where: { userId_videoId: { userId, videoId: input.videoId } },
          data: { kind: input.kind },
        });
        return { liked: true as const, kind: input.kind };
      }
      await ctx.prisma.reaction.create({
        data: { userId, videoId: input.videoId, kind: input.kind },
      });
      return { liked: true as const, kind: input.kind };
    }),
});
