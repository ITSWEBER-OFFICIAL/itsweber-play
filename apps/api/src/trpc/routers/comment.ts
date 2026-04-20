// Video-Kommentare mit Threaded-Replies (parentId). Respektiert pro-Video
// `commentsEnabled` und berücksichtigt soft-delete (deletedAt).

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { moderateCommentQueue } from "@play/worker/queue";
import { router, publicProcedure, protectedProcedure } from "../init";

export const commentRouter = router({
  // Flat list + Replies. Vereinfacht gegen 2-level-Nesting: Top-Level + direkte
  // Replies. Pinned-Kommentare erscheinen ganz oben (sortiert nach pinnedAt desc),
  // danach der Rest nach createdAt desc.
  list: publicProcedure
    .input(
      z.object({
        videoId: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.comment.findMany({
        where: {
          videoId: input.videoId,
          deletedAt: null,
        },
        orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
        take: input.limit,
        select: {
          id: true,
          body: true,
          parentId: true,
          createdAt: true,
          pinnedAt: true,
          heartedByCreator: true,
          user: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              role: true,
            },
          },
        },
      });
      return rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        pinnedAt: r.pinnedAt ? r.pinnedAt.toISOString() : null,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        videoId: z.string().min(1),
        body: z.string().trim().min(1).max(4000),
        parentId: z.string().min(1).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const video = await ctx.prisma.video.findUnique({
        where: { id: input.videoId },
        select: {
          id: true,
          commentsEnabled: true,
          ownerId: true,
          title: true,
        },
      });
      if (!video) throw new TRPCError({ code: "NOT_FOUND" });
      if (!video.commentsEnabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kommentare sind für dieses Video deaktiviert.",
        });
      }

      const userId = (ctx.session.user as { id: string }).id;

      if (input.parentId) {
        const parent = await ctx.prisma.comment.findUnique({
          where: { id: input.parentId },
          select: { id: true, videoId: true, userId: true },
        });
        if (!parent || parent.videoId !== input.videoId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ungültige parentId.",
          });
        }
        // Benachrichtige den Parent-User, wenn es jemand anderes war.
        if (parent.userId !== userId) {
          await ctx.prisma.notification.create({
            data: {
              userId: parent.userId,
              type: "COMMENT_REPLY",
              title: "Neue Antwort auf deinen Kommentar",
              body: input.body.slice(0, 140),
              link: `/watch/${video.id}#c-${parent.id}`,
            },
          });
        }
      }

      const row = await ctx.prisma.comment.create({
        data: {
          videoId: input.videoId,
          userId,
          body: input.body,
          parentId: input.parentId ?? null,
        },
        select: {
          id: true,
          body: true,
          parentId: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              role: true,
            },
          },
        },
      });

      // AI-Moderation gated via OLLAMA_URL (Worker no-op'd ohne Env).
      if (process.env.OLLAMA_URL) {
        await moderateCommentQueue
          .add("moderate", { commentId: row.id })
          .catch(() => null);
      }

      return { ...row, createdAt: row.createdAt.toISOString() };
    }),

  // Soft-delete (deletedAt gesetzt). Owner-Kommentator oder Admin oder Video-Owner
  // (Creator moderiert eigene Kommentarspalte).
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findUnique({
        where: { id: input.id },
        select: { userId: true, video: { select: { ownerId: true } } },
      });
      if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
      const user = ctx.session.user as { id: string; role?: string };
      const allowed =
        comment.userId === user.id ||
        comment.video.ownerId === user.id ||
        user.role === "ADMIN";
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.prisma.comment.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
      return { ok: true as const };
    }),

  // Creator (Video-Owner) oder Admin kann einen Kommentar pinnen. Gleichzeitig
  // wird jeder andere gepinnte Kommentar desselben Videos entfernt (max. 1 Pin).
  pin: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        pinned: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          videoId: true,
          video: { select: { ownerId: true } },
        },
      });
      if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
      const user = ctx.session.user as { id: string; role?: string };
      const allowed =
        comment.video.ownerId === user.id || user.role === "ADMIN";
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });

      if (input.pinned) {
        await ctx.prisma.$transaction([
          ctx.prisma.comment.updateMany({
            where: { videoId: comment.videoId, pinnedAt: { not: null } },
            data: { pinnedAt: null },
          }),
          ctx.prisma.comment.update({
            where: { id: input.id },
            data: { pinnedAt: new Date() },
          }),
        ]);
      } else {
        await ctx.prisma.comment.update({
          where: { id: input.id },
          data: { pinnedAt: null },
        });
      }
      return { ok: true as const, pinned: input.pinned };
    }),

  // Creator-Heart (TikTok-Style). Video-Owner kann eigenen Fan-Kommentar
  // auszeichnen; Admin darf auch.
  heart: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        hearted: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findUnique({
        where: { id: input.id },
        select: { id: true, video: { select: { ownerId: true } } },
      });
      if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
      const user = ctx.session.user as { id: string; role?: string };
      const allowed =
        comment.video.ownerId === user.id || user.role === "ADMIN";
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.prisma.comment.update({
        where: { id: input.id },
        data: { heartedByCreator: input.hearted },
      });
      return { ok: true as const, hearted: input.hearted };
    }),

  // Creator sieht Kommentare zu allen eigenen Videos (Studio-Panel).
  mineFeed: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(200).default(100) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const rows = await ctx.prisma.comment.findMany({
        where: { video: { ownerId: userId }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 100,
        select: {
          id: true,
          body: true,
          createdAt: true,
          user: { select: { handle: true, displayName: true } },
          video: { select: { id: true, slug: true, title: true } },
        },
      });
      return rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      }));
    }),
});
