import { adminUnauthorizedResponse, isAdminRequest } from "@/infrastructure/auth/require-admin";
import { listCreditoParametrosRecords } from "@/infrastructure/database/parametros-store";
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
