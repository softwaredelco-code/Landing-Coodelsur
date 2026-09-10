/**
 * Proyección liviana de un lead para el detalle del panel admin.
 *
 * Evita enviar el JSON completo al navegador: expone campos resumen,
 * metadatos de adjuntos (sin binarios) y select Prisma reutilizable.
 *
 * @see GET /api/admin/leads/[id] — adjuntos se cargan bajo demanda
 */
import { buildAdminAttachments } from "@/domain/lead/attachments";
import type { AdminAttachment } from "@/domain/lead/attachments";
import { buildAdminLeadSections, buildAdminWitmeExtraSection, type AdminLeadSection } from "@/application/lead/admin-lead-sections";
import {
  extractCapitalSolicitado,
  extractPasoActualFormulario,
  extractProgresoFormulario,
} from "@/domain/lead/lead-summary";

export interface AdminLeadDomicilio {
  departamento: string | null;
  municipio: string | null;
  sectorDomicilio: string | null;
  direccion: string | null;
  barrio: string | null;
  /** Dirección legible: calle, barrio, municipio, departamento */
  direccionCompleta: string | null;
}

export interface AdminLeadGeoPoint {
  lat: number;
  lng: number;
}

export interface AdminLeadDetail {
  id: string;
  tipoCredito: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string | null;
  origen: string;
  estado: string;
  aceptaTerminos: boolean;
  fechaAceptacionTerminos: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  ciudad: string | null;
  pais: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaCreacion: string;
  capitalSolicitado: number | null;
  valorCuota: number | null;
  cantidadCuotas: number | string | null;
  progresoFormulario: number | null;
  pasoActualFormulario: string | null;
  domicilio: AdminLeadDomicilio;
  /** GPS capturado en el formulario (permiso del navegador) */
  geoFormulario: AdminLeadGeoPoint | null;
  secciones: AdminLeadSection[];
  adjuntos: AdminAttachment[];
}

interface LeadDetailSource {
  id: string;
  tipoCredito: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string | null;
  origen: string;
  estado: string;
  aceptaTerminos: boolean;
  fechaAceptacionTerminos: Date | string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  ciudad: string | null;
  pais: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaCreacion: Date | string;
  capitalSolicitado?: number | null;
  progresoFormulario?: number | null;
  pasoActualFormulario?: string | null;
  datosFormulario: unknown;
}

function toIsoDate(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toIsoDateRequired(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function readDatosString(datos: Record<string, unknown>, key: string): string | null {
  const value = datos[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function extractGeoFormulario(datos: Record<string, unknown>): AdminLeadGeoPoint | null {
  const geo = datos.geolocalizacion;
  if (!geo || typeof geo !== "object") return null;
  const lat = (geo as { lat?: unknown }).lat;
  const lng = (geo as { lng?: unknown }).lng;
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return { lat, lng };
  }
  return null;
}

function extractDomicilio(datos: Record<string, unknown>): AdminLeadDomicilio {
  const departamento = readDatosString(datos, "departamento");
  const municipio = readDatosString(datos, "municipio");
  const sectorDomicilio = readDatosString(datos, "sectorDomicilio");
  const direccion = readDatosString(datos, "direccion");
  const barrio = readDatosString(datos, "barrio");
  const direccionCompleta =
    [direccion, barrio, municipio, departamento].filter(Boolean).join(", ") || null;

  return {
    departamento,
    municipio,
    sectorDomicilio,
    direccion,
    barrio,
    direccionCompleta,
  };
}

/** Respuesta liviana para el detalle admin (sin enviar el JSON completo al navegador). */
export function mapLeadToAdminDetail(
  lead: LeadDetailSource,
  adjuntos?: AdminAttachment[],
): AdminLeadDetail {
  const datos =
    lead.datosFormulario && typeof lead.datosFormulario === "object"
      ? (lead.datosFormulario as Record<string, unknown>)
      : {};

  const valorCuotaRaw = datos.valorCuota;
  const valorCuota =
    typeof valorCuotaRaw === "number" && Number.isFinite(valorCuotaRaw) && valorCuotaRaw > 0
      ? valorCuotaRaw
      : null;

  const cantidadCuotas = datos.cantidadCuotas;
  const cuotasNormalized =
    typeof cantidadCuotas === "number" || typeof cantidadCuotas === "string"
      ? cantidadCuotas
      : null;

  const secciones = buildAdminLeadSections(datos);
  const witmeExtra = buildAdminWitmeExtraSection(datos);
  if (witmeExtra) secciones.push(witmeExtra);

  return {
    id: lead.id,
    tipoCredito: lead.tipoCredito,
    nombre: lead.nombre,
    cedula: lead.cedula,
    telefono: lead.telefono,
    email: lead.email,
    origen: lead.origen,
    estado: lead.estado,
    aceptaTerminos: lead.aceptaTerminos,
    fechaAceptacionTerminos: toIsoDate(lead.fechaAceptacionTerminos),
    utmSource: lead.utmSource,
    utmCampaign: lead.utmCampaign,
    ciudad: lead.ciudad,
    pais: lead.pais,
    latitud: lead.latitud,
    longitud: lead.longitud,
    fechaCreacion: toIsoDateRequired(lead.fechaCreacion),
    capitalSolicitado: lead.capitalSolicitado ?? extractCapitalSolicitado(datos),
    valorCuota,
    cantidadCuotas: cuotasNormalized,
    progresoFormulario: lead.progresoFormulario ?? extractProgresoFormulario(datos),
    pasoActualFormulario: lead.pasoActualFormulario ?? extractPasoActualFormulario(datos),
    domicilio: extractDomicilio(datos),
    geoFormulario: extractGeoFormulario(datos),
    secciones,
    adjuntos: adjuntos ?? buildAdminAttachments(lead.id, datos),
  };
}

export const ADMIN_LEAD_DETAIL_SELECT = {
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
  ciudad: true,
  pais: true,
  latitud: true,
  longitud: true,
  fechaCreacion: true,
  capitalSolicitado: true,
  progresoFormulario: true,
  pasoActualFormulario: true,
  datosFormulario: true,
} as const;
