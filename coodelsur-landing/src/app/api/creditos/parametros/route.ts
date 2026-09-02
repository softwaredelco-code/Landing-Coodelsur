import { getPublicParametrosMap } from "@/lib/credito/parametros-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Parámetros de amortización activos (formulario público). */
export async function GET() {
  try {
    const parametros = await getPublicParametrosMap();
    return NextResponse.json(
      { parametros },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error("[creditos/parametros]", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los parámetros de crédito" },
      { status: 500 },
    );
  }
}
