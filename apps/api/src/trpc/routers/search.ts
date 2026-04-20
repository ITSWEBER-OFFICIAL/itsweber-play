// Cross-entity search. For v0.1 we stick with ILIKE — Postgres-FTS
// (`to_tsvector`-Indices) kommt später, wenn Content-Menge steigt.
// Returns (videos + channels) getrennt, damit die UI sie in zwei Sections
// rendern kann.

import { z } from "zod";
import type { Prisma } from "@play/db";
import { router, publicProcedure } from "../init";

export const searchRouter = router({
  all: publicProcedure
    .input(
      z.object({
        q: z.string().trim().min(1).max(200),
        categorySlug: z.string().optional(),
        limit: z.number().int().min(1).max(48).default(24),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.q;
      const limit = input.limit;
      const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

      // Videos: title / description / slug / tags array match.
      const videoWhere: Prisma.VideoWhereInput = {
        visibility: "PUBLIC",
        status: "LIVE",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { tags: { has: q.toLowerCase() } },
        ],
      };
      if (input.categorySlug) {
        videoWhere.category = { slug: input.categorySlug };
      }

      const [videos, channels, tagMatches] = await Promise.all([
        ctx.prisma.video.findMany({
          where: videoWhere,
          orderBy: { publishedAt: "desc" },
          take: limit,
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
        }),
        ctx.prisma.channel.findMany({
          where: {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { displayName: "asc" },
          take: 8,
          select: {
            id: true,
            slug: true,
            displayName: true,
            description: true,
            avatarUrl: true,
            _count: {
              select: {
                videos: { where: { visibility: "PUBLIC", status: "LIVE" } },
                subscriptions: true,
              },
            },
          },
        }),
        // Tag-autocomplete-Kandidaten — für spätere Dropdown-Suggest-UI.
        ctx.prisma.$queryRaw<{ tag: string; count: bigint }[]>`
          SELECT LOWER(tag) AS tag, COUNT(*)::bigint AS count
          FROM "Video", unnest(tags) AS tag
          WHERE LOWER(tag) LIKE LOWER(${like})
            AND visibility = 'PUBLIC' AND status = 'LIVE'
          GROUP BY LOWER(tag)
          ORDER BY count DESC
          LIMIT 8
        `.catch(() => []),
      ]);

      return {
        query: q,
        videos,
        channels,
        tags: tagMatches.map((r) => ({
          tag: r.tag,
          count: Number(r.count),
        })),
      };
    }),

  // Listet alle Public-LIVE-Videos mit einem bestimmten Tag (lowercase).
  // Frontend: /tag/[tag]
  byTag: publicProcedure
    .input(
      z.object({
        tag: z.string().trim().toLowerCase().min(1).max(60),
        limit: z.number().int().min(1).max(48).default(24),
      }),
    )
    .query(async ({ ctx, input }) => {
      const videos = await ctx.prisma.video.findMany({
        where: {
          visibility: "PUBLIC",
          status: "LIVE",
          tags: { has: input.tag },
        },
        orderBy: { publishedAt: "desc" },
        take: input.limit,
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
      return { tag: input.tag, videos };
    }),
});
