// Creator-Studio aggregates (Dashboard stats + sidebar counts).
// View-tracking isn't wired up yet — the `viewCount` column is populated by
// the /watch page today (watch-time + retention are on the roadmap).

import { z } from "zod";
import { router, protectedProcedure } from "../init";

const PeriodEnum = z.enum(["7d", "30d", "90d"]);

function periodSince(period: "7d" | "30d" | "90d"): Date {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export const studioRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session.user as { id: string }).id;

    const [total, live, processing, draft, failed, viewsAgg] = await Promise.all(
      [
        ctx.prisma.video.count({ where: { ownerId: userId } }),
        ctx.prisma.video.count({ where: { ownerId: userId, status: "LIVE" } }),
        ctx.prisma.video.count({
          where: { ownerId: userId, status: "PROCESSING" },
        }),
        ctx.prisma.video.count({
          where: { ownerId: userId, status: "PENDING" },
        }),
        ctx.prisma.video.count({
          where: { ownerId: userId, status: "FAILED" },
        }),
        ctx.prisma.video.aggregate({
          where: { ownerId: userId },
          _sum: { viewCount: true, durationSec: true },
        }),
      ],
    );

    // Watch-Time-Mock: naive approximation — avg 60% retention over
    // (viewCount * durationSec). Real watch-time tracking is on the roadmap.
    const totalViews = viewsAgg._sum.viewCount ?? 0;
    const totalDurationSec = viewsAgg._sum.durationSec ?? 0;
    const watchTimeHours = Math.round(
      ((totalViews * totalDurationSec * 0.6) / 3600) * 10,
    ) / 10;

    // Abonnenten zählen wir jetzt aus der Subscription-Tabelle (joined über
    // alle Channels dieses Users).
    const subscribers = await ctx.prisma.subscription.count({
      where: { channel: { ownerId: userId } },
    });

    return {
      counts: {
        total,
        live,
        processing,
        draft,
        failed,
      },
      stats: {
        videos: total,
        views30d: totalViews, // placeholder: not yet windowed
        watchTimeHours,
        subscribers,
      },
    };
  }),

  // Analytics-Detail — 4 Top-Metriken + Top-10-Video-Liste für Zeitraum.
  // `period` filtert via publishedAt; Views/Likes/Comments sind lifetime,
  // weil wir pro Video noch keine Timeseries haben (kommt mit v0.3).
  analytics: protectedProcedure
    .input(z.object({ period: PeriodEnum.default("30d") }))
    .query(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const since = periodSince(input.period);

      const whereOwned = { ownerId: userId };
      const whereOwnedPeriod = {
        ownerId: userId,
        publishedAt: { gte: since },
      };

      const [agg, totalVideosLive, subscribers, topVideos] = await Promise.all([
        ctx.prisma.video.aggregate({
          where: whereOwnedPeriod,
          _sum: { viewCount: true, durationSec: true },
        }),
        ctx.prisma.video.count({
          where: { ownerId: userId, status: "LIVE", visibility: "PUBLIC" },
        }),
        ctx.prisma.subscription.count({
          where: { channel: { ownerId: userId } },
        }),
        ctx.prisma.video.findMany({
          where: whereOwned,
          orderBy: { viewCount: "desc" },
          take: 10,
          select: {
            id: true,
            slug: true,
            title: true,
            thumbnailKey: true,
            durationSec: true,
            viewCount: true,
            publishedAt: true,
            visibility: true,
            status: true,
            _count: { select: { reactions: true, comments: true } },
          },
        }),
      ]);

      const totalViews = agg._sum.viewCount ?? 0;
      const totalDurationSec = agg._sum.durationSec ?? 0;
      const totalWatchTimeH =
        Math.round(((totalViews * totalDurationSec * 0.6) / 3600) * 10) / 10;

      return {
        period: input.period,
        totalViews,
        totalWatchTimeH,
        totalSubscribers: subscribers,
        totalVideosLive,
        topVideos: topVideos.map((v) => ({
          id: v.id,
          slug: v.slug,
          title: v.title,
          thumbnailKey: v.thumbnailKey,
          durationSec: v.durationSec,
          viewCount: v.viewCount,
          likeCount: v._count.reactions,
          commentCount: v._count.comments,
          publishedAt: v.publishedAt,
          visibility: v.visibility,
          status: v.status,
        })),
      };
    }),

  // Abonnenten-Liste. Cursor-basiert. Der Owner sieht alle Subscriptions
  // aggregiert über alle seine Kanäle (MVP: User hat genau 1 Kanal).
  subscribers: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;

      const [total, last7d] = await Promise.all([
        ctx.prisma.subscription.count({
          where: { channel: { ownerId: userId } },
        }),
        ctx.prisma.subscription.count({
          where: {
            channel: { ownerId: userId },
            createdAt: { gte: periodSince("7d") },
          },
        }),
      ]);

      const cursor = input.cursor
        ? decodeCursor(input.cursor)
        : undefined;

      const rows = await ctx.prisma.subscription.findMany({
        where: { channel: { ownerId: userId } },
        orderBy: [{ createdAt: "desc" }, { subscriberId: "desc" }],
        take: input.limit + 1,
        ...(cursor
          ? {
              cursor: {
                subscriberId_channelId: {
                  subscriberId: cursor.subscriberId,
                  channelId: cursor.channelId,
                },
              },
              skip: 1,
            }
          : {}),
        include: {
          subscriber: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          channel: { select: { id: true, slug: true } },
        },
      });

      let nextCursor: string | undefined;
      if (rows.length > input.limit) {
        const next = rows.pop()!;
        nextCursor = encodeCursor({
          subscriberId: next.subscriberId,
          channelId: next.channelId,
        });
      }

      return {
        total,
        last7d,
        items: rows.map((r) => ({
          handle: r.subscriber.handle,
          displayName: r.subscriber.displayName,
          avatarUrl: r.subscriber.avatarUrl,
          subscribedAt: r.createdAt,
          notify: r.notify,
          channelSlug: r.channel.slug,
        })),
        nextCursor,
      };
    }),
});

function encodeCursor(c: { subscriberId: string; channelId: string }): string {
  return Buffer.from(`${c.subscriberId}:${c.channelId}`, "utf8").toString(
    "base64url",
  );
}

function decodeCursor(
  raw: string,
): { subscriberId: string; channelId: string } | undefined {
  try {
    const [subscriberId, channelId] = Buffer.from(raw, "base64url")
      .toString("utf8")
      .split(":");
    if (!subscriberId || !channelId) return undefined;
    return { subscriberId, channelId };
  } catch {
    return undefined;
  }
}
