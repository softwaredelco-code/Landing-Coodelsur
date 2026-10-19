import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminToken, readCookie } from "@/infrastructure/auth/auth";
import { triggerWitmePostbackForLead } from "@/application/tracking/witme-postback";

function requireAdmin(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
  return isValidAdminToken(token, password);
}

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const leadId = params.id?.trim();
  if (!leadId) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  try {
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
