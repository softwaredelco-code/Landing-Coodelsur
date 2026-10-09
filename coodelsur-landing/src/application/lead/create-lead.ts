/**
 * Creación y finalización de solicitudes de crédito (`Lead`).
 *
 * Orquesta geolocalización, subida de adjuntos a Supabase Storage, campos
 * resumen para el admin y persistencia en PostgreSQL. Si la DB no responde,
 * cae en `data/leads.json` (solo desarrollo; ver `LEAD_STORE`).
 *
 * @see POST /api/leads — endpoint HTTP
 * @see save-draft-lead.ts — borradores incompletos que se promueven a `recibido`
 */
import { Prisma, type LeadEstado } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { geolocateByIp } from "@/infrastructure/geo/ipapi";
import { buildLeadSummaryFields } from "@/domain/lead/lead-summary-fields";
import { processFileFields } from "@/infrastructure/storage/upload";
import { inferOrigen } from "@/presentation/tracking/utm";
import { normalizeDocumentNumber } from "@/domain/identity/cedula";
import { withTimeout } from "@/shared/utils";
import {
  getLeadFromFile,
  isDbConnectionError,
  saveLeadToFile,
  updateLeadInFile,
  type StoredLead,
} from "@/infrastructure/persistence/file-store";
import {
  cleanupIncompleteDraftsForContact,
  dedupeIncompleteDrafts,
  findIncompleteLeadIdForContact,
} from "@/application/lead/save-draft-lead";
import type { LeadPayload, UtmParams, GeoLocation } from "@/shared/types/credito";

interface CreateLeadInput extends Omit<LeadPayload, "ip"> {
  ip?: string | null;
  aceptaTerminos?: boolean;
  fechaAceptacionTerminos?: string | null;
  estado?: LeadEstado;
  draftLeadId?: string | null;
  /** Si es true, falla en vez de guardar la solicitud sin un video de verificación válido. */
  exigirVideo?: boolean;
}

/** Un video es válido si quedó en Storage (url) o inline como data URL. */
function tieneVideoValido(datos: Record<string, unknown>): boolean {
  const video = datos.videoVerificacion as Record<string, unknown> | undefined;
  if (!video || typeof video !== "object") return false;
  if (typeof video.url === "string" && video.url.startsWith("http")) return true;
  return typeof video.preview === "string" && video.preview.startsWith("data:") && video.preview.length > 1000;
}

type LeadResult = {
  id: string;
  tipoCredito: string;
  nombre: string;
  storage?: "database" | "file";
};

function toFileLead(input: CreateLeadInput, processedData: Record<string, unknown>, geo: {
  ciudad?: string;
  pais?: string;
  latitud?: number;
  longitud?: number;
}, utm: UtmParams, aceptaTerminos: boolean, fechaAceptacionTerminos: Date | null): StoredLead {
  return saveLeadToFile({
    tipoCredito: input.tipoCredito,
    nombre: input.nombre,
    cedula: input.cedula,
    telefono: input.telefono,
    email: input.email || null,
    datosFormulario: processedData,
    origen: input.origen || inferOrigen(utm),
    estado: input.estado ?? "por_contactar",
    aceptaTerminos,
    fechaAceptacionTerminos: fechaAceptacionTerminos?.toISOString() ?? null,
    utmSource: utm.utmSource ?? null,
    utmCampaign: utm.utmCampaign ?? null,
    utmMedium: utm.utmMedium ?? null,
    utmTerm: utm.utmTerm ?? null,
    utmContent: utm.utmContent ?? null,
    ip: input.ip ?? null,
    ciudad: geo.ciudad ?? null,
    pais: geo.pais ?? null,
    latitud: geo.latitud ?? null,
    longitud: geo.longitud ?? null,
  });
}

/**
 * Persiste un lead.
 * 1) Intenta PostgreSQL (Prisma)
 * 2) Si la DB no responde, guarda en `data/leads.json` para no bloquear la presentación
 */
