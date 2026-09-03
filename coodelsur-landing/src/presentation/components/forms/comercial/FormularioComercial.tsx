"use client";

/** Orquestador Crédito comercial — POR IMPLEMENTAR. */
import { FormularioEnDesarrollo } from "@/presentation/components/forms/FormularioEnDesarrollo";
import type { CreditoFormProps } from "@/presentation/components/forms/types";

export function FormularioComercial(props: CreditoFormProps) {
  return (
    <FormularioEnDesarrollo
      {...props}
      devHint="Implementar FormularioComercial.tsx en comercial/"
    />
  );
}
