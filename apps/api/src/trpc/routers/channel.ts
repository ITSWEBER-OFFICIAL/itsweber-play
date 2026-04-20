import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { config, removeObject } from "@play/storage";
import { router, publicProcedure, protectedProcedure } from "../init";

const SECTION_KEYS = [
  "featured",
  "latest",
  "shorts",
  "popular",
  "playlists",
  "about",
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

function sanitizeSectionOrder(input: string[]): SectionKey[] {
  const seen = new Set<SectionKey>();
  const out: SectionKey[] = [];
  for (const k of input) {
    if ((SECTION_KEYS as readonly string[]).includes(k) && !seen.has(k as SectionKey)) {
      seen.add(k as SectionKey);
      out.push(k as SectionKey);
    }
  }
  return out;
}

const SocialLinkSchema = z.object({
  platform: z.enum([
    "website",
    "youtube",
    "twitter",
    "github",
    "mastodon",
    "instagram",
    "linkedin",
    "email",
    "other",
  ]),
  url: z.string().url().max(500),
});

export const channelRouter = router({
  // Directory of all channels. Sort-Options sind Server-seitig, damit die
  // Counts (videos + subscriptions) ohne N+1-Query herauskommen.
  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(60),
          orderBy: z
            .enum(["newest", "mostSubscribed", "mostVideos", "alphabetical"])
            .default("mostSubscribed"),
          search: z.string().trim().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search;
      const channels = await ctx.prisma.channel.findMany({
        where: search
          ? {
              OR: [
                { displayName: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : undefined,
        // Für mostSubscribed/mostVideos sortieren wir im Memory, weil Prisma
        // keine orderBy auf _count hat ohne Preview-Feature.
        orderBy:
          input?.orderBy === "newest"
            ? { createdAt: "desc" }
            : input?.orderBy === "alphabetical"
              ? { displayName: "asc" }
              : { createdAt: "desc" },
        take: input?.limit ?? 60,
        select: {
          id: true,
          slug: true,
          displayName: true,
          description: true,
          avatarUrl: true,
          bannerUrl: true,
          createdAt: true,
          _count: {
            select: {
              videos: { where: { visibility: "PUBLIC", status: "LIVE" } },
              subscriptions: true,
            },
          },
        },
      });
      if (input?.orderBy === "mostSubscribed") {
        channels.sort(
          (a, b) => b._count.subscriptions - a._count.subscriptions,
        );
      }
      if (input?.orderBy === "mostVideos") {
        channels.sort((a, b) => b._count.videos - a._count.videos);
      }
      return channels;
    }),

  // Kanal-Info per Slug. List-Filter respektiert Sichtbarkeit —
  // Fremde sehen nur PUBLIC+LIVE, Owner/ADMIN sieht alles.
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const channel = await ctx.prisma.channel.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          slug: true,
          displayName: true,
          description: true,
          about: true,
          socialLinks: true,
          avatarUrl: true,
          bannerUrl: true,
          accentColor: true,
          sectionOrder: true,
          featuredVideoId: true,
          trailerVideoId: true,
          createdAt: true,
          ownerId: true,
          owner: {
            select: { handle: true, displayName: true, role: true },
          },
          _count: { select: { videos: true, subscriptions: true } },
          featuredVideo: {
            select: {
              id: true,
              slug: true,
              title: true,
              thumbnailKey: true,
              durationSec: true,
              viewCount: true,
              publishedAt: true,
              format: true,
            },
          },
          trailerVideo: {
            select: {
              id: true,
              slug: true,
              title: true,
              thumbnailKey: true,
              durationSec: true,
              format: true,
            },
          },
        },
      });
      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });

      const sessionUser = ctx.session?.user as
        | { id: string; role?: string }
        | undefined;
      const isOwnerOrAdmin =
        sessionUser?.id === channel.ownerId ||
        sessionUser?.role === "ADMIN";

      const videos = await ctx.prisma.video.findMany({
        where: {
          channelId: channel.id,
          ...(isOwnerOrAdmin
            ? {}
            : { visibility: "PUBLIC", status: "LIVE" }),
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
          status: true,
          visibility: true,
          format: true,
          channel: { select: { slug: true, displayName: true } },
        },
      });

      return { channel, videos, isOwnerOrAdmin };
    }),

  // Der eingeloggte Creator bearbeitet sein(e) Kanal-Profil(e). Authorization
  // läuft über `ownerId === session.user.id` — Admin darf fremde Kanäle
  // ebenfalls editieren (z. B. Moderation).
  myChannel: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session.user as { id: string }).id;
    const channel = await ctx.prisma.channel.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        slug: true,
        displayName: true,
        description: true,
        about: true,
        socialLinks: true,
        avatarUrl: true,
        bannerUrl: true,
        avatarAssetKey: true,
        bannerAssetKey: true,
        accentColor: true,
        sectionOrder: true,
        featuredVideoId: true,
        trailerVideoId: true,
        createdAt: true,
        _count: { select: { videos: true, subscriptions: true } },
      },
    });
    if (!channel) throw new TRPCError({ code: "NOT_FOUND" });
    return channel;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        displayName: z.string().trim().min(1).max(80).optional(),
        description: z.string().max(500).nullable().optional(),
        about: z.string().max(5_000).nullable().optional(),
        socialLinks: z.array(SocialLinkSchema).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.prisma.channel.findUnique({
        where: { id: input.id },
        select: { ownerId: true },
      });
      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });
      const sessionUser = ctx.session.user as { id: string; role?: string };
      if (
        channel.ownerId !== sessionUser.id &&
        sessionUser.role !== "ADMIN"
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const data: Record<string, unknown> = {};
      if (input.displayName !== undefined) data.displayName = input.displayName;
      if (input.description !== undefined) data.description = input.description;
      if (input.about !== undefined) data.about = input.about;
      if (input.socialLinks !== undefined) data.socialLinks = input.socialLinks;
      return ctx.prisma.channel.update({
        where: { id: input.id },
        data: data as never,
        select: { id: true, slug: true, displayName: true },
      });
    }),

  // Branding-Layout: Accent-Farbe, Section-Order, Featured/Trailer.
  // Alle Felder optional → partial update. accentColor mit regex-Validierung
  // (Hex 6-stellig) und featured/trailer müssen dem Owner gehören + LIVE sein.
  updateAppearance: protectedProcedure
    .input(
      z.object({
        channelId: z.string().min(1),
        accentColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Hex #RRGGBB erwartet")
          .nullable()
          .optional(),
        sectionOrder: z.array(z.string()).max(10).optional(),
        featuredVideoId: z.string().nullable().optional(),
        trailerVideoId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as { id: string; role?: string };
      const channel = await ctx.prisma.channel.findUnique({
        where: { id: input.channelId },
        select: { ownerId: true, id: true },
      });
      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        channel.ownerId !== sessionUser.id &&
        sessionUser.role !== "ADMIN"
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const data: Record<string, unknown> = {};
      if (input.accentColor !== undefined) data.accentColor = input.accentColor;
      if (input.sectionOrder !== undefined)
        data.sectionOrder = sanitizeSectionOrder(input.sectionOrder);

      // Featured + Trailer validieren: gehört dem Owner + ist LIVE.
      for (const field of ["featuredVideoId", "trailerVideoId"] as const) {
        const v = input[field];
        if (v === undefined) continue;
        if (v === null) {
          data[field] = null;
          continue;
        }
        const video = await ctx.prisma.video.findUnique({
          where: { id: v },
          select: { ownerId: true, status: true, channelId: true },
        });
        if (!video || video.channelId !== channel.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${field}_NOT_FOUND`,
          });
        }
        if (video.status !== "LIVE") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${field}_NOT_LIVE`,
          });
        }
        data[field] = v;
      }

      await ctx.prisma.channel.update({
        where: { id: input.channelId },
        data: data as never,
        select: { id: true },
      });
      // sectionOrder bewusst nicht zurückgeben — Prisma-Json-Type führt hier
      // zu TS2589 am Client. Die UI refetched via channel.myChannel.
      return { ok: true };
    }),

  // Asset-Cleanup: entfernt avatar- oder banner-Asset aus DB + MinIO.
  // Eigentliche Uploads laufen über /api/studio/avatar und /api/studio/banner
  // (raw-stream, siehe channel-assets-upload.ts).
  clearAsset: protectedProcedure
    .input(
      z.object({
        channelId: z.string().min(1),
        kind: z.enum(["avatar", "banner"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as { id: string; role?: string };
      const channel = await ctx.prisma.channel.findUnique({
        where: { id: input.channelId },
        select: { ownerId: true, avatarAssetKey: true, bannerAssetKey: true },
      });
      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        channel.ownerId !== sessionUser.id &&
        sessionUser.role !== "ADMIN"
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const keyField =
        input.kind === "avatar" ? "avatarAssetKey" : "bannerAssetKey";
      const urlField = input.kind === "avatar" ? "avatarUrl" : "bannerUrl";
      const prevKey = channel[keyField];

      await ctx.prisma.channel.update({
        where: { id: input.channelId },
        data: { [keyField]: null, [urlField]: null } as never,
      });

      if (prevKey) {
        removeObject(config.buckets.assets, prevKey).catch(() => undefined);
      }
      return { ok: true };
    }),
});
