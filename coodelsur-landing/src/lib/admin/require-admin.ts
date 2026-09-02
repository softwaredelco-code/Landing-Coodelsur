import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminToken, readCookie } from "@/lib/admin/auth";

/** Comprueba si la petición tiene sesión admin válida. */
export function isAdminRequest(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
  return isValidAdminToken(token, password);
}

export function adminUnauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}
