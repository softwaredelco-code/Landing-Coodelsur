import { adminUnauthorizedResponse, isAdminRequest } from "@/infrastructure/auth/require-admin";
import {
  buildAnalisisFileName,
  buildLeadAnalisisExcelBuffer,
} from "@/application/lead/export-lead-analisis-excel";
import { prisma } from "@/infrastructure/database/prisma";
import { getLeadFromFile, isDbConnectionError } from "@/infrastructure/persistence/file-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface RouteParams {
  params: { id: string };
}

/**
 * Descarga el análisis de crédito individual en formato Excel (.xlsx).
 * Genera exclusivamente la hoja "Analisis" oficial con los datos del lead.
 */
export async function GET(request: Request, { params }: RouteParams) {
  if (!isAdminRequest(request)) {
    return adminUnauthorizedResponse();
  }

  try {
    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "ID de solicitud no proporcionado" }, { status: 400 });
    }

    let lead: {
      id: string;
      nombre: string;
      cedula: string;
      telefono: string;
      email: string | null;
      tipoCredito: string;
      capitalSolicitado?: number | null;
      datosFormulario: unknown;
      fechaCreacion: Date | string;
    } | null = null;

    try {
      lead = await prisma.lead.findUnique({
        where: { id },
        select: {
          id: true,
          nombre: true,
          cedula: true,
          telefono: true,
          email: true,
          tipoCredito: true,
          capitalSolicitado: true,
          datosFormulario: true,
          fechaCreacion: true,
        },
      });
    } catch (dbErr) {
      if (!isDbConnectionError(dbErr)) throw dbErr;
      lead = getLeadFromFile(id);
    }

    if (!lead) {
      lead = getLeadFromFile(id);
    }

    if (!lead) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    const buffer = await buildLeadAnalisisExcelBuffer({
      id: lead.id,
      nombre: lead.nombre,
      cedula: lead.cedula,
      telefono: lead.telefono,
      email: lead.email,
      tipoCredito: lead.tipoCredito,
      capitalSolicitado: lead.capitalSolicitado ?? null,
      fechaCreacion: lead.fechaCreacion,
      datosFormulario: lead.datosFormulario as Record<string, unknown> | null,
    });

    const filename = buildAnalisisFileName(lead.nombre, lead.cedula);
    const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_");
    const encodedFilename = encodeURIComponent(filename);

    return new Response(new Uint8Array(buffer) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/leads/[id]/analisis-excel]", error);
    const message =
      error instanceof Error ? error.message : "Error al generar el análisis en Excel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
