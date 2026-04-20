// Nutzer-Suchen für @Mention-Autocomplete. Suchfeld: handle + displayName
// (case-insensitive, prefix + contains). Limit 8 Treffer.

import { z } from "zod";
import { router, publicProcedure } from "../init";

export const userRouter = router({
  search: publicProcedure
    .input(
      z.object({
        q: z.string().trim().min(1).max(32),
        limit: z.number().int().min(1).max(20).default(8),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.q.replace(/^@/, "");
      const rows = await ctx.prisma.user.findMany({
        where: {
          banned: false,
          OR: [
            { handle: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { handle: "asc" },
        take: input.limit,
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
        },
      });
      return rows;
    }),
});
