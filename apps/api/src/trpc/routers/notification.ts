// In-App-Notifications. Badge + Dropdown im Header. Externe E-Mails
// kommen in v1.0 über Better-Auth-Transport.

import { z } from "zod";
import { router, protectedProcedure } from "../init";

export const notificationRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(50).default(20) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const rows = await ctx.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 20,
      });
      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        link: r.link,
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session.user as { id: string }).id;
    return ctx.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      await ctx.prisma.notification.updateMany({
        where: { id: input.id, userId },
        data: { readAt: new Date() },
      });
      return { ok: true as const };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = (ctx.session.user as { id: string }).id;
    await ctx.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true as const };
  }),
});
