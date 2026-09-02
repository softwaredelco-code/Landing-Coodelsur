/**
 * Cliente Prisma singleton para Next.js.
 *
 * Reutiliza la misma instancia en desarrollo (hot reload) y crea una nueva
 * en producción. Logs: error/warn en dev, solo error en prod.
 *
 * @see prisma/schema.prisma — modelo `Lead`
 * @see docs/BACKEND_SETUP.md — `DATABASE_URL` (pooler :6543) y `DIRECT_URL`
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
