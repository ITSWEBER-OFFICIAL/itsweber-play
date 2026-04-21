// Playlist-CRUD + Item-Management. Playlists sind kanal-gebunden — der
// User hat pro Kanal beliebig viele Listen. Visibility folgt demselben Enum
// wie Videos (public/unlisted/private/logged_in). PUBLIC ist Default.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { customAlphabet } from "nanoid";
import { router, publicProcedure, protectedProcedure } from "../init";

const playlistSlug = customAlphabet(
  "23456789abcdefghijkmnpqrstuvwxyz",
  9,
);

const VisibilityEnum = z.enum(["PUBLIC", "UNLISTED", "PRIVATE", "LOGGED_IN"]);

async function assertOwner(
  prisma: typeof import("@play/db").prisma,
  playlistId: string,
  userId: string,
  role?: string,
) {
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    select: { ownerId: true },
  });
  if (!playlist) throw new TRPCError({ code: "NOT_FOUND" });
  if (playlist.ownerId !== userId && role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return playlist;
}

export const playlistRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session.user as { id: string }).id;
    return ctx.prisma.playlist.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    });
  }),

  // Playlists eines Kanals — respektiert Visibility (wie Videos).
  byChannel: publicProcedure
    .input(z.object({ channelId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const sessionUser = ctx.session?.user as
        | { id: string; role?: string }
        | undefined;
      const channel = await ctx.prisma.channel.findUnique({
        where: { id: input.channelId },
        select: { ownerId: true },
      });
      if (!channel) return [];
      const isOwnerOrAdmin =
        sessionUser?.id === channel.ownerId ||
        sessionUser?.role === "ADMIN";
      return ctx.prisma.playlist.findMany({
        where: {
          channelId: input.channelId,
          ...(isOwnerOrAdmin
            ? {}
            : sessionUser
              ? { visibility: { in: ["PUBLIC", "LOGGED_IN"] } }
              : { visibility: "PUBLIC" }),
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          visibility: true,
          _count: { select: { items: true } },
        },
      });
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findUnique({
        where: { slug: input.slug },
        include: {
          channel: {
            select: {
              id: true,
              slug: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          items: {
            orderBy: { position: "asc" },
            include: {
              video: {
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
                  channel: { select: { slug: true, displayName: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      });
      if (!playlist) throw new TRPCError({ code: "NOT_FOUND" });

      const sessionUser = ctx.session?.user as
        | { id: string; role?: string }
        | undefined;
      const isOwnerOrAdmin =
        sessionUser?.id === playlist.ownerId ||
        sessionUser?.role === "ADMIN";
      if (!isOwnerOrAdmin) {
        if (playlist.visibility === "PRIVATE")
          throw new TRPCError({ code: "NOT_FOUND" });
        if (playlist.visibility === "LOGGED_IN" && !sessionUser)
          throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const visibleItems = isOwnerOrAdmin
        ? playlist.items
        : playlist.items.filter(
            (i) => i.video.status === "LIVE" && i.video.visibility === "PUBLIC",
          );

      return { ...playlist, items: visibleItems };
    }),

  create: protectedProcedure
    .input(
      z.object({
        channelId: z.string().min(1),
        title: z.string().trim().min(1).max(120),
        description: z.string().max(1000).optional(),
        visibility: VisibilityEnum.default("PUBLIC"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const channel = await ctx.prisma.channel.findUnique({
        where: { id: input.channelId },
        select: { ownerId: true },
      });
      if (!channel || channel.ownerId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.prisma.playlist.create({
        data: {
          ownerId: userId,
          channelId: input.channelId,
          title: input.title,
          description: input.description,
          visibility: input.visibility,
          slug: playlistSlug(),
        },
        select: { id: true, slug: true },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(120).optional(),
        description: z.string().max(1000).nullable().optional(),
        visibility: VisibilityEnum.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as { id: string; role?: string };
      await assertOwner(ctx.prisma, input.id, sessionUser.id, sessionUser.role);
      const data: Record<string, unknown> = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.description !== undefined)
        data.description = input.description;
      if (input.visibility !== undefined) data.visibility = input.visibility;
      return ctx.prisma.playlist.update({
        where: { id: input.id },
        data: data as never,
        select: { id: true, slug: true },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as { id: string; role?: string };
      await assertOwner(ctx.prisma, input.id, sessionUser.id, sessionUser.role);
      await ctx.prisma.playlist.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  addItem: protectedProcedure
    .input(
      z.object({
        playlistId: z.string().min(1),
        videoId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as { id: string; role?: string };
      await assertOwner(
        ctx.prisma,
        input.playlistId,
        sessionUser.id,
        sessionUser.role,
      );
      const maxPos = await ctx.prisma.playlistItem.aggregate({
        where: { playlistId: input.playlistId },
        _max: { position: true },
      });
      const position = (maxPos._max.position ?? -1) + 1;
      return ctx.prisma.playlistItem.create({
        data: {
          playlistId: input.playlistId,
          videoId: input.videoId,
          position,
        },
        select: { id: true, position: true },
      });
    }),

  removeItem: protectedProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as { id: string; role?: string };
      const item = await ctx.prisma.playlistItem.findUnique({
        where: { id: input.itemId },
        select: { playlistId: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertOwner(
        ctx.prisma,
        item.playlistId,
        sessionUser.id,
        sessionUser.role,
      );
      await ctx.prisma.playlistItem.delete({ where: { id: input.itemId } });
      return { ok: true };
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        playlistId: z.string().min(1),
        itemIds: z.array(z.string().min(1)).min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as { id: string; role?: string };
      await assertOwner(
        ctx.prisma,
        input.playlistId,
        sessionUser.id,
        sessionUser.role,
      );
      await ctx.prisma.$transaction(
        input.itemIds.map((id, idx) =>
          ctx.prisma.playlistItem.update({
            where: { id },
            data: { position: idx },
          }),
        ),
      );
      return { ok: true };
    }),
});
