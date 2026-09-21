/**
 * Persistencia y cache de parámetros de amortización (tasas, fianza, plazos).
 * Los valores editables viven en BD; los defaults en `config/creditos/amortizacion.ts`.
 */

import {
  DEFAULT_AMORTIZACION_POR_TIPO,
  getDefaultParametrosAmortizacion,
  type EstudioCreditoConfig,
  type ParametrosAmortizacion,
} from "@/shared/config/creditos/amortizacion";
import {
  applyRuntimeParametrosCache,
  setRuntimeParametrosOverrides,
} from "@/application/credito/parametros-runtime";
import { prisma } from "@/infrastructure/database/prisma";
import type { TipoCredito } from "@/shared/types/credito";
import { z } from "zod";

export const PRODUCTOS_PARAMETRIZABLES = [
  { tipo: "microcredito_small" as const, nombre: "Microcrédito Small", disponible: true },
  { tipo: "microcredito_urbano" as const, nombre: "Microcrédito urbano", disponible: false },
  { tipo: "microcredito_rural" as const, nombre: "Microcrédito rural", disponible: false },
] as const;

export type ProductoParametrizable = (typeof PRODUCTOS_PARAMETRIZABLES)[number]["tipo"];

export interface CreditoParametrosRecord {
  tipoCredito: ProductoParametrizable;
  nombreVisible: string;
  tasaMensual: number;
  estudioCreditoModo: "fijo" | "porcentaje";
  estudioCreditoValor: number;
  fianzaMensualPorcentaje: number;
  vidaDeudoresPorcentaje: number;
  plazosPermitidos: number[];
  activo: boolean;
  fechaActualizacion: string;
}

export const parametrosUpdateSchema = z.object({
  tasaMensualPorcentaje: z
    .number({ invalid_type_error: "Ingresa la tasa mensual" })
    .min(0, "No puede ser negativa")
    .max(100, "Máximo 100%"),
  estudioCreditoModo: z.enum(["fijo", "porcentaje"]),
  estudioCreditoValor: z
    .number({ invalid_type_error: "Ingresa el valor del estudio de crédito" })
    .min(0, "No puede ser negativo"),
  fianzaMensualPorcentaje: z
    .number({ invalid_type_error: "Ingresa el porcentaje de fianza" })
    .min(0)
    .max(100),
  vidaDeudoresPorcentaje: z
    .number({ invalid_type_error: "Ingresa el porcentaje de vida deudores" })
    .min(0)
    .max(100),
  plazosPermitidos: z
    .array(z.number().int().positive())
    .min(1, "Selecciona al menos un plazo en cuotas"),
});

export type ParametrosUpdateInput = z.infer<typeof parametrosUpdateSchema>;

type ParametrosDbRow = {
  tipoCredito: string;
  nombreVisible: string;
  tasaMensual: number;
  estudioCreditoModo: string;
  estudioCreditoValor: number;
  fianzaMensualPorcentaje: number;
  vidaDeudoresPorcentaje: number;
  plazosPermitidos: number[];
  activo: boolean;
  fechaActualizacion: Date;
};

let serverCache: Map<TipoCredito, ParametrosAmortizacion> | null = null;
let cachedDbRows: ParametrosDbRow[] | null = null;
let seedAttempted = false;

function buildCacheFromDefaults(): Map<TipoCredito, ParametrosAmortizacion> {
  const map = new Map<TipoCredito, ParametrosAmortizacion>();
  for (const producto of PRODUCTOS_PARAMETRIZABLES) {
    map.set(producto.tipo, getDefaultParametrosAmortizacion(producto.tipo));
  }
  return map;
}

function toEstudioConfig(
  modo: "fijo" | "porcentaje",
  valor: number,
): EstudioCreditoConfig {
  if (modo === "fijo") return { modo: "fijo", valor: Math.round(valor) };
  return { modo: "porcentaje", porcentaje: valor / 100 };
}

function rowToParametros(row: {
  tipoCredito: string;
  tasaMensual: number;
  estudioCreditoModo: string;
  estudioCreditoValor: number;
  fianzaMensualPorcentaje: number;
  vidaDeudoresPorcentaje: number;
  plazosPermitidos: number[];
}): ParametrosAmortizacion {
  const estudioModo = row.estudioCreditoModo === "porcentaje" ? "porcentaje" : "fijo";
  const estudioValor =
    estudioModo === "porcentaje" ? row.estudioCreditoValor : Math.round(row.estudioCreditoValor);

  return {
    tasaMensual: row.tasaMensual,
    estudioCredito:
      estudioModo === "porcentaje"
        ? { modo: "porcentaje", porcentaje: estudioValor / 100 }
        : { modo: "fijo", valor: estudioValor },
    fianzaMensualPorcentaje: row.fianzaMensualPorcentaje,
    vidaDeudoresPorcentaje: row.vidaDeudoresPorcentaje,
    plazosPermitidos: [...row.plazosPermitidos].sort((a, b) => a - b),
  };
}

