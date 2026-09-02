import { extractFormProgress } from "@/lib/leads/form-progress";
import { extractCapitalSolicitado } from "@/lib/leads/lead-summary";

/** Campos desnormalizados para listados rápidos en admin (evita leer JSON completo). */
export function buildLeadSummaryFields(
  datosFormulario: unknown,
  estado: string,
): {
  capitalSolicitado: number | null;
  progresoFormulario: number | null;
  pasoActualFormulario: string | null;
} {
  const capital = extractCapitalSolicitado(datosFormulario);
  if (estado !== "incompleto") {
    return {
      capitalSolicitado: capital,
      progresoFormulario: null,
      pasoActualFormulario: null,
    };
  }

  const progress = extractFormProgress(datosFormulario);
  return {
    capitalSolicitado: capital,
    progresoFormulario: progress?.porcentaje ?? null,
    pasoActualFormulario: progress?.pasoActual ?? null,
  };
}
