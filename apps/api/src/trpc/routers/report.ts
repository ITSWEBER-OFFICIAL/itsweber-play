// Report-Flow. Jeder eingeloggte User kann melden; Admins bearbeiten
// in der Moderation-Queue. `create` ist bewusst rate-limit-frei im MVP —
// Abuse-Protection kommt zusammen mit SEO + Rate-Limits.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../init";

const REASONS = [
  "spam",
  "abuse",
  "copyright",
  "nudity",
  "violence",
  "dangerous",
  "other",
] as const;

export const reportRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["VIDEO", "COMMENT", "CHANNEL"]),
        videoId: z.string().min(1).nullable().optional(),
        commentId: z.string().min(1).nullable().optional(),
        channelId: z.string().min(1).nullable().optional(),
        reason: z.enum(REASONS),
        note: z.string().max(1000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Konsistenz-Check: das gemeldete Target muss zum targetType passen.
      const targetId =
        input.targetType === "VIDEO"
          ? input.videoId
          : input.targetType === "COMMENT"
            ? input.commentId
            : input.channelId;
      if (!targetId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ziel-ID für den gemeldeten Typ fehlt.",
        });
      }
      const reporterId = (ctx.session.user as { id: string }).id;
      const row = await ctx.prisma.report.create({
        data: {
          targetType: input.targetType,
          videoId: input.videoId ?? null,
          commentId: input.commentId ?? null,
          channelId: input.channelId ?? null,
          reason: input.reason,
          note: input.note ?? null,
          reporterId,
        },
      });
      return { id: row.id };
    }),

  list: adminProcedure
    .input(
      z
        .object({
          status: z
            .enum(["ALL", "OPEN", "RESOLVED_TAKEDOWN", "RESOLVED_IGNORED"])
            .default("OPEN"),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where =
        input?.status && input.status !== "ALL"
          ? { status: input.status }
          : {};
      const rows = await ctx.prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
        select: {
          id: true,
          targetType: true,
          videoId: true,
          commentId: true,
          channelId: true,
          reason: true,
          note: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          reporter: {
            select: { handle: true, displayName: true, email: true },
          },
          resolvedBy: {
            select: { handle: true, displayName: true },
          },
        },
      });
      return rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      }));
    }),

  resolve: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        action: z.enum(["TAKEDOWN", "IGNORE"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.prisma.report.findUnique({
        where: { id: input.id },
      });
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      const adminId = (ctx.session.user as { id: string }).id;

      // Bei TAKEDOWN: Target auf PRIVATE stellen (Video) bzw. soft-delete
      // (Comment) bzw. Channel-Ban-Dummy (später als Schema-Erweiterung).
      if (input.action === "TAKEDOWN") {
        if (report.targetType === "VIDEO" && report.videoId) {
          await ctx.prisma.video.update({
            where: { id: report.videoId },
            data: { visibility: "PRIVATE" },
          });
        }
        if (report.targetType === "COMMENT" && report.commentId) {
          await ctx.prisma.comment.update({
            where: { id: report.commentId },
            data: { deletedAt: new Date() },
          });
        }
      }

      await ctx.prisma.report.update({
        where: { id: input.id },
        data: {
          status:
            input.action === "TAKEDOWN"
              ? "RESOLVED_TAKEDOWN"
              : "RESOLVED_IGNORED",
          resolvedById: adminId,
          resolvedAt: new Date(),
        },
      });
      return { ok: true as const };
    }),

  // Count der offenen Reports — für das Badge im Admin-Sidebar.
  openCount: adminProcedure.query(({ ctx }) =>
    ctx.prisma.report.count({ where: { status: "OPEN" } }),
  ),
});
