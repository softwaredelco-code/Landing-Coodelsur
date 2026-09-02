import { adminUnauthorizedResponse, isAdminRequest } from "@/lib/admin/require-admin";
import { listCreditoParametrosRecords } from "@/lib/credito/parametros-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorizedResponse();

  try {
    const parametros = await listCreditoParametrosRecords();
    return NextResponse.json({ parametros });
  } catch (error) {
    console.error("[admin/creditos/parametros]", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los parámetros" },
      { status: 500 },
    );
  }
}
