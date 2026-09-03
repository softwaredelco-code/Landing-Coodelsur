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

async function findDraftToUpdate(
  client: DraftLookupClient,
  draftId: string | undefined,
  cedula: string,
  telefono: string,
): Promise<string | null> {
  if (draftId) {
    const byId = await client.lead.findUnique({
      where: { id: draftId },
      select: { id: true, estado: true },
    });
    if (byId?.estado === "incompleto") return byId.id;
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

  return existing?.id ?? null;
}

async function dedupeIncompleteDrafts(
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
): string | null {
  if (draftId) {
    const fileLead = getLeadFromFile(draftId);
    if (fileLead?.estado === "incompleto") return fileLead.id;
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

  return match?.id ?? null;
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

  const forceFile = process.env.LEAD_STORE === "file";

  if (!forceFile) {
    try {
      // Geolocalización fuera de la transacción (fetch externo puede superar 5 s).
      const geoCandidate = await geolocateByIp(input.ip ?? null);

      const lead = await prisma.$transaction(
        async (tx) => {
          const existingId = await findDraftToUpdate(tx, input.draftId, cedula, telefono);
          const geoFromIp = existingId ? {} : geoCandidate;

          const payload = {
            ...leadData,
            ip: input.ip ?? null,
            ciudad: geoFromIp.ciudad ?? null,
            pais: geoFromIp.pais ?? null,
            latitud: geoFromIp.latitud ?? null,
            longitud: geoFromIp.longitud ?? null,
            datosFormulario: leadData.datosFormulario as Prisma.InputJsonValue,
          };

          const saved = existingId
            ? await tx.lead.update({
                where: { id: existingId },
                data: payload,
              })
            : await tx.lead.create({ data: payload });

          await dedupeIncompleteDrafts(tx, saved.id, cedula, telefono);
          return saved;
        },
        { timeout: 15_000 },
      );

      return {
        id: lead.id,
        porcentajeCompletado: progreso.porcentaje,
        pasoActual: progreso.pasoActual,
        storage: "database",
      };
    } catch (error) {
      if (!isDbConnectionError(error)) throw error;
    }
  }

  const existingId = findDraftToUpdateInFile(input.draftId, cedula, telefono);
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
