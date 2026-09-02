import type { ParametrosAmortizacion } from "@/config/creditos/amortizacion";
import type { TipoCredito } from "@/types/credito";

const runtimeOverrides = new Map<TipoCredito, ParametrosAmortizacion>();

export function resolveParametrosAmortizacion(
  tipo: TipoCredito,
): ParametrosAmortizacion | undefined {
  return runtimeOverrides.get(tipo);
}

export function setRuntimeParametrosOverrides(
  records: Partial<Record<TipoCredito, ParametrosAmortizacion>>,
) {
  runtimeOverrides.clear();
  for (const [tipo, params] of Object.entries(records) as [TipoCredito, ParametrosAmortizacion][]) {
    runtimeOverrides.set(tipo, params);
  }
}

export function applyRuntimeParametrosCache(map: Map<TipoCredito, ParametrosAmortizacion>) {
  runtimeOverrides.clear();
  map.forEach((params, tipo) => {
    runtimeOverrides.set(tipo, params);
  });
}

export function clearRuntimeParametrosOverrides() {
  runtimeOverrides.clear();
}
