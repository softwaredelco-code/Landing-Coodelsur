import { NextResponse } from "next/server";
import {
  adminForbiddenResponse,
  adminUnauthorizedResponse,
  getAdminSession,
  isSistemasRequest,
} from "@/infrastructure/auth/require-admin";
import {
  crearUsuario,
  listarUsuarios,
} from "@/application/usuario/usuario-service";

export async function GET(request: Request) {
  const session = getAdminSession(request);
  if (!session) {
    return adminUnauthorizedResponse();
  }

  if (!isSistemasRequest(request)) {
    return adminForbiddenResponse();
  }

  try {
    const usuarios = await listarUsuarios();
    return NextResponse.json({ usuarios });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al consultar usuarios";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = getAdminSession(request);
  if (!session) {
    return adminUnauthorizedResponse();
  }

  if (!isSistemasRequest(request)) {
    return adminForbiddenResponse();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { usuario, nombre, password, rol, activo } = body;

    const nuevoUsuario = await crearUsuario({
      usuario,
      nombre,
      password,
      rol,
      activo,
    });

    return NextResponse.json({ success: true, usuario: nuevoUsuario }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear usuario";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
