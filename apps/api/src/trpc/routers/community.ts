// Community-Posts: Text-/Bild-/Poll-Beiträge eines Creators.
// Nur der Kanal-Owner (oder Admin) darf posten; jeder eingeloggte User kann
// in Polls abstimmen. MVP ohne Moderation — Reports laufen über Report-Router.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../init";

const PollOptionSchema = z.object({
  label: z.string().trim().min(1).max(120),
});
const PollSchema = z
  .array(PollOptionSchema)
  .min(2)
  .max(4)
  .optional();

type PollOption = z.infer<typeof PollOptionSchema>;

function extractPollOptions(value: unknown): PollOption[] | null {
  if (!value) return null;
  if (!Array.isArray(value)) return null;
  const out: PollOption[] = [];
  for (const v of value) {
    if (v && typeof v === "object" && "label" in v) {
      const label = String((v as { label: unknown }).label ?? "").slice(0, 120);
      if (label) out.push({ label });
    }
  }
  return out.length ? out : null;
}

export const communityRouter = router({
  // Öffentliche Liste eines Kanals (neueste zuerst). Mit Poll-Stand falls User
  // eingeloggt — eigene Stimme wird markiert, Vote-Counts per Option berechnet.
  list: publicProcedure
    .input(
      z.object({
        channelSlug: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const channel = await ctx.prisma.channel.findUnique({
        where: { slug: input.channelSlug },
        select: { id: true },
      });
      if (!channel) return [];
      const viewerId = ctx.session
        ? (ctx.session.user as { id: string }).id
        : null;

      const posts = await ctx.prisma.communityPost.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          body: true,
          imageKey: true,
          pollOptions: true,
          createdAt: true,
          author: {
            select: { id: true, handle: true, displayName: true, avatarUrl: true },
          },
          votes: {
            select: { userId: true, optionIdx: true },
          },
        },
      });

      return posts.map((p) => {
        const options = extractPollOptions(p.pollOptions);
        let poll: {
          options: { label: string; votes: number }[];
          myVote: number | null;
          totalVotes: number;
        } | null = null;
        if (options) {
          const counts = new Array(options.length).fill(0) as number[];
          let myVote: number | null = null;
          for (const v of p.votes) {
            const current = counts[v.optionIdx];
            if (current !== undefined) counts[v.optionIdx] = current + 1;
            if (viewerId && v.userId === viewerId) myVote = v.optionIdx;
          }
          poll = {
            options: options.map((o, i) => ({ label: o.label, votes: counts[i] ?? 0 })),
            myVote,
            totalVotes: p.votes.length,
          };
        }
        return {
          id: p.id,
          body: p.body,
          imageKey: p.imageKey,
          createdAt: p.createdAt.toISOString(),
          author: p.author,
          poll,
        };
      });
    }),

  // Feed für Startseite (COMMUNITY_ROW): letzte X Posts über alle Channels.
  recent: publicProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(12).default(6) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.communityPost.findMany({
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 6,
        select: {
          id: true,
          body: true,
          imageKey: true,
          createdAt: true,
          channel: { select: { slug: true, displayName: true, avatarUrl: true } },
          author: { select: { handle: true, displayName: true } },
        },
      });
      return rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        channelId: z.string().min(1),
        body: z.string().trim().min(1).max(2000),
        imageKey: z.string().max(200).nullable().optional(),
        pollOptions: PollSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as { id: string; role?: string };
      const channel = await ctx.prisma.channel.findUnique({
        where: { id: input.channelId },
        select: { id: true, ownerId: true },
      });
      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });
      if (channel.ownerId !== user.id && user.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const post = await ctx.prisma.communityPost.create({
        data: {
          channelId: channel.id,
          authorId: user.id,
          body: input.body,
          imageKey: input.imageKey ?? null,
          pollOptions: input.pollOptions ?? undefined,
        },
        select: { id: true, createdAt: true },
      });
      return { id: post.id, createdAt: post.createdAt.toISOString() };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as { id: string; role?: string };
      const post = await ctx.prisma.communityPost.findUnique({
        where: { id: input.id },
        select: { authorId: true, channel: { select: { ownerId: true } } },
      });
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      const allowed =
        post.authorId === user.id ||
        post.channel.ownerId === user.id ||
        user.role === "ADMIN";
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.prisma.communityPost.delete({ where: { id: input.id } });
      return { ok: true as const };
    }),

  // Vote + Toggle. Erneutes Wählen derselben Option entfernt die Stimme.
  vote: protectedProcedure
    .input(
      z.object({
        postId: z.string().min(1),
        optionIdx: z.number().int().min(0).max(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const post = await ctx.prisma.communityPost.findUnique({
        where: { id: input.postId },
        select: { id: true, pollOptions: true },
      });
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      const options = extractPollOptions(post.pollOptions);
      if (!options || !options[input.optionIdx]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Keine Poll-Option." });
      }
      const existing = await ctx.prisma.communityPollVote.findUnique({
        where: { postId_userId: { postId: input.postId, userId } },
      });
      if (existing && existing.optionIdx === input.optionIdx) {
        await ctx.prisma.communityPollVote.delete({
          where: { postId_userId: { postId: input.postId, userId } },
        });
        return { voted: false as const };
      }
      await ctx.prisma.communityPollVote.upsert({
        where: { postId_userId: { postId: input.postId, userId } },
        update: { optionIdx: input.optionIdx },
        create: { postId: input.postId, userId, optionIdx: input.optionIdx },
      });
      return { voted: true as const, optionIdx: input.optionIdx };
    }),
});
