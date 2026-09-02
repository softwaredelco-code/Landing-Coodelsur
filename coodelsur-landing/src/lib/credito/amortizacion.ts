import { calcularEstudioCredito, getParametrosAmortizacion, type ParametrosAmortizacion } from "@/config/creditos/amortizacion";
import type { TipoCredito } from "@/types/credito";

export interface DesgloseCuota {
  tipoCredito: TipoCredito;
  montoSolicitado: number;
  /** Cargo único de estudio de crédito (no va en la cuota mensual aparte; entra en la base PMT). */
  estudioCredito: number;
  valorCreditoFinanciado: number;
  cantidadCuotas: number;
  tasaMensual: number;
  cuotaCapitalInteres: number;
  vidaDeudoresMensual: number;
  fianzaMensual: number;
  valorCuotaTotal: number;
}

/** Cuota fija capital + intereses (equivalente a PMT en Excel). */
export function calcularCuotaCapitalInteres(
  valorCredito: number,
  tasaMensual: number,
  cantidadCuotas: number,
): number {
  if (valorCredito <= 0 || cantidadCuotas <= 0) return 0;
  if (tasaMensual === 0) return valorCredito / cantidadCuotas;

  const factor = Math.pow(1 + tasaMensual, cantidadCuotas);
  return (valorCredito * tasaMensual * factor) / (factor - 1);
}

/** Calcula la cuota total mensual según parámetros del tipo de crédito. */
export function calcularDesgloseCuota(
  tipoCredito: TipoCredito,
  montoSolicitado: number,
  cantidadCuotas: number,
  parametrosOverride?: ParametrosAmortizacion,
): DesgloseCuota {
  const params = parametrosOverride ?? getParametrosAmortizacion(tipoCredito);
  const estudioCredito = calcularEstudioCredito(params.estudioCredito, montoSolicitado);
  const valorCreditoFinanciado = montoSolicitado + estudioCredito;
  const cuotaCapitalInteres = calcularCuotaCapitalInteres(
    valorCreditoFinanciado,
    params.tasaMensual,
    cantidadCuotas,
  );
  const fianzaMensual = Math.round(montoSolicitado * params.fianzaMensualPorcentaje);
  const vidaDeudoresMensual = Math.round(montoSolicitado * params.vidaDeudoresPorcentaje);

  return {
    tipoCredito,
    montoSolicitado,
    estudioCredito,
    valorCreditoFinanciado,
    cantidadCuotas,
    tasaMensual: params.tasaMensual,
    cuotaCapitalInteres: Math.round(cuotaCapitalInteres),
    vidaDeudoresMensual,
    fianzaMensual,
    valorCuotaTotal: Math.round(cuotaCapitalInteres + vidaDeudoresMensual + fianzaMensual),
  };
}

/** Atajo para Microcrédito Small (formulario actual). */
export function calcularDesgloseCuotaSmall(montoSolicitado: number, cantidadCuotas: number) {
  return calcularDesgloseCuota("microcredito_small", montoSolicitado, cantidadCuotas);
}
