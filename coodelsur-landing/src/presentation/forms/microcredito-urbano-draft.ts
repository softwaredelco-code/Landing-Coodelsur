import type { MicrocreditoUrbanoFormValues } from "@/shared/validation/microcredito-urbano/schema";

const STORAGE_KEY = "coodelsur_microcredito_urbano_draft_v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface MicrocreditoUrbanoDraft {
  version: 1;
  step: number;
  values: Partial<MicrocreditoUrbanoFormValues>;
  savedAt: string;
  /** true cuando no cupieron fotos/video/firma en el almacenamiento local */
  partial?: boolean;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function omitHeavyFields(
  values: MicrocreditoUrbanoFormValues,
  level: number,
): Partial<MicrocreditoUrbanoFormValues> {
  const copy: Partial<MicrocreditoUrbanoFormValues> = { ...values };

  if (level >= 1) copy.videoVerificacion = undefined;
  if (level >= 2) {
    copy.cedulaFrontal = undefined;
    copy.cedulaReverso = undefined;
  }
  if (level >= 3) copy.firma = "";

  return copy;
}

export function loadMicrocreditoUrbanoDraft(): MicrocreditoUrbanoDraft | null {
  if (!isBrowser()) return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as MicrocreditoUrbanoDraft;
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

export function saveMicrocreditoUrbanoDraft(
  step: number,
  values: MicrocreditoUrbanoFormValues,
): boolean {
  if (!isBrowser()) return false;

  for (let level = 0; level <= 3; level += 1) {
    const payload: MicrocreditoUrbanoDraft = {
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

export function clearMicrocreditoUrbanoDraft() {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}
