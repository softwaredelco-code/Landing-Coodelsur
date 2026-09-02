import { saveDraftLead } from "@/lib/leads/save-draft-lead";
import { getClientIp } from "@/lib/utils";
import type { UtmParams } from "@/types/credito";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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
