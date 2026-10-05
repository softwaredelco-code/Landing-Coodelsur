/**
 * Borradores incompletos del formulario (estado `incompleto`).
 *
 * Guarda progreso parcial en PostgreSQL sin adjuntos pesados, deduplica por
 * cédula/teléfono y actualiza campos desnormalizados para el listado admin.
 *
 * @see POST /api/leads/draft — endpoint HTTP
 * @see useNanocreditoServerDraft — sincronización en cliente (debounce 2 s)
 */
import { Prisma } from "@prisma/client";
import { geolocateByIp } from "@/infrastructure/geo/ipapi";
import { normalizeDocumentNumber } from "@/domain/identity/cedula";
import {
  calcularProgresoFormulario,
  stripHeavyFieldsForDraft,
  tieneDatosMinimosContacto,
} from "@/domain/lead/form-progress";
import { buildLeadSummaryFields } from "@/domain/lead/lead-summary-fields";
import {
  deleteLeadFromFile,
  getLeadFromFile,
  isDbConnectionError,
  listLeadsFromFile,
  saveLeadToFile,
  updateLeadInFile,
} from "@/infrastructure/persistence/file-store";
import { inferOrigen } from "@/presentation/tracking/utm";
import { prisma } from "@/infrastructure/database/prisma";
import type { UtmParams } from "@/shared/types/credito";

export interface SaveDraftLeadInput {
  draftId?: string;
  step: number;
  values: Record<string, unknown>;
  utm?: UtmParams | null;
  ip?: string | null;
}

export interface SaveDraftLeadResult {
  id: string;
  porcentajeCompletado: number;
  pasoActual: string;
  storage: "database" | "file";
}

type DraftLookupClient = Pick<typeof prisma, "lead">;

function pickContactFields(values: Record<string, unknown>) {
  const telefono = String(values.telefono ?? "").trim() || "pendiente";
  const cedula = normalizeDocumentNumber(String(values.cedula ?? "")) || "pendiente";
  const nombre = String(values.nombre ?? "").trim() || "Solicitud incompleta";
  const emailRaw = String(values.email ?? "").trim();
  const email = emailRaw.includes("@") ? emailRaw : null;
  const tipoCredito = String(values.tipoCredito ?? "microcredito_small");

  return { telefono, cedula, nombre, email, tipoCredito };
}

function buildDraftDatosFormulario(values: Record<string, unknown>, step: number) {
  const progreso = calcularProgresoFormulario(values, step);
  return {
    ...stripHeavyFieldsForDraft(values),
    _progreso: progreso,
  };
}

function buildIncompleteMatchFilters(cedula: string, telefono: string): Prisma.LeadWhereInput[] {
  const phoneDigits = telefono.replace(/\D/g, "");
  const normalizedCedula = normalizeDocumentNumber(cedula);
  const filters: Prisma.LeadWhereInput[] = [];

  if (normalizedCedula && normalizedCedula !== "pendiente") {
    filters.push({ cedula: normalizedCedula });
  }
  if (phoneDigits.length >= 10) {
    filters.push({ telefono: { contains: phoneDigits.slice(-10) } });
  }

  return filters;
}

async function hasCompletedLeadForContact(
  client: DraftLookupClient,
  cedula: string,
  telefono: string,
): Promise<boolean> {
  const matchFilters = buildIncompleteMatchFilters(cedula, telefono);
  if (matchFilters.length === 0) return false;

  const completed = await client.lead.findFirst({
    where: {
      estado: { not: "incompleto" },
      OR: matchFilters,
    },
    select: { id: true },
  });

  return Boolean(completed);
}

/** Busca el borrador incompleto de un contacto (para promoverlo al enviar). */
export async function findIncompleteLeadIdForContact(
  cedula: string,
  telefono: string,
  draftId?: string | null,
): Promise<string | null> {
  const forceFile = process.env.LEAD_STORE === "file";
  const toId = (match: { id: string } | { finalized: true } | null) =>
    match && "id" in match ? match.id : null;

  if (!forceFile) {
    try {
      return toId(await findDraftToUpdate(prisma, draftId ?? undefined, cedula, telefono));
    } catch (error) {
      if (!isDbConnectionError(error)) throw error;
    }
  }

  return toId(findDraftToUpdateInFile(draftId ?? undefined, cedula, telefono));
}

