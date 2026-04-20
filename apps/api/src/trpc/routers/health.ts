import { router, publicProcedure } from "../init";

export const healthRouter = router({
  ping: publicProcedure.query(() => ({
    ok: true,
    ts: new Date().toISOString(),
  })),
  db: publicProcedure.query(async ({ ctx }) => {
    const result = await ctx.prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() as now`;
    return { ok: true, dbTime: result[0]?.now ?? null };
  }),
});
