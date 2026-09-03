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
  estado?: LeadEstado | null;
  tipoCredito?: string | null;
  q?: string | null;
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

  return {
    ...(options.ids?.length ? { id: { in: options.ids } } : {}),
    ...(options.estado ? { estado: options.estado } : {}),
    ...(options.tipoCredito ? { tipoCredito: options.tipoCredito } : {}),
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
