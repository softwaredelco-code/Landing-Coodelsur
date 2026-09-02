import type { NanocreditoFormValues } from "@/lib/validation/nanocredito";

const STORAGE_KEY = "coodelsur_nanocredito_draft_v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface NanocreditoDraft {
  version: 1;
  step: number;
  values: Partial<NanocreditoFormValues>;
  savedAt: string;
  /** true cuando no cupieron fotos/video/firma en el almacenamiento local */
  partial?: boolean;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function omitHeavyFields(
  values: NanocreditoFormValues,
  level: number,
): Partial<NanocreditoFormValues> {
  const copy: Partial<NanocreditoFormValues> = { ...values };

  if (level >= 1) copy.videoVerificacion = undefined;
  if (level >= 2) {
    copy.cedulaFrontal = undefined;
    copy.cedulaReverso = undefined;
  }
  if (level >= 3) copy.firma = "";

  return copy;
}

export function loadNanocreditoDraft(): NanocreditoDraft | null {
  if (!isBrowser()) return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as NanocreditoDraft;
    if (parsed.version !== 1 || !parsed.savedAt) return null;

    if (Date.now() - new Date(parsed.savedAt).getTime() > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveNanocreditoDraft(step: number, values: NanocreditoFormValues): boolean {
  if (!isBrowser()) return false;

  for (let level = 0; level <= 3; level += 1) {
    const payload: NanocreditoDraft = {
      version: 1,
      step,
      values: level === 0 ? values : omitHeavyFields(values, level),
      savedAt: new Date().toISOString(),
      partial: level > 0,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return !payload.partial;
    } catch {
      // QuotaExceededError u otro fallo: intentar sin archivos pesados.
    }
  }

  return false;
}

export function clearNanocreditoDraft() {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}

export function hasMeaningfulDraftValues(values: Partial<NanocreditoFormValues>): boolean {
  const ignored = new Set([
    "tipoCredito",
    "fechaPagoOportunoModo",
    "aceptaTerminos",
    "fechaAceptacionTerminos",
  ]);

  return Object.entries(values).some(([key, value]) => {
    if (ignored.has(key)) return false;
    if (value === undefined || value === null || value === "") return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    return true;
  });
}
