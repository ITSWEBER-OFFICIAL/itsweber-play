// User-Settings (Account + Notifs + Datenschutz). Password-Change läuft
// separat über Better-Auth's /api/auth/change-password — dieser Router
// kümmert sich nur um Plattform-spezifische Felder.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";

interface NotificationPrefs {
  emailOnComment: boolean;
  emailOnSubscriber: boolean;
  digestDaily: boolean;
  autoCaptions: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailOnComment: false,
  emailOnSubscriber: false,
  digestDaily: false,
  autoCaptions: true,
};

function coercePrefs(raw: unknown): NotificationPrefs {
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<NotificationPrefs>;
    return {
      emailOnComment: Boolean(obj.emailOnComment),
      emailOnSubscriber: Boolean(obj.emailOnSubscriber),
      digestDaily: Boolean(obj.digestDaily),
      autoCaptions: obj.autoCaptions !== false,
    };
  }
  return { ...DEFAULT_PREFS };
}

export const userSettingsRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session.user as { id: string }).id;
    const user = await ctx.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        handle: true,
        avatarUrl: true,
        notificationPrefs: true,
        dmPermission: true,
        createdAt: true,
      },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      ...user,
      notificationPrefs: coercePrefs(user.notificationPrefs),
    };
  }),

  updateDisplayName: protectedProcedure
    .input(z.object({ displayName: z.string().trim().min(2).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      await ctx.prisma.user.update({
        where: { id: userId },
        data: { displayName: input.displayName },
      });
      return { ok: true };
    }),

  updateNotificationPrefs: protectedProcedure
    .input(
      z.object({
        emailOnComment: z.boolean().optional(),
        emailOnSubscriber: z.boolean().optional(),
        digestDaily: z.boolean().optional(),
        autoCaptions: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const current = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPrefs: true },
      });
      const prefs = coercePrefs(current?.notificationPrefs);
      if (input.emailOnComment !== undefined)
        prefs.emailOnComment = input.emailOnComment;
      if (input.emailOnSubscriber !== undefined)
        prefs.emailOnSubscriber = input.emailOnSubscriber;
      if (input.digestDaily !== undefined) prefs.digestDaily = input.digestDaily;
      if (input.autoCaptions !== undefined) prefs.autoCaptions = input.autoCaptions;
      await ctx.prisma.user.update({
        where: { id: userId },
        data: { notificationPrefs: prefs as never },
      });
      return { ok: true, prefs };
    }),

  updateDmPermission: protectedProcedure
    .input(z.object({ dmPermission: z.enum(["ALL", "SUBSCRIBERS_ONLY", "NONE"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      await ctx.prisma.user.update({
        where: { id: userId },
        data: { dmPermission: input.dmPermission },
      });
      return { ok: true, dmPermission: input.dmPermission };
    }),

  // Vollständiger Daten-Export im DSGVO-Sinn — User + eigene Kanäle + Videos
  // + Kommentare. Client rendert das als Blob-Download.
  exportMyData: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session.user as { id: string }).id;
    const [user, channels, videos, comments, subscriptions] = await Promise.all(
      [
        ctx.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            displayName: true,
            handle: true,
            role: true,
            createdAt: true,
            notificationPrefs: true,
          },
        }),
        ctx.prisma.channel.findMany({ where: { ownerId: userId } }),
        ctx.prisma.video.findMany({ where: { ownerId: userId } }),
        ctx.prisma.comment.findMany({ where: { userId } }),
        ctx.prisma.subscription.findMany({
          where: { subscriberId: userId },
          include: {
            channel: { select: { slug: true, displayName: true, avatarUrl: true } },
          },
        }),
      ],
    );
    return {
      exportedAt: new Date().toISOString(),
      user,
      channels,
      videos,
      comments,
      subscriptions,
    };
  }),

  // Soft-Delete: Ban setzen, E-Mail anonymisieren, Videos auf PRIVATE.
  // Harte Löschung würde Comments/Reactions mit cascaden — das zerstört
  // Community-Kontext. Stattdessen bleibt der User als „[gelöscht]" stehen.
  requestAccountDeletion: protectedProcedure
    .input(z.object({ confirmHandle: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { handle: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      if (user.handle !== input.confirmHandle) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "HANDLE_MISMATCH",
        });
      }
      await ctx.prisma.$transaction([
        ctx.prisma.user.update({
          where: { id: userId },
          data: {
            banned: true,
            email: `deleted-${userId}@anon.local`,
            displayName: "[gelöscht]",
          },
        }),
        ctx.prisma.video.updateMany({
          where: { ownerId: userId },
          data: { visibility: "PRIVATE" },
        }),
        ctx.prisma.session.deleteMany({ where: { userId } }),
      ]);
      return { ok: true };
    }),
});
