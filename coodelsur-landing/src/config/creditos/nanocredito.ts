import type { CreditoConfig } from "@/types/credito";
import { formSectionsNanocredito } from "./form-sections";

/**
 * Configuración del Microcrédito Small
 * (antes llamado Nanocrédito en versiones tempranas del proyecto).
 * Rango: $200.000 – $600.000 COP.
 */
export const microcreditoSmallConfig: CreditoConfig = {
  slug: "microcredito_small",
  nombre: "Microcrédito Small",
  descripcionCorta:
    "Crédito ágil desde $200.000 hasta $600.000 para personas y microempresas.",
  descripcion:
    "Microcrédito Small de Coodelsur: montos entre $200.000 y $600.000. Completa tus datos y un asesor te contactará.",
  sections: formSectionsNanocredito,
  disponible: true,
};

/** @deprecated Preferir microcreditoSmallConfig */
export const nanocreditoConfig = microcreditoSmallConfig;
