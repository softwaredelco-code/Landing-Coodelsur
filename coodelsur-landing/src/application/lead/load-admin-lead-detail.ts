/**
 * Carga eficiente de un lead para el detalle admin.
 * Excluye binarios pesados del JSON principal y resuelve URLs de adjuntos en paralelo.
 */
import { mapLeadToAdminDetail, type AdminLeadDetail } from "@/application/lead/admin-lead-detail";
import {
  buildAdminAttachmentsFromMeta,
  LEAD_ATTACHMENT_FIELDS,
} from "@/domain/lead/attachments";
import { getLeadFromFile, isDbConnectionError } from "@/infrastructure/persistence/file-store";
import { primeLeadFormularioCache } from "@/application/lead/load-lead-attachment";
import { prisma } from "@/infrastructure/database/prisma";

interface AdminLeadDetailRow {
  id: string;
  tipoCredito: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string | null;
  origen: string;
  estado: string;
  aceptaTerminos: boolean;
  fechaAceptacionTerminos: Date | null;
  utmSource: string | null;
  utmCampaign: string | null;
  ciudad: string | null;
  pais: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaCreacion: Date;
  capitalSolicitado: number | null;
  progresoFormulario: number | null;
  pasoActualFormulario: string | null;
  datosFormulario: unknown;
  cedulaFrontal: unknown;
  cedulaReverso: unknown;
  videoVerificacion: unknown;
  firma: unknown;
}

function mergeDatosForMapping(
  lightweightDatos: unknown,
  attachments: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    lightweightDatos && typeof lightweightDatos === "object"
      ? { ...(lightweightDatos as Record<string, unknown>) }
      : {};

  for (const field of LEAD_ATTACHMENT_FIELDS) {
    if (attachments[field] !== null && attachments[field] !== undefined) {
      base[field] = attachments[field];
    }
  }

  return base;
}

export async function loadLeadForAdminDetail(id: string): Promise<AdminLeadDetail | null> {
  try {
    const rows = await prisma.$queryRaw<AdminLeadDetailRow[]>`
      SELECT
        id,
        "tipoCredito",
        nombre,
        cedula,
        telefono,
        email,
        origen,
        estado::text AS estado,
        "aceptaTerminos",
        "fechaAceptacionTerminos",
        "utmSource",
        "utmCampaign",
        ciudad,
        pais,
        latitud,
        longitud,
        "fechaCreacion",
        "capitalSolicitado",
        "progresoFormulario",
        "pasoActualFormulario",
        (
          "datosFormulario"::jsonb
          - 'cedulaFrontal'
          - 'cedulaReverso'
          - 'videoVerificacion'
          - 'firma'
        ) AS "datosFormulario",
        "datosFormulario"->'cedulaFrontal' AS "cedulaFrontal",
        "datosFormulario"->'cedulaReverso' AS "cedulaReverso",
        "datosFormulario"->'videoVerificacion' AS "videoVerificacion",
        "datosFormulario"->'firma' AS firma
      FROM "Lead"
      WHERE id = ${id}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;

    const rawAttachments: Record<string, unknown> = {
      cedulaFrontal: row.cedulaFrontal,
      cedulaReverso: row.cedulaReverso,
      videoVerificacion: row.videoVerificacion,
      firma: row.firma,
    };

    primeLeadFormularioCache(id, {
      ...(row.datosFormulario && typeof row.datosFormulario === "object"
        ? (row.datosFormulario as Record<string, unknown>)
        : {}),
      ...rawAttachments,
    });

    const attachmentFields = {
      cedulaFrontal: rawAttachments.cedulaFrontal,
      cedulaReverso: rawAttachments.cedulaReverso,
      videoVerificacion: rawAttachments.videoVerificacion,
      firma: rawAttachments.firma,
    };

    const adjuntos = await buildAdminAttachmentsFromMeta(id, attachmentFields);
    const datosFormulario = mergeDatosForMapping(row.datosFormulario, rawAttachments);

    return mapLeadToAdminDetail(
      {
        id: row.id,
        tipoCredito: row.tipoCredito,
        nombre: row.nombre,
        cedula: row.cedula,
        telefono: row.telefono,
        email: row.email,
        origen: row.origen,
        estado: row.estado,
        aceptaTerminos: row.aceptaTerminos,
        fechaAceptacionTerminos: row.fechaAceptacionTerminos,
        utmSource: row.utmSource,
        utmCampaign: row.utmCampaign,
        ciudad: row.ciudad,
        pais: row.pais,
        latitud: row.latitud,
        longitud: row.longitud,
        fechaCreacion: row.fechaCreacion,
        capitalSolicitado: row.capitalSolicitado,
        progresoFormulario: row.progresoFormulario,
        pasoActualFormulario: row.pasoActualFormulario,
        datosFormulario,
      },
      adjuntos,
    );
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;
  }

  const fileLead = getLeadFromFile(id);
  if (!fileLead) return null;
  return mapLeadToAdminDetail(fileLead);
}
