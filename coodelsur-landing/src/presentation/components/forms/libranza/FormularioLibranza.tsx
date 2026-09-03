"use client";

/** Orquestador Libranza — POR IMPLEMENTAR. */
import { FormularioEnDesarrollo } from "@/presentation/components/forms/FormularioEnDesarrollo";
import type { CreditoFormProps } from "@/presentation/components/forms/types";

export function FormularioLibranza(props: CreditoFormProps) {
  return (
    <FormularioEnDesarrollo
      {...props}
      devHint="Implementar FormularioLibranza.tsx en libranza/"
    />
  );
}
