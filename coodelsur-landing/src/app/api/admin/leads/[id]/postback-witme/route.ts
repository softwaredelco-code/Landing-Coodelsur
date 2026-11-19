import { NextResponse } from "next/server";
import { isAdminRequest } from "@/infrastructure/auth/require-admin";
import { triggerWitmePostbackForLead } from "@/application/tracking/witme-postback";
import { prisma } from "@/infrastructure/database/prisma";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const leadId = params.id?.trim();
  if (!leadId) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  let customWitmeId: string | undefined;
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (body && typeof body === "object") {
      const candidate = body.witme_id || body.witmeLeadId || body.witmeId || body.cid;
      if (typeof candidate === "string" && candidate.trim()) {
        customWitmeId = candidate.trim();
      }
    }
  } catch {}

  try {
    if (customWitmeId) {
      const existing = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { datosFormulario: true },
      });
      if (existing) {
        const datos = (existing.datosFormulario || {}) as Record<string, unknown>;
        datos.witme_id = customWitmeId;
        datos.witmeLeadId = customWitmeId;
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            origen: "witme",
            datosFormulario: datos as any,
          },
        });
      }
    }

    const result = await triggerWitmePostbackForLead(leadId, true);
    if (!result) {
      return NextResponse.json(
        { error: "La solicitud no cuenta con un ID de Witme (witme_id) para enviar postback." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error) {
    console.error(`[POST /api/admin/leads/${leadId}/postback-witme]`, error);
    return NextResponse.json(
      { error: "Error interno al ejecutar el postback de Witme" },
      { status: 500 },
    );
  }
}
