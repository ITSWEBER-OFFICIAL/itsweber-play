// Channel subscriptions. Every mutation is protectedProcedure; reads too
// (a subscription is inherently per-user).

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";

export const subscriptionRouter = router({
  // My subscribed channels, sorted by newest latest upload first.
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session.user as { id: string }).id;
    const subs = await ctx.prisma.subscription.findMany({
      where: { subscriberId: userId },
      select: {
        channelId: true,
        notify: true,
        createdAt: true,
        channel: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            description: true,
            avatarUrl: true,
            _count: { select: { videos: true, subscriptions: true } },
          },
        },
      },
    });
    return subs.map((s) => ({
      channelId: s.channelId,
      notify: s.notify,
      subscribedAt: s.createdAt.toISOString(),
      channel: s.channel,
    }));
  }),

  // Latest PUBLIC+LIVE videos from all channels I'm subscribed to — the
  // /subs feed.
  latestVideos: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(60).default(30),
          // Default LONG — Shorts haben einen eigenen Feed (/shorts).
          format: z.enum(["ALL", "LONG", "SHORT"]).default("LONG"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const format = input?.format ?? "LONG";
      const channelIds = (
        await ctx.prisma.subscription.findMany({
          where: { subscriberId: userId },
          select: { channelId: true },
        })
      ).map((s) => s.channelId);
      if (channelIds.length === 0) return [];
      return ctx.prisma.video.findMany({
        where: {
          channelId: { in: channelIds },
          visibility: "PUBLIC",
          status: "LIVE",
          ...(format !== "ALL" ? { format } : {}),
        },
        orderBy: { publishedAt: "desc" },
        take: input?.limit ?? 30,
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
    }),

  // Bulk-Check für den Channel-Header: ist User Abonnent?
  isSubscribed: protectedProcedure
    .input(z.object({ channelId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const row = await ctx.prisma.subscription.findUnique({
        where: {
          subscriberId_channelId: {
            subscriberId: userId,
            channelId: input.channelId,
          },
        },
        select: { notify: true, createdAt: true },
      });
      return row
        ? {
            subscribed: true as const,
            notify: row.notify,
            subscribedAt: row.createdAt.toISOString(),
          }
        : { subscribed: false as const };
    }),

  toggle: protectedProcedure
    .input(z.object({ channelId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const channel = await ctx.prisma.channel.findUnique({
        where: { id: input.channelId },
        select: { ownerId: true },
      });
      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });
      // Eigenen Kanal abonnieren ist sinnfrei — verhindern.
      if (channel.ownerId === userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Du kannst deinen eigenen Kanal nicht abonnieren.",
        });
      }

      const existing = await ctx.prisma.subscription.findUnique({
        where: {
          subscriberId_channelId: {
            subscriberId: userId,
            channelId: input.channelId,
          },
        },
      });
      if (existing) {
        await ctx.prisma.subscription.delete({
          where: {
            subscriberId_channelId: {
              subscriberId: userId,
              channelId: input.channelId,
            },
          },
        });
        return { subscribed: false as const };
      }
      await ctx.prisma.subscription.create({
        data: { subscriberId: userId, channelId: input.channelId },
      });
      return { subscribed: true as const };
    }),

  setNotify: protectedProcedure
    .input(
      z.object({
        channelId: z.string().min(1),
        notify: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      await ctx.prisma.subscription.update({
        where: {
          subscriberId_channelId: {
            subscriberId: userId,
            channelId: input.channelId,
          },
        },
        data: { notify: input.notify },
      });
      return { ok: true as const };
    }),
});
