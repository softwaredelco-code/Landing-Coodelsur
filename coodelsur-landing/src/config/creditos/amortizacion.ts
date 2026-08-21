import type { TipoCredito } from "@/types/credito";

/**
 * Parámetros de amortización por producto.
 * Basado en tabla FINAMIGO / Coodelsur (ejemplo Microcrédito Small $200.000, 2 cuotas).
 *
 * - Tasa mensual: depende del tipo de crédito.
 * - Fianza: porcentaje mensual sobre el monto solicitado (ej. 12,5 % → $25.000 en $200k).
 * - Vida deudores: porcentaje mensual sobre el valor del crédito (ej. 0,2185 % → $437 en $200k).
 * - factorValorFinanciado: saldo base para PMT (ver nota en README / pregunta a Coodelsur).
 */
export interface ParametrosAmortizacion {
  tasaMensual: number;
  /**
   * Monto solicitado × factor = saldo sobre el que se calculan intereses y cuota fija (PMT).
   * En el Excel de $200k el valor financiado es $230k (× 1,15). Confirmar qué representa ese extra.
   */
  factorValorFinanciado: number;
  /** Porcentaje mensual del monto solicitado (0,125 = 12,5 %). */
  fianzaMensualPorcentaje: number;
  /** Porcentaje mensual del valor del crédito / monto solicitado (0,002185 ≈ 0,2185 %). */
  vidaDeudoresPorcentaje: number;
  plazosPermitidos: readonly number[];
}

export const AMORTIZACION_POR_TIPO: Partial<Record<TipoCredito, ParametrosAmortizacion>> = {
  microcredito_small: {
    tasaMensual: 0.0212,
    factorValorFinanciado: 1.15,
    fianzaMensualPorcentaje: 0.125,
    vidaDeudoresPorcentaje: 437 / 200_000,
    plazosPermitidos: [2, 4, 6, 8, 10, 12, 18, 24, 36],
  },
  microcredito_urbano: {
    // Tasas pendientes de confirmación con Coodelsur — ajustar cuando se publique el formulario.
    tasaMensual: 0.019,
    factorValorFinanciado: 1.15,
    fianzaMensualPorcentaje: 0.1,
    vidaDeudoresPorcentaje: 437 / 200_000,
    plazosPermitidos: [6, 12, 18, 24, 36, 48],
  },
  microcredito_rural: {
    tasaMensual: 0.018,
    factorValorFinanciado: 1.15,
    fianzaMensualPorcentaje: 0.1,
    vidaDeudoresPorcentaje: 437 / 200_000,
    plazosPermitidos: [6, 12, 18, 24, 36],
  },
};

const FALLBACK_TIPO: TipoCredito = "microcredito_small";

export function getParametrosAmortizacion(tipo: TipoCredito): ParametrosAmortizacion {
  return AMORTIZACION_POR_TIPO[tipo] ?? AMORTIZACION_POR_TIPO[FALLBACK_TIPO]!;
}

export function opcionesPlazosCuotas(tipo: TipoCredito) {
  return getParametrosAmortizacion(tipo).plazosPermitidos.map((n) => ({
    label: `${n} cuotas`,
    value: String(n),
  }));
}

/** @deprecated Usar `opcionesPlazosCuotas("microcredito_small")`. */
export const CANTIDAD_CUOTAS_SMALL = opcionesPlazosCuotas("microcredito_small");
