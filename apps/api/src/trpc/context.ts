import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { prisma } from "@play/db";
import { auth } from "../auth";

// Session wird einmalig pro Request aus den Cookies aufgelöst. Downstream-
// Procedures lesen ausschließlich ctx.session — kein erneuter Auth-Lookup.
export async function createContext({ req }: CreateFastifyContextOptions) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (value !== undefined) {
      headers.append(key, String(value));
    }
  }

  const session = await auth.api.getSession({ headers });
  return { prisma, session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
