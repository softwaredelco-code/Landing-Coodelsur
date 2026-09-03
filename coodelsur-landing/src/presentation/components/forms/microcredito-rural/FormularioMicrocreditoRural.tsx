"use client";

/** Orquestador Microcrédito rural — POR IMPLEMENTAR. Ver microcredito-small/ como referencia. */
import { FormularioEnDesarrollo } from "@/presentation/components/forms/FormularioEnDesarrollo";
import type { CreditoFormProps } from "@/presentation/components/forms/types";

export function FormularioMicrocreditoRural(props: CreditoFormProps) {
  return (
    <FormularioEnDesarrollo
      {...props}
      devHint="Implementar FormularioMicrocreditoRural.tsx y secciones en microcredito-rural/sections/"
    />
  );
}
