import { PrismaClient } from "@prisma/client";

// Re-use a single PrismaClient across hot reloads in dev (Next.js HMR spawns
// many module instances; without this we'd exhaust the connection pool).
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["warn", "error"]
        : ["query", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
