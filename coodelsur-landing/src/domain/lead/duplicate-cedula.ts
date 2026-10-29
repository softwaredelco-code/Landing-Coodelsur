import { deleteLeadFromFile, listLeadsFromFile } from "@/infrastructure/persistence/file-store";
import { normalizeDocumentNumber } from "@/domain/identity/cedula";
import { extractProgresoFormulario } from "@/domain/lead/lead-summary";
import { prisma } from "@/infrastructure/database/prisma";
import { withTimeout } from "@/shared/utils";
import { Prisma } from "@prisma/client";

const DEFAULT_DUPLICATE_DAYS = 30;
const ACTIVE_STATES = new Set([
  "completo",
  "por_contactar",
  "aprobado",
  "desembolsado",
  "rechazado_reportado",
  "rechazado_no_cumple",
  "no_interesado",
  "recibido",
  "revisado",
  "contactado",
]);

export interface DuplicateCedulaResult {
  duplicate: boolean;
  message?: string;
  existingLeadId?: string;
  existingFecha?: string;
}

export interface ClientDuplicateResolution {
  isDuplicate: boolean;
  action: "REJECT_INCOMING_DUPLICATE" | "PURGE_INFERIOR_AND_ALLOW" | "ALLOW_NEW";
  existingLead?: {
    id: string;
    estado: string;
    progreso: number;
    fechaCreacion: string;
    origen?: string;
  };
  purgedCount?: number;
  message?: string;
}