export async function createLead(input: CreateLeadInput): Promise<LeadResult> {
  const hasGeoFromClient = Boolean(
    input.geo?.ciudad ||
      (input.geo?.latitud != null && input.geo?.longitud != null),
  );

  const [geoFromIp, processedData] = await Promise.all([
    hasGeoFromClient ? Promise.resolve({} as GeoLocation) : geolocateByIp(input.ip ?? null),
    withTimeout(
      processFileFields(input.datosFormulario),
      25_000,
      "Tiempo agotado al procesar los archivos adjuntos",
    ).catch((error) => {
      console.warn(
        "[createLead] processFileFields demoró o falló; procediendo con datos originales sin bloquear:",
        error instanceof Error ? error.message : error,
      );
      return input.datosFormulario;
    }),
  ]);

  if (input.exigirVideo && !tieneVideoValido(processedData)) {
    throw new Error(
      "No se pudo guardar el video de verificación. Por favor graba o adjunta el video nuevamente y presiona 'Enviar solicitud'.",
    );
  }

  const geo = {
    ciudad: geoFromIp.ciudad,
    pais: geoFromIp.pais,
    latitud: input.geo?.latitud ?? geoFromIp.latitud,
    longitud: input.geo?.longitud ?? geoFromIp.longitud,
  };

  const utm = input.utm ?? {};
  const aceptaTerminos = Boolean(
    input.aceptaTerminos ?? processedData.aceptaTerminos === true,
  );
  const fechaRaw =
    input.fechaAceptacionTerminos ??
    (typeof processedData.fechaAceptacionTerminos === "string"
      ? processedData.fechaAceptacionTerminos
      : null);
  const fechaAceptacionTerminos = fechaRaw ? new Date(fechaRaw) : null;
  const fechaOk =
    fechaAceptacionTerminos && !Number.isNaN(fechaAceptacionTerminos.getTime())
      ? fechaAceptacionTerminos
      : null;
  const estadoFinal = input.estado ?? "completo";
  const summary = buildLeadSummaryFields(processedData, estadoFinal);

  const forceFile = process.env.LEAD_STORE === "file";

  if (!forceFile) {
    try {
      let promoteDraftId = input.draftLeadId ?? null;
      if (promoteDraftId) {
        const existing = await prisma.lead.findUnique({
          where: { id: promoteDraftId },
          select: { id: true, estado: true },
        });
        if (existing?.estado !== "incompleto") {
          promoteDraftId = null;
        }
      }

      if (!promoteDraftId) {
        promoteDraftId = await findIncompleteLeadIdForContact(
          input.cedula,
          input.telefono,
          null,
        );
      }

      if (promoteDraftId) {
        const existingLead = await prisma.lead.findUnique({
          where: { id: promoteDraftId },
          select: { origen: true, datosFormulario: true },
        });

        const finalOrigen =
          input.origen ||
          (existingLead?.origen === "witme" ? "witme" : inferOrigen(utm));

        const existingDatos =
          typeof existingLead?.datosFormulario === "object" && existingLead.datosFormulario !== null
            ? (existingLead.datosFormulario as Record<string, unknown>)
            : {};

        const mergedDatos: Record<string, unknown> = {
          ...existingDatos,
          ...processedData,
        };

        // Si el borrador ya tenía los archivos completos y el payload final envió
        // una referencia liviana ("attached-in-draft") para evitar timeouts 503,
        // preservamos el archivo original del borrador.
        for (const fileField of ["videoVerificacion", "cedulaFrontal", "cedulaReverso", "firma"]) {
          const existingFile = existingDatos[fileField] as Record<string, unknown> | undefined;
          const newFile = processedData[fileField] as Record<string, unknown> | undefined;
          if (existingFile && newFile) {
            const newPreview = typeof newFile.preview === "string" ? newFile.preview : "";
            if (newPreview === "attached-in-draft" || (!newPreview.startsWith("data:") && !newFile.url)) {
              mergedDatos[fileField] = existingFile;
            }
          }
        }

        const lead = await withTimeout(
          prisma.lead.update({
            where: { id: promoteDraftId },
            data: {
              tipoCredito: input.tipoCredito,
              nombre: input.nombre,
              cedula: input.cedula,
              telefono: input.telefono,
              email: input.email || null,
              ...summary,
              datosFormulario: mergedDatos as Prisma.InputJsonValue,
              origen: finalOrigen,
              estado: estadoFinal,
              aceptaTerminos,
              fechaAceptacionTerminos: fechaOk,
              utmSource: utm.utmSource ?? null,
              utmCampaign: utm.utmCampaign ?? null,
              utmMedium: utm.utmMedium ?? null,
              utmTerm: utm.utmTerm ?? null,
              utmContent: utm.utmContent ?? null,
              ip: input.ip ?? null,
              ciudad: geo.ciudad ?? null,
              pais: geo.pais ?? null,
              latitud: geo.latitud ?? null,
              longitud: geo.longitud ?? null,
            },
          }),
          10_000,
          "Tiempo agotado al guardar la solicitud en base de datos",
        );

        if (estadoFinal !== "incompleto") {
          await cleanupIncompleteDraftsForContact(input.cedula, input.telefono);
        } else {
          await dedupeIncompleteDrafts(prisma, lead.id, input.cedula, input.telefono);
        }

        return {
          id: lead.id,
          tipoCredito: lead.tipoCredito,
          nombre: lead.nombre,
          storage: "database",
        };
      }

      const lead = await withTimeout(
        prisma.lead.create({
          data: {
            tipoCredito: input.tipoCredito,
            nombre: input.nombre,
            cedula: input.cedula,
            telefono: input.telefono,
            email: input.email || null,
            ...summary,
            datosFormulario: processedData as Prisma.InputJsonValue,
            origen: input.origen || inferOrigen(utm),
            estado: estadoFinal,
            aceptaTerminos,
            fechaAceptacionTerminos: fechaOk,
            utmSource: utm.utmSource ?? null,
            utmCampaign: utm.utmCampaign ?? null,
            utmMedium: utm.utmMedium ?? null,
            utmTerm: utm.utmTerm ?? null,
            utmContent: utm.utmContent ?? null,
            ip: input.ip ?? null,
            ciudad: geo.ciudad ?? null,
            pais: geo.pais ?? null,
            latitud: geo.latitud ?? null,
            longitud: geo.longitud ?? null,
          },
        }),
        10_000,
        "Tiempo agotado al guardar la solicitud en base de datos",
      );

      if (estadoFinal !== "incompleto") {
        await cleanupIncompleteDraftsForContact(input.cedula, input.telefono);
      } else {
        await dedupeIncompleteDrafts(prisma, lead.id, input.cedula, input.telefono);
      }

      return { id: lead.id, tipoCredito: lead.tipoCredito, nombre: lead.nombre, storage: "database" };
    } catch (error) {
      if (!isDbConnectionError(error)) {
        throw error;
      }
      console.warn(
        "[createLead] PostgreSQL no disponible. Usando almacenamiento local data/leads.json",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (input.draftLeadId) {
    const existing = getLeadFromFile(input.draftLeadId);
    if (existing?.estado === "incompleto") {
      const updated = updateLeadInFile(input.draftLeadId, {
        tipoCredito: input.tipoCredito,
        nombre: input.nombre,
        cedula: input.cedula,
        telefono: input.telefono,
        email: input.email || null,
        datosFormulario: processedData,
        origen: input.origen || inferOrigen(utm),
        estado: input.estado ?? "por_contactar",
        aceptaTerminos,
        fechaAceptacionTerminos: fechaOk?.toISOString() ?? null,
        utmSource: utm.utmSource ?? null,
        utmCampaign: utm.utmCampaign ?? null,
        utmMedium: utm.utmMedium ?? null,
        utmTerm: utm.utmTerm ?? null,
        utmContent: utm.utmContent ?? null,
        ip: input.ip ?? null,
        ciudad: geo.ciudad ?? null,
        pais: geo.pais ?? null,
        latitud: geo.latitud ?? null,
        longitud: geo.longitud ?? null,
      });
      if (updated) {
        if (estadoFinal !== "incompleto") {
          await cleanupIncompleteDraftsForContact(input.cedula, input.telefono);
        }
        return {
          id: updated.id,
          tipoCredito: updated.tipoCredito,
          nombre: updated.nombre,
          storage: "file",
        };
      }
    }
  }

  const fileLead = toFileLead(input, processedData, geo, utm, aceptaTerminos, fechaOk);
  if (estadoFinal !== "incompleto") {
    await cleanupIncompleteDraftsForContact(input.cedula, input.telefono);
  }
  return {
    id: fileLead.id,
    tipoCredito: fileLead.tipoCredito,
    nombre: fileLead.nombre,
    storage: "file",
  };
}

export function extractLeadFromFormBody(body: Record<string, unknown>, utm?: UtmParams | null) {
  const {
    tipoCredito,
    nombre,
    cedula,
    telefono,
    email,
    geoCliente,
    geolocalizacion,
    utm: _utmBody,
    aceptaTerminos,
    fechaAceptacionTerminos,
    ...rest
  } = body as Record<string, unknown> & {
    tipoCredito: LeadPayload["tipoCredito"];
    nombre: string;
    cedula: string;
    telefono: string;
    email?: string;
    geoCliente?: { lat: number; lng: number };
    geolocalizacion?: { lat: number; lng: number };
    aceptaTerminos?: boolean;
    fechaAceptacionTerminos?: string;
  };

  const coreFields = new Set([
    "tipoCredito",
    "nombre",
    "cedula",
    "telefono",
    "email",
    "utm",
    "geoCliente",
    "draftLeadId",
  ]);

  const datosFormulario: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (!coreFields.has(key)) {
      datosFormulario[key] = value;
    }
  }

  if (typeof aceptaTerminos === "boolean") {
    datosFormulario.aceptaTerminos = aceptaTerminos;
  }
  if (fechaAceptacionTerminos) {
    datosFormulario.fechaAceptacionTerminos = fechaAceptacionTerminos;
  }

  datosFormulario.resultadoNodos = "automatico";

  const coords = geoCliente ?? geolocalizacion;

  return {
    tipoCredito,
    nombre,
    cedula: normalizeDocumentNumber(cedula) || String(cedula).trim(),
    telefono,
    email,
    datosFormulario,
    origen: inferOrigen(utm ?? null) as LeadPayload["origen"],
    utm: utm ?? undefined,
    geo: coords ? { latitud: coords.lat, longitud: coords.lng } : undefined,
    aceptaTerminos: aceptaTerminos === true,
    fechaAceptacionTerminos: fechaAceptacionTerminos ?? null,
  };
}