/** Elimina borradores incompletos cuando ya existe una solicitud enviada del mismo contacto. */
export async function pruneStaleIncompleteDrafts(): Promise<number> {
  const forceFile = process.env.LEAD_STORE === "file";

  if (!forceFile) {
    try {
      const incompletos = await prisma.lead.findMany({
        where: { estado: "incompleto" },
        select: { id: true, cedula: true, telefono: true },
      });

      let deleted = 0;
      for (const draft of incompletos) {
        if (await hasCompletedLeadForContact(prisma, draft.cedula, draft.telefono)) {
          await prisma.lead.delete({ where: { id: draft.id } });
          deleted += 1;
        }
      }
      return deleted;
    } catch (error) {
      if (!isDbConnectionError(error)) throw error;
    }
  }

  const leads = listLeadsFromFile();
  let deleted = 0;
  for (const draft of leads) {
    if (draft.estado !== "incompleto") continue;

    const hasCompleted = leads.some((lead) => {
      if (lead.id === draft.id || lead.estado === "incompleto") return false;
      const phoneDigits = draft.telefono.replace(/\D/g, "");
      const normalizedCedula = normalizeDocumentNumber(draft.cedula);
      const sameCedula =
        normalizedCedula &&
        normalizedCedula !== "pendiente" &&
        lead.cedula === normalizedCedula;
      const samePhone =
        phoneDigits.length >= 10 &&
        lead.telefono.replace(/\D/g, "").endsWith(phoneDigits.slice(-10));
      return sameCedula || samePhone;
    });

    if (hasCompleted) {
      deleteLeadFromFile(draft.id);
      deleted += 1;
    }
  }
  return deleted;
}

async function deleteIncompleteDraftsForContact(
  client: DraftLookupClient,
  cedula: string,
  telefono: string,
): Promise<void> {
  const matchFilters = buildIncompleteMatchFilters(cedula, telefono);
  if (matchFilters.length === 0) return;

  await client.lead.deleteMany({
    where: {
      estado: "incompleto",
      OR: matchFilters,
    },
  });
}

/** Elimina borradores incompletos duplicados tras una solicitud enviada. */
export async function cleanupIncompleteDraftsForContact(
  cedula: string,
  telefono: string,
): Promise<void> {
  const forceFile = process.env.LEAD_STORE === "file";

  if (!forceFile) {
    try {
      await deleteIncompleteDraftsForContact(prisma, cedula, telefono);
      return;
    } catch (error) {
      if (!isDbConnectionError(error)) throw error;
    }
  }

  const phoneDigits = telefono.replace(/\D/g, "");
  const normalizedCedula = normalizeDocumentNumber(cedula);
  const leads = listLeadsFromFile();

  for (const lead of leads) {
    if (lead.estado !== "incompleto") continue;

    const sameCedula =
      normalizedCedula &&
      normalizedCedula !== "pendiente" &&
      lead.cedula === normalizedCedula;
    const samePhone =
      phoneDigits.length >= 10 &&
      lead.telefono.replace(/\D/g, "").endsWith(phoneDigits.slice(-10));

    if (sameCedula || samePhone) {
      deleteLeadFromFile(lead.id);
    }
  }
}

async function findDraftToUpdate(
  client: DraftLookupClient,
  draftId: string | undefined,
  cedula: string,
  telefono: string,
): Promise<{ id: string } | { finalized: true } | null> {
  if (draftId) {
    const byId = await client.lead.findUnique({
      where: { id: draftId },
      select: { id: true, estado: true },
    });
    if (byId?.estado === "incompleto") return { id: byId.id };
    // El borrador ya se convirtió en solicitud final: no crear otro incompleto.
    if (byId) return { finalized: true };
  }

  const matchFilters = buildIncompleteMatchFilters(cedula, telefono);
  if (matchFilters.length === 0) return null;

  const existing = await client.lead.findFirst({
    where: {
      estado: "incompleto",
      OR: matchFilters,
    },
    orderBy: { fechaActualizacion: "desc" },
    select: { id: true },
  });

  return existing?.id ? { id: existing.id } : null;
}

async function hasRecentFinalizedLead(
  client: DraftLookupClient,
  cedula: string,
  telefono: string,
  tipoCredito: string,
): Promise<boolean> {
  const matchFilters = buildIncompleteMatchFilters(cedula, telefono);
  if (matchFilters.length === 0) return false;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await client.lead.findFirst({
    where: {
      estado: { not: "incompleto" },
      tipoCredito,
      fechaCreacion: { gte: since },
      OR: matchFilters,
    },
    select: { id: true },
  });

  return Boolean(existing);
}

