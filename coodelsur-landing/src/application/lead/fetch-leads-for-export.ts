/**
 * Consulta leads completos para exportación Excel (admin).
 */

import { isDbConnectionError, listLeadsFromFile } from "@/infrastructure/persistence/file-store";
import type { LeadExportRecord } from "@/application/lead/export-leads-excel";
import { prisma } from "@/infrastructure/database/prisma";
import type { LeadEstado } from "@prisma/client";

export const MAX_LEADS_EXPORT = 5000;

export interface FetchLeadsForExportOptions {
  ids?: string[];
  estado?: string | null;
  tipoCredito?: string | null;
  origen?: string | null;
  q?: string | null;
  mes?: string | null;
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
    filtered = filtered.filter((lead) => lead.estado === options.estado);
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

  return filtered
    .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
    .slice(0, MAX_LEADS_EXPORT);
}

export async function fetchLeadsForExport(
  options: FetchLeadsForExportOptions,
): Promise<LeadExportRecord[]> {
  try {
    const leads = await prisma.lead.findMany({
      where: buildWhere(options),
      orderBy: { fechaCreacion: "desc" },
      take: MAX_LEADS_EXPORT,
      select: EXPORT_SELECT,
    });

    return leads as LeadExportRecord[];
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;
    return filterFileLeads(listLeadsFromFile(), options) as LeadExportRecord[];
  }
}
