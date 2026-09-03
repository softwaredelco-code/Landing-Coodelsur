import { NextResponse } from "next/server";
import {
  buildAdminCookie,
  clearAdminCookie,
  isValidAdminToken,
  readCookie,
  ADMIN_COOKIE,
  signAdminToken,
} from "@/infrastructure/auth/auth";

export async function POST(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: "Admin no configurado" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string; action?: string };

  if (body.action === "logout") {
    const res = NextResponse.json({ success: true });
    res.headers.set("Set-Cookie", clearAdminCookie());
    return res;
  }

  if (!body.password || body.password !== password) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const token = signAdminToken(password);
  const res = NextResponse.json({ success: true });
  res.headers.set("Set-Cookie", buildAdminCookie(token));
  return res;
}

export async function GET(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.json({ authenticated: false });
  }
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
  return NextResponse.json({ authenticated: isValidAdminToken(token, password) });
}
