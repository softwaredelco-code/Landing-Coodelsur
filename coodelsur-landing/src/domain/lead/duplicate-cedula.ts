import { listLeadsFromFile } from "@/infrastructure/persistence/file-store";
import { normalizeDocumentNumber } from "@/domain/identity/cedula";
import { prisma } from "@/infrastructure/database/prisma";
import { withTimeout } from "@/shared/utils";

const DEFAULT_DUPLICATE_DAYS = 30;
const ACTIVE_STATES = new Set(["recibido", "revisado", "contactado"]);

export interface DuplicateCedulaResult {
  duplicate: boolean;
  message?: string;
  existingLeadId?: string;
  existingFecha?: string;
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
 * Solo considera estados activos (recibido, revisado, contactado).
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
          estado: { in: ["recibido", "revisado", "contactado"] },
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
