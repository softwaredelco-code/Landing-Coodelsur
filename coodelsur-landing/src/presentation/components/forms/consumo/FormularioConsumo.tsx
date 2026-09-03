"use client";

/** Orquestador Crédito de consumo — POR IMPLEMENTAR. */
import { FormularioEnDesarrollo } from "@/presentation/components/forms/FormularioEnDesarrollo";
import type { CreditoFormProps } from "@/presentation/components/forms/types";

export function FormularioConsumo(props: CreditoFormProps) {
  return (
    <FormularioEnDesarrollo
      {...props}
      devHint="Implementar FormularioConsumo.tsx en consumo/"
    />
  );
}
