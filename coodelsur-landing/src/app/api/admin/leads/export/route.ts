import { adminUnauthorizedResponse, isAdminRequest } from "@/lib/admin/require-admin";
import {
  buildExportFilename,
  buildLeadsExcelBuffer,
} from "@/lib/leads/export-leads-excel";
import { fetchLeadsForExport } from "@/lib/leads/fetch-leads-for-export";
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

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids")?.trim();
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;
  const estado = searchParams.get("estado") as LeadEstado | null;
  const tipoCredito = searchParams.get("tipoCredito");
  const q = searchParams.get("q");

  const leads = await fetchLeadsForExport({
    ids,
    estado: estado || null,
    tipoCredito: tipoCredito || null,
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

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