export async function dedupeIncompleteDrafts(
  client: DraftLookupClient,
  keepId: string,
  cedula: string,
  telefono: string,
): Promise<void> {
  const matchFilters = buildIncompleteMatchFilters(cedula, telefono);
  if (matchFilters.length === 0) return;

  await client.lead.deleteMany({
    where: {
      estado: "incompleto",
      id: { not: keepId },
      OR: matchFilters,
    },
  });
}

function findDraftToUpdateInFile(
  draftId: string | undefined,
  cedula: string,
  telefono: string,
): { id: string } | { finalized: true } | null {
  if (draftId) {
    const fileLead = getLeadFromFile(draftId);
    if (fileLead?.estado === "incompleto") return { id: fileLead.id };
    if (fileLead) return { finalized: true };
  }

  const phoneDigits = telefono.replace(/\D/g, "");
  const normalizedCedula = normalizeDocumentNumber(cedula);

  const match = listLeadsFromFile().find((lead) => {
    if (lead.estado !== "incompleto") return false;
    if (normalizedCedula && normalizedCedula !== "pendiente" && lead.cedula === normalizedCedula) {
      return true;
    }
    return phoneDigits.length >= 10 && lead.telefono.replace(/\D/g, "").endsWith(phoneDigits.slice(-10));
  });

  return match?.id ? { id: match.id } : null;
}

function hasRecentFinalizedLeadInFile(
  cedula: string,
  telefono: string,
  tipoCredito: string,
): boolean {
  const phoneDigits = telefono.replace(/\D/g, "");
  const normalizedCedula = normalizeDocumentNumber(cedula);
  const since = Date.now() - 24 * 60 * 60 * 1000;

  return listLeadsFromFile().some((lead) => {
    if (lead.estado === "incompleto") return false;
    if (lead.tipoCredito !== tipoCredito) return false;
    const createdAt = new Date(lead.fechaCreacion).getTime();
    if (!Number.isFinite(createdAt) || createdAt < since) return false;

    const sameCedula =
      normalizedCedula &&
      normalizedCedula !== "pendiente" &&
      lead.cedula === normalizedCedula;
    const samePhone =
      phoneDigits.length >= 10 &&
      lead.telefono.replace(/\D/g, "").endsWith(phoneDigits.slice(-10));

    return Boolean(sameCedula || samePhone);
  });
}

function dedupeIncompleteDraftsInFile(keepId: string, cedula: string, telefono: string): void {
  const phoneDigits = telefono.replace(/\D/g, "");
  const normalizedCedula = normalizeDocumentNumber(cedula);
  const leads = listLeadsFromFile();

  const duplicateIds = leads
    .filter((lead) => {
      if (lead.id === keepId || lead.estado !== "incompleto") return false;

      const sameCedula =
        normalizedCedula &&
        normalizedCedula !== "pendiente" &&
        lead.cedula === normalizedCedula;
      const samePhone =
        phoneDigits.length >= 10 &&
        lead.telefono.replace(/\D/g, "").endsWith(phoneDigits.slice(-10));

      return sameCedula || samePhone;
    })
    .map((lead) => lead.id);

  for (const id of duplicateIds) {
    deleteLeadFromFile(id);
  }
}

