"use client";

import type { ComponentType } from "react";
import type { TipoCredito } from "@/shared/types/credito";
import type { CreditoFormProps } from "@/presentation/components/forms/types";
import { FormularioMicrocreditoSmall } from "@/presentation/components/forms/microcredito-small";
import { FormularioMicrocreditoUrbano } from "@/presentation/components/forms/microcredito-urbano";
import { FormularioMicrocreditoRural } from "@/presentation/components/forms/microcredito-rural";
import { FormularioConsumo } from "@/presentation/components/forms/consumo";
import { FormularioComercial } from "@/presentation/components/forms/comercial";
import { FormularioLibranza } from "@/presentation/components/forms/libranza";
import { isFormularioImplementado } from "@/shared/config/creditos/formularios";

/**
 * Mapa tipo de crédito → orquestador del formulario.
 * Agregar aquí cada nuevo formulario al implementarlo.
 */
export const FORMULARIO_COMPONENTES: Record<TipoCredito, ComponentType<CreditoFormProps>> = {
  microcredito_small: FormularioMicrocreditoSmall,
  microcredito_urbano: FormularioMicrocreditoUrbano,
  microcredito_rural: FormularioMicrocreditoRural,
  consumo: FormularioConsumo,
  comercial: FormularioComercial,
  libranza: FormularioLibranza,
};

export interface FormularioPorTipoProps extends CreditoFormProps {
  tipo: TipoCredito;
}

/** Renderiza el formulario correcto según el producto. */
export function FormularioPorTipo({ tipo, ...props }: FormularioPorTipoProps) {
  const Component = FORMULARIO_COMPONENTES[tipo];
  return <Component {...props} />;
}

export { isFormularioImplementado };
