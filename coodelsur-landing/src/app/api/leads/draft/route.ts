import { prisma } from "@/infrastructure/database/prisma";
import { getLeadFromFile, isDbConnectionError } from "@/infrastructure/persistence/file-store";
import { saveDraftLead } from "@/application/lead/save-draft-lead";
import { getClientIp } from "@/shared/utils";
import type { UtmParams } from "@/shared/types/credito";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim() || searchParams.get("draftId")?.trim();

    if (!id) {
      return NextResponse.json({ error: "id o draftId requerido" }, { status: 400 });
    }

    const forceFile = process.env.LEAD_STORE === "file";
    let lead: {
      id: string;
      nombre: string;
      cedula: string;
      telefono: string;
      email: string | null;
      tipoCredito: string;
      estado: string;
      origen: string;
      datosFormulario: unknown;
    } | null = null;

    if (!forceFile) {
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
            estado: true,
            origen: true,
            datosFormulario: true,
          },
        });
      } catch (error) {
        if (!isDbConnectionError(error)) throw error;
      }
    }

    if (!lead) {
      const fileLead = getLeadFromFile(id);
      if (fileLead) {
        lead = {
          id: fileLead.id,
          nombre: fileLead.nombre,
          cedula: fileLead.cedula,
          telefono: fileLead.telefono,
          email: fileLead.email,
          tipoCredito: fileLead.tipoCredito,
          estado: fileLead.estado,
          origen: fileLead.origen,
          datosFormulario: fileLead.datosFormulario,
        };
      }
    }

    if (!lead) {
      return NextResponse.json({ error: "Borrador no encontrado" }, { status: 404 });
    }

    if (lead.estado !== "incompleto") {
      return NextResponse.json({
        found: true,
        completed: true,
        draftId: lead.id,
        estado: lead.estado,
        message: "Esta solicitud ya fue completada exitosamente.",
      });
    }

    return NextResponse.json({
      found: true,
      draftId: lead.id,
      lead: {
        id: lead.id,
        nombre: lead.nombre,
        cedula: lead.cedula,
        telefono: lead.telefono,
        email: lead.email,
        tipoCredito: lead.tipoCredito,
        estado: lead.estado,
        origen: lead.origen,
        values: lead.datosFormulario,
      },
    });
  } catch (error) {
    console.error("[GET /api/leads/draft]", error);
    return NextResponse.json({ error: "Error al consultar borrador" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      draftId?: string;
      step?: number;
      values?: Record<string, unknown>;
      utm?: UtmParams;
    };

    if (!body.values || typeof body.values !== "object") {
      return NextResponse.json({ error: "values requerido" }, { status: 400 });
    }

    const step = typeof body.step === "number" ? body.step : 0;
    const ip = getClientIp(request);

    const result = await saveDraftLead({
      draftId: body.draftId,
      step,
      values: body.values,
      utm: body.utm,
      ip,
    });

    if (!result) {
      return NextResponse.json(
        { saved: false, reason: "Datos insuficientes para guardar borrador" },
        { status: 200 },
      );
    }

    return NextResponse.json({
      saved: true,
      draftId: result.id,
      porcentajeCompletado: result.porcentajeCompletado,
      pasoActual: result.pasoActual,
      storage: result.storage,
    });
  } catch (error) {
    console.error("[POST /api/leads/draft]", error);
    return NextResponse.json({ error: "No se pudo guardar el borrador" }, { status: 500 });
  }
}