/** Persiste o actualiza un borrador. Retorna `null` si faltan datos mínimos de contacto. */
export async function saveDraftLead(input: SaveDraftLeadInput): Promise<SaveDraftLeadResult | null> {
  if (!tieneDatosMinimosContacto(input.values)) {
    return null;
  }

  const { telefono, cedula, nombre, email, tipoCredito } = pickContactFields(input.values);

  const utm = input.utm ?? {};
  const datosFormulario = buildDraftDatosFormulario(input.values, input.step);
  const progreso = datosFormulario._progreso;
  const summary = buildLeadSummaryFields(datosFormulario, "incompleto");

  const leadData = {
    tipoCredito,
    nombre,
    cedula,
    telefono,
    email,
    ...summary,
    datosFormulario: datosFormulario as Record<string, unknown>,
    origen: inferOrigen(utm),
    estado: "incompleto" as const,
    aceptaTerminos: false,
    fechaAceptacionTerminos: null,
    utmSource: utm.utmSource ?? null,
    utmCampaign: utm.utmCampaign ?? null,
    utmMedium: utm.utmMedium ?? null,
    utmTerm: utm.utmTerm ?? null,
    utmContent: utm.utmContent ?? null,
  };

  let existingDraftId: string | null = null;
  const normalizedCedula = normalizeDocumentNumber(cedula);

  const forceFile = process.env.LEAD_STORE === "file";

  if (!forceFile) {
    try {
      if (input.draftId) {
        const existingById = await prisma.lead.findUnique({
          where: { id: input.draftId },
          select: { id: true, estado: true },
        });
        if (existingById?.estado === "incompleto") {
          existingDraftId = existingById.id;
        }
      }

      if (!existingDraftId) {
        const matchFilters = buildIncompleteMatchFilters(cedula, telefono);
        if (matchFilters.length > 0) {
          const recentDraft = await prisma.lead.findFirst({
            where: {
              estado: "incompleto",
              tipoCredito,
              OR: matchFilters,
            },
            orderBy: { fechaActualizacion: "desc" },
            select: { id: true },
          });
          if (recentDraft) {
            existingDraftId = recentDraft.id;
          }
        }
      }

      const geoCandidate = existingDraftId ? {} : await geolocateByIp(input.ip ?? null);

      let finalOrigen = leadData.origen;
      let mergedDatos = datosFormulario as Record<string, unknown>;

      if (existingDraftId) {
        const currentData = await prisma.lead.findUnique({
          where: { id: existingDraftId },
          select: { origen: true, datosFormulario: true },
        });
        if (currentData?.origen === "witme") {
          finalOrigen = "witme";
        }
        if (
          currentData?.datosFormulario &&
          typeof currentData.datosFormulario === "object" &&
          !Array.isArray(currentData.datosFormulario)
        ) {
          mergedDatos = {
            ...(currentData.datosFormulario as Record<string, unknown>),
            ...mergedDatos,
          };
        }
      }

      const payload = {
        tipoCredito,
        nombre,
        cedula,
        telefono,
        email,
        ...summary,
        datosFormulario: mergedDatos as Prisma.InputJsonValue,
        origen: finalOrigen,
        estado: "incompleto" as const,
        aceptaTerminos: false,
        fechaAceptacionTerminos: null,
        utmSource: utm.utmSource ?? null,
        utmCampaign: utm.utmCampaign ?? null,
        utmMedium: utm.utmMedium ?? null,
        utmTerm: utm.utmTerm ?? null,
        utmContent: utm.utmContent ?? null,
        ip: input.ip ?? null,
        ciudad: geoCandidate.ciudad ?? null,
        pais: geoCandidate.pais ?? null,
        latitud: geoCandidate.latitud ?? null,
        longitud: geoCandidate.longitud ?? null,
      };

      const saved = existingDraftId
        ? await prisma.lead.update({
            where: { id: existingDraftId },
            data: payload,
          })
        : await prisma.lead.create({ data: payload });

      return {
        id: saved.id,
        porcentajeCompletado: progreso.porcentaje,
        pasoActual: progreso.pasoActual,
        storage: "database",
      };
    } catch (error) {
      console.error("[saveDraftLead] database error, falling back to file:", error);
    }
  }

  const existing = findDraftToUpdateInFile(input.draftId, cedula, telefono);
  if (existing && "finalized" in existing) {
    return null;
  }

  const existingId = existing?.id ?? null;
  if (!existingId && hasRecentFinalizedLeadInFile(cedula, telefono, tipoCredito)) {
    return null;
  }

  const geoFromIp = existingId ? {} : await geolocateByIp(input.ip ?? null);
  const filePayload = {
    ...leadData,
    ip: input.ip ?? null,
    ciudad: geoFromIp.ciudad ?? null,
    pais: geoFromIp.pais ?? null,
    latitud: geoFromIp.latitud ?? null,
    longitud: geoFromIp.longitud ?? null,
  };

  if (existingId) {
    const updated = updateLeadInFile(existingId, filePayload);
    if (updated) {
      dedupeIncompleteDraftsInFile(updated.id, cedula, telefono);
      return {
        id: updated.id,
        porcentajeCompletado: progreso.porcentaje,
        pasoActual: progreso.pasoActual,
        storage: "file",
      };
    }
  }

  const created = saveLeadToFile(filePayload);
  dedupeIncompleteDraftsInFile(created.id, cedula, telefono);
  return {
    id: created.id,
    porcentajeCompletado: progreso.porcentaje,
    pasoActual: progreso.pasoActual,
    storage: "file",
  };
}
