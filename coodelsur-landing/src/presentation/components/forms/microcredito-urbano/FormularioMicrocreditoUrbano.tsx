"use client";

/**
 * Orquestador Microcrédito urbano — POR IMPLEMENTAR.
 *
 * Al implementar:
 * 1. Definir schema en shared/validation/microcredito-urbano/schema.ts
 * 2. Crear secciones en ./sections/
 * 3. Copiar patrón de microcredito-small/FormularioMicrocreditoSmall.tsx
 * 4. Activar en shared/config/creditos/formularios.ts (implementado: true)
 * 5. montos.ts → formularioDisponible: true
 * 6. index.ts → disponible: true + config real
 * 7. Branch en app/api/leads/route.ts y draft/route.ts
 */
import { FormularioEnDesarrollo } from "@/presentation/components/forms/FormularioEnDesarrollo";
import type { CreditoFormProps } from "@/presentation/components/forms/types";

export function FormularioMicrocreditoUrbano(props: CreditoFormProps) {
  return (
    <FormularioEnDesarrollo
      {...props}
      devHint="Implementar FormularioMicrocreditoUrbano.tsx y secciones en microcredito-urbano/sections/"
    />
  );
}
