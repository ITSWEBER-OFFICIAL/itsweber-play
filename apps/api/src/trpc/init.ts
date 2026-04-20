import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Session-Guard. Routen wie video.create, comment.create etc. werden auf
// diese Procedure gehängt. Narrow'd session ist non-null im ctx.
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

// Admin-Guard. User muss eingeloggt UND role=ADMIN sein. Wir lesen role
// aus session.user — Better Auth liefert die additionalFields mit.
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const user = ctx.session.user as { id: string; role?: string };
  if (user.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});
