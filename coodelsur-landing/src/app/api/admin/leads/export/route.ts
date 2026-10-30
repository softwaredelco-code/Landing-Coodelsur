import { adminUnauthorizedResponse, isAdminRequest } from "@/infrastructure/auth/require-admin";
import {
  buildExportFilename,
  buildLeadsExcelBuffer,
} from "@/application/lead/export-leads-excel";
import { fetchLeadsForExport, MAX_LEADS_EXPORT } from "@/application/lead/fetch-leads-for-export";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Exporta solicitudes a Excel (.xlsx) o JSON para generación en cliente.
 *
 * Query params:
 * - `format` — "json" para obtener payload estructurado rápido, omitir para .xlsx directo
 * - `take`, `skip` — paginación opcional por lotes para evitar límites de memoria/503 en cPanel
 * - `ids` — UUIDs separados por coma (exportación de filas seleccionadas)
 * - `q`, `estado`, `tipoCredito`, `origen`, `mes` — filtros del listado (informe general)
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return adminUnauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format")?.trim()?.toLowerCase();
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
    const mes = searchParams.get("mes")?.trim() || null;

    const takeParam = searchParams.get("take");
    const skipParam = searchParams.get("skip");
    const take =
      takeParam !== null && !isNaN(Number(takeParam)) && Number(takeParam) > 0
        ? Math.min(Number(takeParam), MAX_LEADS_EXPORT)
        : undefined;
    const skip =
      skipParam !== null && !isNaN(Number(skipParam)) && Number(skipParam) >= 0
        ? Number(skipParam)
        : undefined;

    const leads = await fetchLeadsForExport({
      ids,
      estado,
      tipoCredito,
      origen,
      q,
      mes,
      take,
      skip,
    });

    const scope = ids?.length ? "selected" : "report";
    const filename = buildExportFilename(scope, mes);

    if (leads.length === 0) {
      if (format === "json" && skip && skip > 0) {
        return NextResponse.json({
          leads: [],
          filename,
          total: 0,
        });
      }
      return NextResponse.json(
        { error: "No hay solicitudes para exportar con los criterios indicados" },
        { status: 404 },
      );
    }

    if (format === "json") {
      return NextResponse.json({
        leads,
        filename,
        total: leads.length,
      });
    }

    const buffer = buildLeadsExcelBuffer(leads);

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
