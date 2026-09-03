import { isValidDocumentFormat } from "@/domain/identity/cedula-local";
import { normalizeDocumentNumber } from "@/domain/identity/cedula";
import { NANOCREDITO_STEPS } from "@/shared/validation/nanocredito";

export interface FormProgressMeta {
  porcentaje: number;
  pasoIndice: number;
  pasoActual: string;
  totalPasos: number;
  ultimaActualizacion: string;
}

const NUMERIC_FIELDS_ALLOW_ZERO = new Set(["personasACargo"]);

function isFieldFilled(field: string, value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;

  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (NUMERIC_FIELDS_ALLOW_ZERO.has(field)) return Number.isFinite(value) && value >= 0;
    return value > 0;
  }

  if (typeof value === "object" && value !== null) {
    if ("fileName" in value) {
      return Boolean(String((value as { fileName?: string }).fileName ?? "").trim());
    }
    if ("lat" in value && "lng" in value) {
      const geo = value as { lat?: number; lng?: number };
      return Number.isFinite(geo.lat) && Number.isFinite(geo.lng);
    }
  }

  return String(value).trim().length > 0;
}

/** Calcula el avance del formulario según campos diligenciados y paso actual. */
export function calcularProgresoFormulario(
  values: Record<string, unknown>,
  step: number,
): FormProgressMeta {
  const allFields = NANOCREDITO_STEPS.flatMap((section) => section.fields);
  const filled = allFields.filter((field) => isFieldFilled(field, values[field])).length;
  const porcentaje = allFields.length > 0 ? Math.round((filled / allFields.length) * 100) : 0;
  const safeStep = Math.min(Math.max(0, step), NANOCREDITO_STEPS.length - 1);
  const section = NANOCREDITO_STEPS[safeStep];

  return {
    porcentaje: Math.min(100, Math.max(0, porcentaje)),
    pasoIndice: safeStep,
    pasoActual: section?.title ?? "Inicio",
    totalPasos: NANOCREDITO_STEPS.length,
    ultimaActualizacion: new Date().toISOString(),
  };
}

export function extractFormProgress(datosFormulario: unknown): FormProgressMeta | null {
  if (!datosFormulario || typeof datosFormulario !== "object") return null;

  const raw = (datosFormulario as Record<string, unknown>)._progreso;
  if (!raw || typeof raw !== "object") return null;

  const progress = raw as Partial<FormProgressMeta>;
  if (typeof progress.porcentaje !== "number") return null;

  return {
    porcentaje: Math.min(100, Math.max(0, Math.round(progress.porcentaje))),
    pasoIndice: typeof progress.pasoIndice === "number" ? progress.pasoIndice : 0,
    pasoActual: typeof progress.pasoActual === "string" ? progress.pasoActual : "—",
    totalPasos: typeof progress.totalPasos === "number" ? progress.totalPasos : NANOCREDITO_STEPS.length,
    ultimaActualizacion:
      typeof progress.ultimaActualizacion === "string"
        ? progress.ultimaActualizacion
        : new Date().toISOString(),
  };
}

/** ¿Hay datos mínimos para contactar al usuario y guardar el borrador? */
export function tieneDatosMinimosContacto(values: Record<string, unknown>): boolean {
  const telefono = String(values.telefono ?? "").replace(/\D/g, "");
  const cedula = normalizeDocumentNumber(String(values.cedula ?? ""));
  const tipoIdentificacion = String(values.tipoIdentificacion ?? "CC");
  const nombre = String(values.nombre ?? "").trim();
  const email = String(values.email ?? "").trim();

  if (telefono.length >= 10) return true;
  if (cedula && isValidDocumentFormat(tipoIdentificacion, cedula)) return true;
  if (nombre.length >= 3 && email.includes("@")) return true;

  return false;
}

/** Quita archivos pesados del borrador server-side (solo metadata). */
export function stripHeavyFieldsForDraft(values: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...values };

  for (const key of ["cedulaFrontal", "cedulaReverso", "videoVerificacion"] as const) {
    const file = copy[key];
    if (file && typeof file === "object" && file !== null && "fileName" in file) {
      const meta = file as { fileName?: string; mimeType?: string; size?: number };
      copy[key] = {
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        size: meta.size,
        draftOnly: true,
      };
    } else {
      delete copy[key];
    }
  }

  if (typeof copy.firma === "string" && copy.firma.startsWith("data:")) {
    copy.firma = "[firma en borrador local]";
  }

  return copy;
}
