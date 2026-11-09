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
import type { RolUsuario } from "@/domain/usuario/usuario";

if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = "2";
}

function ensureBoundedDatabaseUrl(): void {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return;
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
    process.env.DATABASE_URL = parsed.toString();
  } catch {
    // Conservar DATABASE_URL original si no es una URL estándar
  }
}

ensureBoundedDatabaseUrl();

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

export interface LeadDelegateFallback {
  count(args?: any): Promise<number>;
  groupBy(args: any): Promise<Array<{ estado: string; _count: { id: number } }>>;
  findUnique(args: any): Promise<any>;
  findFirst(args?: any): Promise<any>;
  findMany(args?: any): Promise<any[]>;
  create(args: any): Promise<any>;
  update(args: any): Promise<any>;
  delete(args: any): Promise<any>;
  deleteMany(args?: any): Promise<{ count: number }>;
}

export interface CreditoParametrosDelegateFallback {
  findUnique(args: any): Promise<any>;
  findMany(args?: any): Promise<any[]>;
  upsert(args: any): Promise<any>;
  deleteMany(args?: any): Promise<{ count: number }>;
}

export type AppPrismaClient = PrismaClient & {
  lead: LeadDelegateFallback;
  creditoParametros: CreditoParametrosDelegateFallback;
  usuario: UsuarioDelegate;
  $queryRaw(strings: TemplateStringsArray, ...values: any[]): Promise<any>;
  $executeRawUnsafe(query: string, ...values: any[]): Promise<any>;
};

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined;
};

const PrismaClientCtor = PrismaClient as unknown as new (options?: {
  log?: Array<"error" | "warn" | "info" | "query">;
}) => AppPrismaClient;

export const prisma: AppPrismaClient =
  globalForPrisma.prisma ??
  new PrismaClientCtor({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
