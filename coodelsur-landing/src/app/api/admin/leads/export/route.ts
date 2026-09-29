import { adminUnauthorizedResponse, isAdminRequest } from "@/infrastructure/auth/require-admin";
import {
  buildExportFilename,
  buildLeadsExcelBuffer,
} from "@/application/lead/export-leads-excel";
import { fetchLeadsForExport } from "@/application/lead/fetch-leads-for-export";
import type { LeadEstado } from "@prisma/client";
import { NextResponse } from "next/server";

/**
 * Exporta solicitudes a Excel (.xlsx).
 *
 * Query params:
 * - `ids` — UUIDs separados por coma (exportación de filas seleccionadas)
 * - `q`, `estado`, `tipoCredito` — mismos filtros del listado (informe general)
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return adminUnauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids")?.trim();
    const ids = idsParam
      ? idsParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined;
    const estado = searchParams.get("estado")?.trim() || null;
    const tipoCredito = searchParams.get("tipoCredito")?.trim() || null;
    const origen = searchParams.get("origen")?.trim() || null;
    const q = searchParams.get("q")?.trim() || null;

    const leads = await fetchLeadsForExport({
      ids,
      estado,
      tipoCredito,
      origen,
      q,
    });

    if (leads.length === 0) {
      return NextResponse.json(
        { error: "No hay solicitudes para exportar con los criterios indicados" },
        { status: 404 },
      );
    }

    const buffer = buildLeadsExcelBuffer(leads);
    const scope = ids?.length ? "selected" : "report";
    const filename = buildExportFilename(scope);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/leads/export]", error);
    const message =
      error instanceof Error ? error.message : "Error al generar el archivo Excel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
