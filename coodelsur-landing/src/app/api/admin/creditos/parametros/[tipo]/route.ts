import { adminUnauthorizedResponse, isAdminRequest } from "@/infrastructure/auth/require-admin";
import {
  PRODUCTOS_PARAMETRIZABLES,
  parametrosUpdateSchema,
  resetCreditoParametros,
  updateCreditoParametros,
  type ProductoParametrizable,
} from "@/infrastructure/database/parametros-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface RouteContext {
  params: { tipo: string };
}

function isProductoParametrizable(value: string): value is ProductoParametrizable {
  return PRODUCTOS_PARAMETRIZABLES.some((item) => item.tipo === value);
}

export async function PUT(request: Request, context: RouteContext) {
  if (!isAdminRequest(request)) return adminUnauthorizedResponse();

  const tipo = context.params.tipo;
  if (!isProductoParametrizable(tipo)) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as unknown;
    const parsed = parametrosUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const parametros = await updateCreditoParametros(tipo, parsed.data);
    return NextResponse.json({ parametros });
  } catch (error) {
    console.error("[admin/creditos/parametros PUT]", error);
    return NextResponse.json({ error: "No se pudieron guardar los parámetros" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  if (!isAdminRequest(request)) return adminUnauthorizedResponse();

  const tipo = context.params.tipo;
  if (!isProductoParametrizable(tipo)) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "reset") {
    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  }

  try {
    const parametros = await resetCreditoParametros(tipo);
    return NextResponse.json({ parametros });
  } catch (error) {
    console.error("[admin/creditos/parametros reset]", error);
    return NextResponse.json({ error: "No se pudo restaurar" }, { status: 500 });
  }
}
