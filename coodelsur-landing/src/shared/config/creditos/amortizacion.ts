import type { TipoCredito } from "@/shared/types/credito";
import { resolveParametrosAmortizacion } from "@/application/credito/parametros-runtime";

export type EstudioCreditoConfig =
  | { modo: "fijo"; valor: number }
  | { modo: "porcentaje"; porcentaje: number };

/**
 * Parámetros de amortización por producto.
 * Basado en tabla FINAMIGO / Coodelsur (ejemplo Microcrédito Small $200.000, 2 cuotas).
 *
 * - Tasa mensual: depende del tipo de crédito.
 * - Estudio de crédito: cargo único (no mensual), se suma al capital para la cuota PMT.
 * - Fianza: porcentaje mensual sobre el monto solicitado.
 * - Vida deudores: porcentaje mensual sobre el valor del crédito.
 */
export interface ParametrosAmortizacion {
  tasaMensual: number;
  estudioCredito: EstudioCreditoConfig;
  fianzaMensualPorcentaje: number;
  vidaDeudoresPorcentaje: number;
  plazosPermitidos: readonly number[];
}

export function calcularEstudioCredito(
  config: EstudioCreditoConfig,
  montoSolicitado: number,
): number {
  if (config.modo === "fijo") return config.valor;
  return Math.round(montoSolicitado * config.porcentaje);
}

export const DEFAULT_AMORTIZACION_POR_TIPO: Partial<Record<TipoCredito, ParametrosAmortizacion>> = {
  microcredito_small: {
    tasaMensual: 0.021,
    estudioCredito: { modo: "fijo", valor: 30_000 },
    fianzaMensualPorcentaje: 0.125,
    vidaDeudoresPorcentaje: 437 / 200_000,
    plazosPermitidos: [1, 2, 3],
  },
  microcredito_urbano: {
    // Tasas pendientes de confirmación con Coodelsur — ajustar cuando se publique el formulario.
    tasaMensual: 0.019,
    estudioCredito: { modo: "porcentaje", porcentaje: 0.15 },
    fianzaMensualPorcentaje: 0.1,
    vidaDeudoresPorcentaje: 437 / 200_000,
    plazosPermitidos: [6, 12, 18, 24, 36, 48],
  },
  microcredito_rural: {
    tasaMensual: 0.018,
    estudioCredito: { modo: "porcentaje", porcentaje: 0.15 },
    fianzaMensualPorcentaje: 0.1,
    vidaDeudoresPorcentaje: 437 / 200_000,
    plazosPermitidos: [6, 12, 18, 24, 36],
  },
};

/** @deprecated Usar DEFAULT_AMORTIZACION_POR_TIPO o getParametrosAmortizacion. */
export const AMORTIZACION_POR_TIPO = DEFAULT_AMORTIZACION_POR_TIPO;

const FALLBACK_TIPO: TipoCredito = "microcredito_small";

export function getDefaultParametrosAmortizacion(tipo: TipoCredito): ParametrosAmortizacion {
  return DEFAULT_AMORTIZACION_POR_TIPO[tipo] ?? DEFAULT_AMORTIZACION_POR_TIPO[FALLBACK_TIPO]!;
}

/** Resuelve parámetros activos (BD/cache en runtime; defaults como respaldo). */
export function getParametrosAmortizacion(tipo: TipoCredito): ParametrosAmortizacion {
  return resolveParametrosAmortizacion(tipo) ?? getDefaultParametrosAmortizacion(tipo);
}

export function opcionesPlazosCuotas(tipo: TipoCredito) {
  return getParametrosAmortizacion(tipo).plazosPermitidos.map((n) => ({
    label: `${n} cuotas`,
    value: String(n),
  }));
}

/** @deprecated Usar `opcionesPlazosCuotas("microcredito_small")`. */
export const CANTIDAD_CUOTAS_SMALL = getDefaultParametrosAmortizacion(
  "microcredito_small",
).plazosPermitidos.map((n) => ({
  label: `${n} cuotas`,
  value: String(n),
}));
