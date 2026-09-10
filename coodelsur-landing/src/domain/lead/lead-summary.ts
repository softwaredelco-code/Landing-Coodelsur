/** Extrae el capital solicitado guardado en datosFormulario del lead. */
export function extractCapitalSolicitado(datosFormulario: unknown): number | null {
  if (!datosFormulario || typeof datosFormulario !== "object") return null;

  const capital =
    (datosFormulario as Record<string, unknown>).capitalSeleccionado ??
    (datosFormulario as Record<string, unknown>).capital_solicitado ??
    (datosFormulario as Record<string, unknown>).monto;
  if (typeof capital !== "number" || !Number.isFinite(capital) || capital <= 0) return null;

  return capital;
}

export function extractProgresoFormulario(datosFormulario: unknown): number | null {
  if (!datosFormulario || typeof datosFormulario !== "object") return null;
  const progreso = (datosFormulario as Record<string, unknown>)._progreso;
  if (!progreso || typeof progreso !== "object") return null;
  const porcentaje = (progreso as { porcentaje?: unknown }).porcentaje;
  if (typeof porcentaje !== "number" || !Number.isFinite(porcentaje)) return null;
  return Math.min(100, Math.max(0, Math.round(porcentaje)));
}

export function extractPasoActualFormulario(datosFormulario: unknown): string | null {
  if (!datosFormulario || typeof datosFormulario !== "object") return null;
  const progreso = (datosFormulario as Record<string, unknown>)._progreso;
  if (!progreso || typeof progreso !== "object") return null;
  const paso = (progreso as { pasoActual?: unknown }).pasoActual;
  return typeof paso === "string" && paso.trim() ? paso : null;
}

const ATTACHMENT_FIELDS = new Set([
  "cedulaFrontal",
  "cedulaReverso",
  "videoVerificacion",
  "firma",
]);

/** Quita previews/base64 pesados antes de enviar al panel admin. */
export function sanitizeDatosFormularioForAdmin(datosFormulario: unknown): Record<string, unknown> {
  const sanitize = (value: unknown, key?: string, parentKey?: string): unknown => {
    if ((key && ATTACHMENT_FIELDS.has(key)) || (parentKey && ATTACHMENT_FIELDS.has(parentKey))) {
      return value;
    }
    if (key === "preview") return undefined;

    if (typeof value === "string") {
      if (value.startsWith("data:") && value.length > 500) {
        return `[archivo adjunto ~${Math.round(value.length / 1024)} KB — ver en Adjuntos]`;
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => sanitize(item, key, parentKey))
        .filter((item) => item !== undefined);
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [entryKey, entryValue] of Object.entries(value)) {
        const sanitized = sanitize(entryValue, entryKey, key ?? parentKey);
        if (sanitized !== undefined) {
          result[entryKey] = sanitized;
        }
      }
      return result;
    }

    return value;
  };

  const sanitized = sanitize(datosFormulario);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}

export function mapLeadListRow<
  T extends {
    datosFormulario?: unknown;
    estado: string;
    capitalSolicitado?: number | null;
    progresoFormulario?: number | null;
    pasoActualFormulario?: string | null;
  },
>(
  lead: T,
): Omit<T, "datosFormulario"> & {
  capitalSolicitado: number | null;
  progresoFormulario: number | null;
  pasoActualFormulario: string | null;
} {
  const { datosFormulario, ...rest } = lead;
  const capitalFromColumn = lead.capitalSolicitado ?? null;
  const progresoFromColumn = lead.progresoFormulario ?? null;
  const pasoFromColumn = lead.pasoActualFormulario ?? null;

  return {
    ...rest,
    capitalSolicitado:
      capitalFromColumn ?? (datosFormulario ? extractCapitalSolicitado(datosFormulario) : null),
    progresoFormulario:
      progresoFromColumn ??
      (lead.estado === "incompleto" && datosFormulario
        ? extractProgresoFormulario(datosFormulario)
        : null),
    pasoActualFormulario:
      pasoFromColumn ??
      (lead.estado === "incompleto" && datosFormulario
        ? extractPasoActualFormulario(datosFormulario)
        : null),
  };
}