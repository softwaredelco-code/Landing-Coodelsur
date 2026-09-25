import type { CreditoConfig, TipoCredito } from "@/shared/types/credito";
import { microcreditoSmallConfig } from "./nanocredito";
import { microcreditoUrbanoConfig } from "./urbano";

import { consumoConfig } from "./consumo";
import { comercialConfig } from "./comercial";
import { libranzaConfig } from "./libranza";

export {
  FORMULARIOS_PRODUCTO,
  FORMULARIOS_IMPLEMENTADOS,
  isFormularioImplementado,
  getFormularioRuta,
} from "./formularios";

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
 * Solo productos con `disponible: true` y formulario implementado están activos en la app.
 */
const creditosCatalogo: Omit<CreditoConfig, "sections">[] = [
  {
    slug: "microcredito_small",
    nombre: microcreditoSmallConfig.nombre,
    descripcionCorta: microcreditoSmallConfig.descripcionCorta,
    descripcion: microcreditoSmallConfig.descripcion,
    disponible: true,
  },

  {
    slug: "microcredito_urbano",
    nombre: microcreditoUrbanoConfig.nombre,
    descripcionCorta: microcreditoUrbanoConfig.descripcionCorta,
    descripcion: microcreditoUrbanoConfig.descripcion,
    disponible: false,
  },
  {
    slug: "consumo",
    nombre: consumoConfig.nombre,
    descripcionCorta: consumoConfig.descripcionCorta,
    descripcion: consumoConfig.descripcion,
    disponible: false,
  },
  {
    slug: "comercial",
    nombre: comercialConfig.nombre,
    descripcionCorta: comercialConfig.descripcionCorta,
    descripcion: comercialConfig.descripcion,
    disponible: false,
  },
  {
    slug: "libranza",
    nombre: libranzaConfig.nombre,
    descripcionCorta: libranzaConfig.descripcionCorta,
    descripcion: libranzaConfig.descripcion,
    disponible: true,
  },
];

export const creditosConfig: Record<TipoCredito, CreditoConfig> = {
  microcredito_small: microcreditoSmallConfig,

  microcredito_urbano: microcreditoUrbanoConfig,
  consumo: consumoConfig,
  comercial: comercialConfig,
  libranza: libranzaConfig,
};

export const creditosList = creditosCatalogo.map((item) => creditosConfig[item.slug]);

export const creditosDisponibles = creditosList.filter((c) => c.disponible);

export function getCreditoConfig(slug: string): CreditoConfig | undefined {
  // Compatibilidad con slugs antiguos en bookmarks / campañas
  if (slug === "nanocredito") return creditosConfig.microcredito_small;
  if (slug === "microcredito") return creditosConfig.microcredito_small;
  return creditosConfig[slug as TipoCredito];
}

export function isTipoCredito(value: string): value is TipoCredito {
  return value in creditosConfig;
}

export function isCreditoDisponible(slug: string): boolean {
  const config = getCreditoConfig(slug);
  return config?.disponible === true;
}