function parametrosToRecord(
  tipo: ProductoParametrizable,
  params: ParametrosAmortizacion,
  nombreVisible: string,
  fechaActualizacion: Date,
  activo: boolean,
): CreditoParametrosRecord {
  const estudio =
    params.estudioCredito.modo === "fijo"
      ? { modo: "fijo" as const, valor: params.estudioCredito.valor }
      : {
          modo: "porcentaje" as const,
          valor: params.estudioCredito.porcentaje * 100,
        };

  return {
    tipoCredito: tipo,
    nombreVisible,
    tasaMensual: params.tasaMensual,
    estudioCreditoModo: estudio.modo,
    estudioCreditoValor: estudio.valor,
    fianzaMensualPorcentaje: params.fianzaMensualPorcentaje,
    vidaDeudoresPorcentaje: params.vidaDeudoresPorcentaje,
    plazosPermitidos: [...params.plazosPermitidos],
    activo,
    fechaActualizacion: fechaActualizacion.toISOString(),
  };
}

function defaultRecord(tipo: ProductoParametrizable): CreditoParametrosRecord {
  const meta = PRODUCTOS_PARAMETRIZABLES.find((item) => item.tipo === tipo)!;
  const params = getDefaultParametrosAmortizacion(tipo);
  return parametrosToRecord(tipo, params, meta.nombre, new Date(), true);
}

function applyCache(map: Map<TipoCredito, ParametrosAmortizacion>) {
  serverCache = map;
  applyRuntimeParametrosCache(map);
}

export { setRuntimeParametrosOverrides as setClientParametrosOverrides };

export function invalidateParametrosCache() {
  serverCache = null;
  cachedDbRows = null;
}

/** Inserta defaults solo si la tabla está vacía (una vez por instancia). */
async function seedParametrosIfEmpty(): Promise<void> {
  if (seedAttempted) return;
  seedAttempted = true;

  try {
    const existing = await prisma.creditoParametros.findFirst({
      select: { tipoCredito: true },
    });
    if (existing) return;

    for (const producto of PRODUCTOS_PARAMETRIZABLES) {
      const defaults = getDefaultParametrosAmortizacion(producto.tipo);
      const estudio = defaults.estudioCredito;
      const estudioModo = estudio.modo;
      const estudioValor =
        estudio.modo === "fijo" ? estudio.valor : estudio.porcentaje * 100;

      await prisma.creditoParametros.create({
        data: {
          tipoCredito: producto.tipo,
          nombreVisible: producto.nombre,
          tasaMensual: defaults.tasaMensual,
          estudioCreditoModo: estudioModo,
          estudioCreditoValor: estudioValor,
          fianzaMensualPorcentaje: defaults.fianzaMensualPorcentaje,
          vidaDeudoresPorcentaje: defaults.vidaDeudoresPorcentaje,
          plazosPermitidos: [...defaults.plazosPermitidos],
          activo: true,
        },
      });
    }
  } catch (error) {
    seedAttempted = false;
    throw error;
  }
}

function buildCacheFromRows(rows: ParametrosDbRow[]): Map<TipoCredito, ParametrosAmortizacion> {
  const map = new Map<TipoCredito, ParametrosAmortizacion>();
  for (const row of rows) {
    if (!row.activo) continue;
    map.set(row.tipoCredito as TipoCredito, rowToParametros(row));
  }
  for (const producto of PRODUCTOS_PARAMETRIZABLES) {
    if (!map.has(producto.tipo)) {
      map.set(producto.tipo, getDefaultParametrosAmortizacion(producto.tipo));
    }
  }
  return map;
}

/** @deprecated Usar warmParametrosCache; seed solo si la tabla está vacía. */
export async function ensureParametrosSeeded(): Promise<void> {
  await seedParametrosIfEmpty();
}

