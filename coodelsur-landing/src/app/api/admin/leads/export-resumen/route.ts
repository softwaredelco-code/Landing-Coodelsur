import {
  buildResumenExcelBuffer,
  buildResumenFilename,
  calcularDatosResumen,
} from "@/application/lead/export-resumen-excel";
import { parseMonthRange } from "@/application/lead/fetch-leads-for-export";
import { adminUnauthorizedResponse, isAdminRequest } from "@/infrastructure/auth/require-admin";
import { prisma } from "@/infrastructure/database/prisma";
import {
  isDbConnectionError,
  isTransientDbError,
  listLeadsFromFile,
} from "@/infrastructure/persistence/file-store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Genera el informe resumen de solicitudes por Estado y Producto en Excel o JSON.
 * Query params:
 * - `tipoCredito` — slug del producto (ej: "microcredito_small", "microcredito_urbano", "libranza")
 * - `origen` — canal de captación (ej: "witme", "directo")
 * - `mes` — período YYYY-MM
 * - `format` — "json" para previsualización / construcción en cliente, omitir para .xlsx
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return adminUnauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const tipoCredito = searchParams.get("tipoCredito")?.trim() || null;
    const origen = searchParams.get("origen")?.trim() || null;
    const mes = searchParams.get("mes")?.trim() || null;
    const format = searchParams.get("format")?.trim()?.toLowerCase();

    const fechaRange = parseMonthRange(mes);
    const where = {
      ...(tipoCredito ? { tipoCredito } : {}),
      ...(origen ? { origen } : {}),
      ...(fechaRange ? { fechaCreacion: fechaRange } : {}),
    };

    let countsByEstado: Record<string, number> = {};

    try {
      let groups;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          groups = await prisma.lead.groupBy({
            by: ["estado"],
            where,
            _count: { id: true },
          });
          break;
        } catch (err) {
          if (attempt === 1 && isTransientDbError(err)) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          throw err;
        }
      }

      countsByEstado = Object.fromEntries(
        (groups ?? []).map((group) => [group.estado, group._count.id]),
      );
    } catch (dbError) {
      if (!isDbConnectionError(dbError)) throw dbError;

      // Fallback a almacenamiento local en JSON
      let fileLeads = listLeadsFromFile();
      if (tipoCredito) {
        fileLeads = fileLeads.filter((l) => l.tipoCredito === tipoCredito);
      }
      if (origen) {
        fileLeads = fileLeads.filter((l) => l.origen === origen);
      }
      if (fechaRange) {
        fileLeads = fileLeads.filter((l) => {
          const date = new Date(l.fechaCreacion);
          return date >= fechaRange.gte && date < fechaRange.lt;
        });
      }

      for (const lead of fileLeads) {
        countsByEstado[lead.estado] = (countsByEstado[lead.estado] ?? 0) + 1;
      }
    }

    const data = calcularDatosResumen({
      tipoCredito,
      origen,
      mes,
      countsByEstado,
    });

    const filename = buildResumenFilename(tipoCredito, mes);

    if (format === "json") {
      return NextResponse.json({
        ...data,
        filename,
      });
    }

    const buffer = buildResumenExcelBuffer(data);

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
    console.error("[GET /api/admin/leads/export-resumen]", error);
    const message =
      error instanceof Error ? error.message : "Error al generar el informe de estados";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
