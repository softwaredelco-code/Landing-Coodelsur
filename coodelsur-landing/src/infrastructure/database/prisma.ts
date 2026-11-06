/**
 * Cliente Prisma singleton para Next.js.
 *
 * Optimizado para entornos CloudLinux / cPanel con límite estricto de procesos (NPROC)
 * y memoria (PMEM), evitando que Prisma abra decenas de conexiones o quede colgado
 * indefinidamente esperando al pooler de Supabase.
 *
 * @see prisma/schema.prisma — modelo `Lead`
 * @see docs/BACKEND_SETUP.md — `DATABASE_URL` (pooler :6543) y `DIRECT_URL`
 */
import { PrismaClient } from "@prisma/client";
import type { RolUsuario } from "@/domain/usuario/usuario";

if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = "2";
}

export interface UsuarioDb {
  id: string;
  usuario: string;
  nombre: string;
  passwordHash: string;
  rol: RolUsuario;
  activo: boolean;
  ultimoAcceso: Date | null;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

export interface UsuarioDelegate {
  count(args?: any): Promise<number>;
  findUnique(args: any): Promise<UsuarioDb | null>;
  findFirst(args?: any): Promise<UsuarioDb | null>;
  findMany(args?: any): Promise<UsuarioDb[]>;
  create(args: any): Promise<UsuarioDb>;
  update(args: any): Promise<UsuarioDb>;
  delete(args: any): Promise<UsuarioDb>;
}

export type AppPrismaClient = PrismaClient & {
  usuario: UsuarioDelegate;
};

/**
 * Ajusta DATABASE_URL con límites conservadores de pool y timeouts cortos
 * para evitar que un servidor compartido de 16-32 núcleos intente abrir
 * 33-65 conexiones por proceso o deje peticiones colgadas por minutos.
 */
function buildBoundedDatabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "5");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "10");
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "10");
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined;
};

const boundedDbUrl = buildBoundedDatabaseUrl(process.env.DATABASE_URL);

export const prisma: AppPrismaClient =
  (globalForPrisma.prisma ??
    new PrismaClient({
      ...(boundedDbUrl ? { datasources: { db: { url: boundedDbUrl } } } : {}),
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    })) as AppPrismaClient;

globalForPrisma.prisma = prisma;