export async function warmParametrosCache(): Promise<Map<TipoCredito, ParametrosAmortizacion>> {
  if (serverCache) return serverCache;

  try {
    await seedParametrosIfEmpty();
    const rows = await prisma.creditoParametros.findMany({
      orderBy: { tipoCredito: "asc" },
    });

    cachedDbRows = rows;
    const map = buildCacheFromRows(rows);
    applyCache(map);
    return map;
  } catch (error) {
    console.warn(
      "[parametros-store] No se pudo leer parámetros desde BD; usando defaults del código.",
      error instanceof Error ? error.message : error,
    );
    const map = buildCacheFromDefaults();
    applyCache(map);
    return map;
  }
}

export async function listCreditoParametrosRecords(): Promise<CreditoParametrosRecord[]> {
  await warmParametrosCache();
  const rows = cachedDbRows ?? [];

  if (rows.length === 0) {
    return PRODUCTOS_PARAMETRIZABLES.map((producto) => defaultRecord(producto.tipo));
  }

  return rows.map((row) =>
    parametrosToRecord(
      row.tipoCredito as ProductoParametrizable,
      rowToParametros(row),
      row.nombreVisible,
      row.fechaActualizacion,
      row.activo,
    ),
  );
}

export async function getPublicParametrosMap(): Promise<
  Partial<Record<TipoCredito, ParametrosAmortizacion>>
> {
  const cache = await warmParametrosCache();
  return Object.fromEntries(cache.entries()) as Partial<Record<TipoCredito, ParametrosAmortizacion>>;
}

export async function updateCreditoParametros(
  tipo: ProductoParametrizable,
  input: ParametrosUpdateInput,
): Promise<CreditoParametrosRecord> {
  const meta = PRODUCTOS_PARAMETRIZABLES.find((item) => item.tipo === tipo);
  if (!meta) {
    throw new Error("Producto no parametrizable");
  }

  const plazos = Array.from(new Set(input.plazosPermitidos)).sort((a, b) => a - b);
  const params: ParametrosAmortizacion = {
    tasaMensual: input.tasaMensualPorcentaje / 100,
    estudioCredito: toEstudioConfig(input.estudioCreditoModo, input.estudioCreditoValor),
    fianzaMensualPorcentaje: input.fianzaMensualPorcentaje / 100,
    vidaDeudoresPorcentaje: input.vidaDeudoresPorcentaje / 100,
    plazosPermitidos: plazos,
  };

  const estudioValor =
    input.estudioCreditoModo === "fijo"
      ? Math.round(input.estudioCreditoValor)
      : input.estudioCreditoValor;

  const row = await prisma.creditoParametros.upsert({
    where: { tipoCredito: tipo },
    create: {
      tipoCredito: tipo,
      nombreVisible: meta.nombre,
      tasaMensual: params.tasaMensual,
      estudioCreditoModo: input.estudioCreditoModo,
      estudioCreditoValor: estudioValor,
      fianzaMensualPorcentaje: params.fianzaMensualPorcentaje,
      vidaDeudoresPorcentaje: params.vidaDeudoresPorcentaje,
      plazosPermitidos: plazos,
      activo: true,
    },
    update: {
      tasaMensual: params.tasaMensual,
      estudioCreditoModo: input.estudioCreditoModo,
      estudioCreditoValor: estudioValor,
      fianzaMensualPorcentaje: params.fianzaMensualPorcentaje,
      vidaDeudoresPorcentaje: params.vidaDeudoresPorcentaje,
      plazosPermitidos: plazos,
      activo: true,
    },
  });

  invalidateParametrosCache();
  await warmParametrosCache();

  return parametrosToRecord(
    tipo,
    rowToParametros(row),
    row.nombreVisible,
    row.fechaActualizacion,
    row.activo,
  );
}

/** Restaura los valores por defecto del código para un producto. */
export async function resetCreditoParametros(
  tipo: ProductoParametrizable,
): Promise<CreditoParametrosRecord> {
  const defaults = DEFAULT_AMORTIZACION_POR_TIPO[tipo] ?? getDefaultParametrosAmortizacion(tipo);
  const estudio = defaults.estudioCredito;
  const input: ParametrosUpdateInput = {
    tasaMensualPorcentaje: defaults.tasaMensual * 100,
    estudioCreditoModo: estudio.modo,
    estudioCreditoValor:
      estudio.modo === "fijo" ? estudio.valor : estudio.porcentaje * 100,
    fianzaMensualPorcentaje: defaults.fianzaMensualPorcentaje * 100,
    vidaDeudoresPorcentaje: defaults.vidaDeudoresPorcentaje * 100,
    plazosPermitidos: [...defaults.plazosPermitidos],
  };
  return updateCreditoParametros(tipo, input);
}
