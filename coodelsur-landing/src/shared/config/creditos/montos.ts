/**
 * Rangos oficiales de monto por producto (Coodelsur).
 *
 * Productos:
 * - Microcrédito Small:  $200.000 – $600.000
 * - Microcrédito urbano: $600.001 – $20.000.000
 * - Crédito Libranza:    $700.000 – $20.000.000
 *
 * Por ahora solo Small tiene formulario publicado.
 */

import type { TipoCredito } from "@/shared/types/credito";

/** Intervalo cerrado [min, max] en pesos colombianos (enteros). */
export interface RangoMonto {
  tipo: TipoCredito;
  nombre: string;
  min: number;
  max: number;
  step: number;
  /** true = formulario listo en la app */
  formularioDisponible: boolean;
}

/**
 * Catálogo oficial.
 * Urbano inicia en 600.001 para que $600.000 quede en Small (“hasta 600.000”).
 */
export const RANGOS_MONTO_CREDITO: readonly RangoMonto[] = [
  {
    tipo: "microcredito_small",
    nombre: "Microcrédito Small",
    min: 200_000,
    max: 600_000,
    step: 50_000,
    formularioDisponible: true,
  },
  {
    tipo: "microcredito_urbano",
    nombre: "Microcrédito urbano",
    min: 600_001,
    max: 20_000_000,
    step: 100_000,
    formularioDisponible: false,
  },

  {
    tipo: "libranza",
    nombre: "Crédito Libranza",
    min: 700_000,
    max: 20_000_000,
    step: 100_000,
    formularioDisponible: true,
  },
] as const;

export const MONTO_SELECTOR_MIN = 200_000;
export const MONTO_SELECTOR_MAX = 20_000_000;
export const MONTO_SELECTOR_STEP = 50_000;
/** Valor inicial dentro de Small (único formulario activo). */
export const MONTO_SELECTOR_DEFAULT = 400_000;

export type ResolucionMonto =
  | {
      ok: true;
      monto: number;
      /** Uno o más productos que cubren el monto. */
      candidatos: RangoMonto[];
      /**
       * Producto elegido automáticamente cuando hay un único candidato.
       * Si hay varios, queda undefined hasta que el usuario elija.
       */
      rango?: RangoMonto;
    }
  | {
      ok: false;
      monto: number;
      motivo: string;
    };

/** Todos los rangos que contienen el monto (puede haber más de uno). */
export function listarCandidatosPorMonto(monto: number): RangoMonto[] {
  return RANGOS_MONTO_CREDITO.filter((r) => monto >= r.min && monto <= r.max);
}

/**
 * Resuelve el/los productos aplicables a un monto.
 * Si hay ambigüedad (p. ej. $2M → rural y urbano), `candidatos.length > 1`
 * y `rango` queda vacío hasta la elección del usuario.
 */
export function resolverTipoPorMonto(monto: number): ResolucionMonto {
  if (!Number.isFinite(monto) || monto <= 0) {
    return {
      ok: false,
      monto,
      motivo: "Ingresa un monto válido en pesos colombianos.",
    };
  }

  const candidatos = listarCandidatosPorMonto(monto);
  if (candidatos.length === 0) {
    return {
      ok: false,
      monto,
      motivo:
        "El monto no coincide con un producto. Small: $200.000–$600.000 · Urbano: desde $600.001 · Libranza: $700.000–$20.000.000.",
    };
  }

  return {
    ok: true,
    monto,
    candidatos,
    rango: candidatos.length === 1 ? candidatos[0] : undefined,
  };
}

/** Confirma una resolución eligiendo uno de los candidatos (ambigüedad). */
export function conRangoElegido(
  resolucion: Extract<ResolucionMonto, { ok: true }>,
  tipo: TipoCredito,
): Extract<ResolucionMonto, { ok: true }> | null {
  const elegido = resolucion.candidatos.find((c) => c.tipo === tipo);
  if (!elegido) return null;
  return { ...resolucion, rango: elegido };
}

export function getRangoPorTipo(tipo: TipoCredito): RangoMonto | undefined {
  return RANGOS_MONTO_CREDITO.find((r) => r.tipo === tipo);
}

export function montoCoincideConTipo(tipo: TipoCredito, monto: number): boolean {
  const rango = getRangoPorTipo(tipo);
  if (!rango) return false;
  return Number.isFinite(monto) && monto >= rango.min && monto <= rango.max;
}

export function descripcionRangosParaUi(): string {
  return RANGOS_MONTO_CREDITO.map(
    (r) =>
      `${r.nombre}: $${r.min.toLocaleString("es-CO")} – $${r.max.toLocaleString("es-CO")}${
        r.formularioDisponible ? "" : " (próximamente)"
      }`,
  ).join(" · ");
}

/**
 * Acerca montos fuera de cualquier rango al borde válido más cercano.
 * (Con la cobertura actual 200k–20M casi no hay huecos.)
 */
export function ajustarMontoAlRangoMasCercano(monto: number): number {
  const resolved = resolverTipoPorMonto(monto);
  if (resolved.ok) return resolved.monto;

  let best = MONTO_SELECTOR_DEFAULT;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const rango of RANGOS_MONTO_CREDITO) {
    for (const edge of [rango.min, rango.max]) {
      const dist = Math.abs(monto - edge);
      if (dist < bestDist) {
        bestDist = dist;
        best = edge;
      }
    }
  }

  return best;
}
