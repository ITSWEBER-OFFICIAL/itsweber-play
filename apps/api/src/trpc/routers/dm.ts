// Direct Messages (1:1). Gated durch Recipient.dmPermission:
// - ALL: jeder eingeloggte User darf schreiben
// - SUBSCRIBERS_ONLY: Sender muss ≥ 1 Kanal des Recipients abonniert haben
// - NONE: niemand (außer Admin)

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma as prismaSingleton } from "@play/db";
import { router, protectedProcedure } from "../init";

type Prisma = typeof prismaSingleton;

async function canSendTo(
  prisma: Prisma,
  senderId: string,
  recipientId: string,
  senderRole: string | undefined,
) {
  if (senderId === recipientId) return false;
  if (senderRole === "ADMIN") return true;
  const rec = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { dmPermission: true, banned: true },
  });
  if (!rec || rec.banned) return false;
  if (rec.dmPermission === "NONE") return false;
  if (rec.dmPermission === "ALL") return true;
  const sub = await prisma.subscription.findFirst({
    where: { subscriberId: senderId, channel: { ownerId: recipientId } },
    select: { subscriberId: true },
  });
  return Boolean(sub);
}

export const dmRouter = router({
  // Alle Threads des eingeloggten Nutzers (je Gegenüber ein Eintrag, mit last
  // message + unread-count).
  listThreads: protectedProcedure.query(async ({ ctx }) => {
    const me = (ctx.session.user as { id: string }).id;
    const rows = await ctx.prisma.directMessage.findMany({
      where: { OR: [{ senderId: me }, { recipientId: me }] },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        body: true,
        createdAt: true,
        readAt: true,
        senderId: true,
        recipientId: true,
      },
    });
    const threads = new Map<
      string,
      { peerId: string; lastBody: string; lastAt: string; unread: number }
    >();
    for (const m of rows) {
      const peerId = m.senderId === me ? m.recipientId : m.senderId;
      const entry = threads.get(peerId);
      const isIncomingUnread = m.recipientId === me && !m.readAt;
      if (!entry) {
        threads.set(peerId, {
          peerId,
          lastBody: m.body,
          lastAt: m.createdAt.toISOString(),
          unread: isIncomingUnread ? 1 : 0,
        });
      } else if (isIncomingUnread) {
        entry.unread++;
      }
    }
    const peerIds = [...threads.keys()];
    if (peerIds.length === 0) return [];
    const users = await ctx.prisma.user.findMany({
      where: { id: { in: peerIds } },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return [...threads.values()]
      .map((t) => ({
        ...t,
        peer: userMap.get(t.peerId) ?? null,
      }))
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }),

  listMessages: protectedProcedure
    .input(
      z.object({
        peerId: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(80),
      }),
    )
    .query(async ({ ctx, input }) => {
      const me = (ctx.session.user as { id: string }).id;
      const rows = await ctx.prisma.directMessage.findMany({
        where: {
          OR: [
            { senderId: me, recipientId: input.peerId },
            { senderId: input.peerId, recipientId: me },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          senderId: true,
          recipientId: true,
          body: true,
          readAt: true,
          createdAt: true,
        },
      });
      return rows.reverse().map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        readAt: r.readAt ? r.readAt.toISOString() : null,
      }));
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const me = (ctx.session.user as { id: string }).id;
    return ctx.prisma.directMessage.count({
      where: { recipientId: me, readAt: null },
    });
  }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().min(1),
        body: z.string().trim().min(1).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sender = ctx.session.user as { id: string; role?: string };
      const ok = await canSendTo(
        ctx.prisma,
        sender.id,
        input.recipientId,
        sender.role,
      );
      if (!ok) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Empfänger akzeptiert keine Nachrichten von dir.",
        });
      }
      const msg = await ctx.prisma.directMessage.create({
        data: {
          senderId: sender.id,
          recipientId: input.recipientId,
          body: input.body,
        },
        select: { id: true, createdAt: true },
      });
      return { id: msg.id, createdAt: msg.createdAt.toISOString() };
    }),

  markRead: protectedProcedure
    .input(z.object({ peerId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const me = (ctx.session.user as { id: string }).id;
      const res = await ctx.prisma.directMessage.updateMany({
        where: {
          recipientId: me,
          senderId: input.peerId,
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      return { marked: res.count };
    }),
});
