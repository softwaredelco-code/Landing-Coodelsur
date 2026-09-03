import type { CreditoConfig, TipoCredito } from "@/shared/types/credito";
import { microcreditoSmallConfig } from "./nanocredito";

export {
  RANGOS_MONTO_CREDITO,
  resolverTipoPorMonto,
  listarCandidatosPorMonto,
  conRangoElegido,
  getRangoPorTipo,
  montoCoincideConTipo,
  descripcionRangosParaUi,
  ajustarMontoAlRangoMasCercano,
  MONTO_SELECTOR_MIN,
  MONTO_SELECTOR_MAX,
  MONTO_SELECTOR_STEP,
  MONTO_SELECTOR_DEFAULT,
  type RangoMonto,
  type ResolucionMonto,
} from "./montos";

/**
 * Catálogo de productos Coodelsur.
 * Solo `disponible: true` tiene formulario activo en la app.
 */
const creditosCatalogo: Omit<CreditoConfig, "sections">[] = [
  {
    slug: "microcredito_small",
    nombre: "Microcrédito Small",
    descripcionCorta: microcreditoSmallConfig.descripcionCorta,
    descripcion: microcreditoSmallConfig.descripcion,
    disponible: true,
  },
  {
    slug: "microcredito_rural",
    nombre: "Microcrédito rural",
    descripcionCorta: "Crédito rural desde $1.000.000 hasta $5.000.000.",
    descripcion:
      "Microcrédito rural orientado a actividades del sector rural, con montos entre $1.000.000 y $5.000.000.",
    disponible: false,
  },
  {
    slug: "microcredito_urbano",
    nombre: "Microcrédito urbano",
    descripcionCorta: "Crédito urbano desde $600.001 hasta $20.000.000.",
    descripcion:
      "Microcrédito urbano para necesidades en zona urbana, con montos desde $600.001 hasta $20.000.000.",
    disponible: false,
  },
  {
    slug: "consumo",
    nombre: "Crédito de Consumo",
    descripcionCorta: "Libre inversión para bienes o servicios.",
    descripcion: "Crédito de consumo de libre disposición.",
    disponible: false,
  },
  {
    slug: "comercial",
    nombre: "Crédito Comercial",
    descripcionCorta: "Financiamiento empresarial y capital de trabajo.",
    descripcion: "Crédito comercial para empresas.",
    disponible: false,
  },
  {
    slug: "libranza",
    nombre: "Libranza",
    descripcionCorta: "Descuento directo de nómina.",
    descripcion: "Crédito por libranza con descuento de nómina.",
    disponible: false,
  },
];

function stub(slug: TipoCredito): CreditoConfig {
  const meta = creditosCatalogo.find((c) => c.slug === slug)!;
  return { ...meta, sections: [] };
}

export const creditosConfig: Record<TipoCredito, CreditoConfig> = {
  microcredito_small: microcreditoSmallConfig,
  microcredito_rural: stub("microcredito_rural"),
  microcredito_urbano: stub("microcredito_urbano"),
  consumo: stub("consumo"),
  comercial: stub("comercial"),
  libranza: stub("libranza"),
};

export const creditosList = creditosCatalogo.map((item) => creditosConfig[item.slug]);

export const creditosDisponibles = creditosList.filter((c) => c.disponible);

export function getCreditoConfig(slug: string): CreditoConfig | undefined {
  // Compatibilidad con slugs antiguos en bookmarks / campañas
  if (slug === "nanocredito") return creditosConfig.microcredito_small;
  if (slug === "microcredito") return creditosConfig.microcredito_rural;
  return creditosConfig[slug as TipoCredito];
}

export function isTipoCredito(value: string): value is TipoCredito {
  return value in creditosConfig;
}

export function isCreditoDisponible(slug: string): boolean {
  const config = getCreditoConfig(slug);
  return config?.disponible === true;
}
