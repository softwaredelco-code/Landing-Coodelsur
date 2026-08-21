import { Prisma, type LeadEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { geolocateByIp } from "@/lib/geo/ipapi";
import { processFileFields } from "@/lib/storage/upload";
import { inferOrigen } from "@/lib/tracking/utm";
import { normalizeDocumentNumber } from "@/lib/identity/cedula";
import {
  isDbConnectionError,
  saveLeadToFile,
  type StoredLead,
} from "@/lib/leads/file-store";
import type { LeadPayload, UtmParams } from "@/types/credito";

interface CreateLeadInput extends Omit<LeadPayload, "ip"> {
  ip?: string | null;
  aceptaTerminos?: boolean;
  fechaAceptacionTerminos?: string | null;
  estado?: LeadEstado;
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
    estado: input.estado ?? "recibido",
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
  const geoFromIp = await geolocateByIp(input.ip ?? null);
  const processedData = await processFileFields(input.datosFormulario);

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

  const forceFile = process.env.LEAD_STORE === "file";

  if (!forceFile) {
    try {
      const lead = await prisma.lead.create({
        data: {
          tipoCredito: input.tipoCredito,
          nombre: input.nombre,
          cedula: input.cedula,
          telefono: input.telefono,
          email: input.email || null,
          datosFormulario: processedData as Prisma.InputJsonValue,
          origen: input.origen || inferOrigen(utm),
          estado: input.estado ?? "recibido",
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
      });

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

  const fileLead = toFileLead(input, processedData, geo, utm, aceptaTerminos, fechaOk);
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
