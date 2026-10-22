import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  readCookie,
  verifySessionToken,
  SessionUser,
} from "@/infrastructure/auth/auth";

export type { SessionUser };

/**
 * Obtiene la sesión del usuario actual desde la cookie si es válida.
 */
export function getAdminSession(request: Request): SessionUser | null {
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
  return verifySessionToken(token);
}

/**
 * Comprueba si la petición tiene sesión admin válida (cualquier rol activo).
 */
export function isAdminRequest(request: Request): boolean {
  return getAdminSession(request) !== null;
}

/**
 * Comprueba si la petición pertenece exclusivamente al rol 'sistemas'.
 */
export function isSistemasRequest(request: Request): boolean {
  const session = getAdminSession(request);
  return session !== null && session.rol === "sistemas";
}

export function adminUnauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

export function adminForbiddenResponse(
  message = "Acceso denegado: esta sección solo puede ser gestionada por el usuario de sistemas.",
): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}