function getDuplicateWindowDays(): number {
  const raw = Number(process.env.DUPLICATE_CEDULA_DAYS ?? DEFAULT_DUPLICATE_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_DUPLICATE_DAYS;
  return Math.floor(raw);
}

function isWithinWindow(fecha: Date, windowDays: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  return fecha >= cutoff;
}

export function computeLeadCompletionPercentage(lead: {
  estado: string;
  progresoFormulario?: number | null;
  datosFormulario?: unknown;
}): number {
  if (lead.estado !== "incompleto") return 100;
  if (typeof lead.progresoFormulario === "number" && Number.isFinite(lead.progresoFormulario)) {
    return Math.min(100, Math.max(0, Math.round(lead.progresoFormulario)));
  }
  const extracted = extractProgresoFormulario(lead.datosFormulario);
  return extracted ?? 0;
}

const STATUS_PRIORITY: Record<string, number> = {
  desembolsado: 10,
  aprobado: 9,
  completo: 8,
  por_contactar: 7,
  revisado: 6,
  recibido: 5,
  contactado: 4,
  no_interesado: 3,
  rechazado_reportado: 2,
  rechazado_no_cumple: 2,
  descartado: 1,
  incompleto: 0,
};

function getLeadScore(lead: {
  estado: string;
  progresoFormulario?: number | null;
  datosFormulario?: unknown;
  fechaActualizacion?: Date | string;
  fechaCreacion: Date | string;
}) {
  const pct = computeLeadCompletionPercentage(lead);
  const statusScore = STATUS_PRIORITY[lead.estado] ?? 0;
  const time = new Date(lead.fechaActualizacion || lead.fechaCreacion).getTime();
  return { pct, statusScore, time };
}

function checkFileStoreDuplicates(
  normalizedCedula: string,
  windowDays: number,
): DuplicateCedulaResult {
  const leads = listLeadsFromFile();
  const match = leads.find((lead) => {
    if (normalizeDocumentNumber(lead.cedula) !== normalizedCedula) return false;
    if (!ACTIVE_STATES.has(lead.estado)) return false;
    return isWithinWindow(new Date(lead.fechaCreacion), windowDays);
  });

  if (!match) {
    return { duplicate: false };
  }

  return {
    duplicate: true,
    existingLeadId: match.id,
    existingFecha: match.fechaCreacion,
    message: `Ya existe una solicitud activa con este número de identificación en los últimos ${windowDays} días. Si necesitas actualizar datos, contáctanos.`,
  };
}

/**
 * Evita solicitudes duplicadas recientes con la misma cédula.
 */
export async function findRecentDuplicateCedula(
  cedula: string,
): Promise<DuplicateCedulaResult> {
  const normalizedCedula = normalizeDocumentNumber(cedula);
  if (!normalizedCedula) {
    return { duplicate: false };
  }

  const windowDays = getDuplicateWindowDays();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  try {
    const existing = await withTimeout(
      prisma.lead.findFirst({
        where: {
          cedula: normalizedCedula,
          estado: { in: Array.from(ACTIVE_STATES) as any },
          fechaCreacion: { gte: cutoff },
        },
        orderBy: { fechaCreacion: "desc" },
        select: {
          id: true,
          fechaCreacion: true,
        },
      }),
      8000,
      "duplicate-check-timeout",
    );

    if (existing) {
      return {
        duplicate: true,
        existingLeadId: existing.id,
        existingFecha: existing.fechaCreacion.toISOString(),
        message: `Ya existe una solicitud activa con este número de identificación en los últimos ${windowDays} días. Si necesitas actualizar datos, contáctanos.`,
      };
    }

    return { duplicate: false };
  } catch {
    return checkFileStoreDuplicates(normalizedCedula, windowDays);
  }
}

/**
 * Resuelve la duplicidad de un lead para un cliente comparando el porcentaje de completitud.
 *
 * Políticas Witme & Coodelsur:
 * 1. Si ya existe un registro con mayor o igual porcentaje completado (ej. 100%),
 *    el nuevo lead se descarta/elimina como duplicado y se responde HTTP 409 con status: "duplicate".
 * 2. Si el nuevo lead tiene mayor porcentaje que los registros existentes (ej. el cliente solo
 *    tenía un borrador incompleto al 15% y el nuevo lead viene al 100%), se eliminan los
 *    registros inferiores para dejar un solo registro por cliente (el de mayor %).
 */
export async function resolveClientDuplicateByProgress(params: {
  cedula: string;
  telefono?: string;
  witmeId?: string | null;
  incomingProgreso: number;
  windowDays?: number;
}): Promise<ClientDuplicateResolution> {
  const normalizedCedula = normalizeDocumentNumber(params.cedula);
  if (!normalizedCedula || normalizedCedula === "pendiente") {
    return { isDuplicate: false, action: "ALLOW_NEW" };
  }

  const windowDays = params.windowDays ?? getDuplicateWindowDays();
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const phoneDigits = (params.telefono || "").replace(/\D/g, "");

  try {
    const orConditions: Prisma.LeadWhereInput[] = [{ cedula: normalizedCedula }];

    if (params.witmeId) {
      orConditions.push({
        OR: [
          { datosFormulario: { path: ["witmeLeadId"], equals: params.witmeId } },
          { datosFormulario: { path: ["payloadOriginal", "witme_id"], equals: params.witmeId } },
          { datosFormulario: { path: ["payloadOriginal", "external_id"], equals: params.witmeId } },
          { datosFormulario: { path: ["payloadOriginal", "id_externo"], equals: params.witmeId } },
        ],
      });
    }

    if (phoneDigits.length >= 10) {
      orConditions.push({
        cedula: normalizedCedula,
        telefono: { contains: phoneDigits.slice(-10) },
      });
    }

    const existingLeads = await withTimeout(
      prisma.lead.findMany({
        where: {
          OR: orConditions,
          fechaCreacion: { gte: cutoff },
        },
        select: {
          id: true,
          cedula: true,
          nombre: true,
          estado: true,
          origen: true,
          progresoFormulario: true,
          datosFormulario: true,
          fechaCreacion: true,
          fechaActualizacion: true,
        },
      }),
      8000,
      "duplicate-progress-timeout",
    );

    if (!existingLeads || existingLeads.length === 0) {
      return { isDuplicate: false, action: "ALLOW_NEW" };
    }

    // Ordenar de mejor a peor según porcentaje, prioridad de estado y fecha
    existingLeads.sort((a, b) => {
      const scoreA = getLeadScore(a);
      const scoreB = getLeadScore(b);
      if (scoreB.pct !== scoreA.pct) return scoreB.pct - scoreA.pct;
      if (scoreB.statusScore !== scoreA.statusScore) return scoreB.statusScore - scoreA.statusScore;
      return scoreB.time - scoreA.time;
    });

    const bestExisting = existingLeads[0];
    const bestScore = getLeadScore(bestExisting);

    // Si el registro existente tiene mayor o igual avance que el entrante:
    // El entrante es el duplicado redundante y se rechaza conservando el existente.
    if (bestScore.pct >= params.incomingProgreso) {
      // Purgar cualquier borrador incompleto redundante para garantizar un único registro por cliente
      const inferiorIncompleteIds = existingLeads
        .filter((l) => l.id !== bestExisting.id && l.estado === "incompleto")
        .map((l) => l.id);

      if (inferiorIncompleteIds.length > 0) {
        await prisma.lead.deleteMany({
          where: { id: { in: inferiorIncompleteIds } },
        });
      }

      return {
        isDuplicate: true,
        action: "REJECT_INCOMING_DUPLICATE",
        existingLead: {
          id: bestExisting.id,
          estado: bestExisting.estado,
          progreso: bestScore.pct,
          fechaCreacion: bestExisting.fechaCreacion.toISOString(),
          origen: bestExisting.origen,
        },
        message: `Lead duplicado. Ya existe una solicitud registrada para este cliente con ${bestScore.pct}% de avance (${bestExisting.estado}). Se conserva el registro con mayor porcentaje completado.`,
      };
    }

    // Si el lead entrante tiene MAYOR porcentaje que el existente (ej. entrante 100% vs existente 15%):
    // Se eliminan los borradores incompletos inferiores de la DB para dejar únicamente 1 registro.
    const inferiorIncompleteIds = existingLeads
      .filter((l) => l.estado === "incompleto" && computeLeadCompletionPercentage(l) < params.incomingProgreso)
      .map((l) => l.id);

    let purgedCount = 0;
    if (inferiorIncompleteIds.length > 0) {
      const delResult = await prisma.lead.deleteMany({
        where: { id: { in: inferiorIncompleteIds } },
      });
      purgedCount = delResult.count;
    }

    return {
      isDuplicate: false,
      action: "PURGE_INFERIOR_AND_ALLOW",
      purgedCount,
      existingLead: {
        id: bestExisting.id,
        estado: bestExisting.estado,
        progreso: bestScore.pct,
        fechaCreacion: bestExisting.fechaCreacion.toISOString(),
        origen: bestExisting.origen,
      },
    };
  } catch (error) {
    // Fallback file-store
    const leads = listLeadsFromFile();
    const matching = leads.filter((lead) => {
      const sameCedula = normalizeDocumentNumber(lead.cedula) === normalizedCedula;
      const samePhone = phoneDigits.length >= 10 && lead.telefono.replace(/\D/g, "").endsWith(phoneDigits.slice(-10));
      return (sameCedula || samePhone) && isWithinWindow(new Date(lead.fechaCreacion), windowDays);
    });

    if (matching.length === 0) {
      return { isDuplicate: false, action: "ALLOW_NEW" };
    }

    matching.sort((a, b) => {
      const scoreA = getLeadScore(a);
      const scoreB = getLeadScore(b);
      if (scoreB.pct !== scoreA.pct) return scoreB.pct - scoreA.pct;
      if (scoreB.statusScore !== scoreA.statusScore) return scoreB.statusScore - scoreA.statusScore;
      return scoreB.time - scoreA.time;
    });

    const best = matching[0];
    const bestScore = getLeadScore(best);

    if (bestScore.pct >= params.incomingProgreso) {
      for (const other of matching) {
        if (other.id !== best.id && other.estado === "incompleto") {
          deleteLeadFromFile(other.id);
        }
      }

      return {
        isDuplicate: true,
        action: "REJECT_INCOMING_DUPLICATE",
        existingLead: {
          id: best.id,
          estado: best.estado,
          progreso: bestScore.pct,
          fechaCreacion: best.fechaCreacion,
          origen: best.origen,
        },
        message: `Lead duplicado. Se conserva el registro existente con mayor porcentaje (${bestScore.pct}%).`,
      };
    }

    let purgedCount = 0;
    for (const inferior of matching) {
      if (inferior.estado === "incompleto" && computeLeadCompletionPercentage(inferior) < params.incomingProgreso) {
        deleteLeadFromFile(inferior.id);
        purgedCount++;
      }
    }

    return {
      isDuplicate: false,
      action: "PURGE_INFERIOR_AND_ALLOW",
      purgedCount,
    };
  }
}

