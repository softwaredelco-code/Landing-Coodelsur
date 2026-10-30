/**
 * Consulta leads completos para exportación Excel (admin).
 */

import {
  isDbConnectionError,
  isTransientDbError,
  listLeadsFromFile,
} from "@/infrastructure/persistence/file-store";
import type { LeadExportRecord } from "@/application/lead/export-leads-excel";
import { prisma } from "@/infrastructure/database/prisma";

export const MAX_LEADS_EXPORT = 5000;
const EXPORT_BATCH_SIZE = 150;

export interface FetchLeadsForExportOptions {
  ids?: string[];
  estado?: string | null;
  tipoCredito?: string | null;
  origen?: string | null;
  q?: string | null;
  mes?: string | null;
  take?: number;
  skip?: number;
}

const ATTACHMENT_KEYS = [
  "cedulaFrontal",
  "cedulaReverso",
  "videoVerificacion",
  "firma",
] as const;

/**
 * Elimina binarios base64 pesados (videos/imágenes inline) y payloads duplicados
 * que no se usan en las celdas de Excel pero consumen varios MB de RAM en cPanel.
 */
export function sanitizeDatosFormularioForExport(
  datosFormulario: unknown,
): Record<string, unknown> {
  if (!datosFormulario || typeof datosFormulario !== "object") return {};

  const raw = datosFormulario as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (key === "payloadOriginal" || key === "witmePostback") continue;

    if (key === "_progreso" && value && typeof value === "object") {
      const porc = (value as { porcentaje?: unknown }).porcentaje;
      if (typeof porc === "number") {
        cleaned._progreso = { porcentaje: porc };
      }
      continue;
    }

    if (key === "cedulaVerificacion" && value && typeof value === "object") {
      const cv = value as Record<string, unknown>;
      cleaned.cedulaVerificacion = {
        status: cv.status,
        message: cv.message,
      };
      continue;
    }

    if ((ATTACHMENT_KEYS as readonly string[]).includes(key)) {
      if (typeof value === "string") {
        cleaned[key] = value.startsWith("data:") ? "data:inline" : value;
      } else if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const preview =
          typeof obj.preview === "string" && obj.preview.startsWith("data:")
            ? "data:inline"
            : typeof obj.preview === "string" && obj.preview.startsWith("http")
              ? obj.preview
              : undefined;
        cleaned[key] = {
          ...(typeof obj.url === "string" ? { url: obj.url } : {}),
          ...(typeof obj.path === "string" ? { path: obj.path } : {}),
          ...(typeof obj.uploaded === "boolean" ? { uploaded: obj.uploaded } : {}),
          ...(preview ? { preview } : {}),
        };
      }
      continue;
    }

    if (typeof value === "string" && value.startsWith("data:") && value.length > 200) {
      cleaned[key] = "data:inline";
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

function sanitizeLeadForExport(lead: LeadExportRecord): LeadExportRecord {
  return {
    ...lead,
    datosFormulario: sanitizeDatosFormularioForExport(lead.datosFormulario),
  };
}

export function parseMonthRange(mes?: string | null): { gte: Date; lt: Date } | undefined {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return undefined;
  const [yearStr, monthStr] = mes.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (month < 1 || month > 12) return undefined;

  // Colombia timezone: UTC-5
  // Inicio del mes en Colombia: año-mes-01 00:00:00 -> en UTC es +5 horas
  const start = new Date(Date.UTC(year, month - 1, 1, 5, 0, 0, 0));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(Date.UTC(nextYear, nextMonth - 1, 1, 5, 0, 0, 0));

  return { gte: start, lt: end };
}

const EXPORT_SELECT = {
  id: true,
  tipoCredito: true,
  nombre: true,
  cedula: true,
  telefono: true,
  email: true,
  origen: true,
  estado: true,
  aceptaTerminos: true,
  fechaAceptacionTerminos: true,
  utmSource: true,
  utmCampaign: true,
  utmMedium: true,
  utmTerm: true,
  utmContent: true,
  ip: true,
  ciudad: true,
  pais: true,
  latitud: true,
  longitud: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  capitalSolicitado: true,
  progresoFormulario: true,
  pasoActualFormulario: true,
  datosFormulario: true,
} as const;

function buildWhere(options: FetchLeadsForExportOptions) {
  const q = options.q?.trim()?.toLowerCase();
  const fechaRange = parseMonthRange(options.mes);
  const estadoFilter = options.estado
    ? options.estado === "completo"
      ? { in: ["completo", "recibido"] as any }
      : options.estado === "por_contactar"
        ? { in: ["por_contactar", "revisado", "contactado"] as any }
        : options.estado === "rechazado_no_cumple"
          ? { in: ["rechazado_no_cumple", "descartado"] as any }
          : (options.estado as any)
    : undefined;

  return {
    ...(options.ids?.length ? { id: { in: options.ids } } : {}),
    ...(estadoFilter ? { estado: estadoFilter } : {}),
    ...(options.tipoCredito ? { tipoCredito: options.tipoCredito } : {}),
    ...(options.origen ? { origen: options.origen } : {}),
    ...(fechaRange ? { fechaCreacion: fechaRange } : {}),
    ...(q
      ? {
          OR: [
            { nombre: { contains: q, mode: "insensitive" as const } },
            { cedula: { contains: q } },
            { telefono: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

function filterFileLeads(
  leads: ReturnType<typeof listLeadsFromFile>,
  options: FetchLeadsForExportOptions,
) {
  const q = options.q?.trim()?.toLowerCase();
  let filtered = leads;

  if (options.ids?.length) {
    const idSet = new Set(options.ids);
    filtered = filtered.filter((lead) => idSet.has(lead.id));
  }
  if (options.estado) {
    const allowedEstados =
      options.estado === "completo"
        ? ["completo", "recibido"]
        : options.estado === "por_contactar"
          ? ["por_contactar", "revisado", "contactado"]
          : options.estado === "rechazado_no_cumple"
            ? ["rechazado_no_cumple", "descartado"]
            : [options.estado];
    filtered = filtered.filter((lead) => allowedEstados.includes(lead.estado));
  }
  if (options.tipoCredito) {
    filtered = filtered.filter((lead) => lead.tipoCredito === options.tipoCredito);
  }
  if (options.origen) {
    filtered = filtered.filter((lead) => lead.origen === options.origen);
  }
  if (options.mes) {
    const range = parseMonthRange(options.mes);
    if (range) {
      filtered = filtered.filter((lead) => {
        const d = new Date(lead.fechaCreacion);
        return d >= range.gte && d < range.lt;
      });
    }
  }
  if (q) {
    filtered = filtered.filter(
      (lead) =>
        lead.nombre.toLowerCase().includes(q) ||
        lead.cedula.includes(q) ||
        lead.telefono.includes(q) ||
        (lead.email ?? "").toLowerCase().includes(q),
    );
  }

  const startOffset = Math.max(0, options.skip ?? 0);
  const maxRows = Math.min(MAX_LEADS_EXPORT, options.take ?? MAX_LEADS_EXPORT);

  return filtered
    .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
    .slice(startOffset, startOffset + maxRows)
    .map((l) => sanitizeLeadForExport(l as unknown as LeadExportRecord));
}

async function fetchBatchWithRetry(
  where: ReturnType<typeof buildWhere>,
  skip: number,
  take: number,
): Promise<LeadExportRecord[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rows = await prisma.lead.findMany({
        where,
        orderBy: [{ fechaCreacion: "desc" }, { id: "desc" }],
        skip,
        take,
        select: EXPORT_SELECT,
      });
      return (rows as LeadExportRecord[]).map(sanitizeLeadForExport);
    } catch (err) {
      if (attempt === 1 && isTransientDbError(err)) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw err;
    }
  }
  return [];
}

export async function fetchLeadsForExport(
  options: FetchLeadsForExportOptions,
): Promise<LeadExportRecord[]> {
  try {
    const where = buildWhere(options);
    const startSkip = Math.max(0, options.skip ?? 0);
    const targetTotal = Math.min(
      MAX_LEADS_EXPORT,
      options.take && options.take > 0 ? options.take : MAX_LEADS_EXPORT,
    );

    const results: LeadExportRecord[] = [];
    let currentSkip = startSkip;
    let remaining = targetTotal;

    while (remaining > 0) {
      const batchTake = Math.min(EXPORT_BATCH_SIZE, remaining);
      const batch = await fetchBatchWithRetry(where, currentSkip, batchTake);
      results.push(...batch);

      if (batch.length < batchTake) {
        break;
      }

      currentSkip += batch.length;
      remaining -= batch.length;
    }

    return results;
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;
    return filterFileLeads(listLeadsFromFile(), options);
  }
}
