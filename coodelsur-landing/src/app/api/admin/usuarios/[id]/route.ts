import { NextResponse } from "next/server";
import {
  adminForbiddenResponse,
  adminUnauthorizedResponse,
  getAdminSession,
  isSistemasRequest,
} from "@/infrastructure/auth/require-admin";
import {
  actualizarUsuario,
  eliminarUsuario,
} from "@/application/usuario/usuario-service";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = getAdminSession(request);
  if (!session) {
    return adminUnauthorizedResponse();
  }

  if (!isSistemasRequest(request)) {
    return adminForbiddenResponse();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const updated = await actualizarUsuario(params.id, body, session.id);
    return NextResponse.json({ success: true, usuario: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar usuario";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = getAdminSession(request);
  if (!session) {
    return adminUnauthorizedResponse();
  }

  if (!isSistemasRequest(request)) {
    return adminForbiddenResponse();
  }

  try {
    const result = await eliminarUsuario(params.id, session.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al eliminar usuario";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
