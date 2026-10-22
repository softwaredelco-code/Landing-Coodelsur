import { NextResponse } from "next/server";
import {
  buildAdminCookie,
  clearAdminCookie,
  signSessionToken,
} from "@/infrastructure/auth/auth";
import { getAdminSession } from "@/infrastructure/auth/require-admin";
import { authenticateUsuario } from "@/application/usuario/usuario-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      usuario?: string;
      password?: string;
      action?: string;
    };

    if (body.action === "logout") {
      const res = NextResponse.json({ success: true });
      res.headers.set("Set-Cookie", clearAdminCookie());
      return res;
    }

    let sessionUser;

    if (body.usuario && body.password) {
      sessionUser = await authenticateUsuario({
        usuario: body.usuario,
        password: body.password,
      });
    } else if (body.password && process.env.ADMIN_PASSWORD && body.password === process.env.ADMIN_PASSWORD) {
      // Fallback legado si se envía solo la contraseña maestra de entorno
      sessionUser = {
        id: "legacy-admin",
        usuario: "sistemas",
        nombre: "Administrador de Sistemas",
        rol: "sistemas" as const,
      };
    } else {
      return NextResponse.json(
        { error: "Debe ingresar el usuario y la contraseña" },
        { status: 400 },
      );
    }

    const token = signSessionToken(sessionUser);
    const res = NextResponse.json({ success: true, user: sessionUser });
    res.headers.set("Set-Cookie", buildAdminCookie(token));
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error de autenticación";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function GET(request: Request) {
  const session = getAdminSession(request);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }
  return NextResponse.json({ authenticated: true, user: session });
}
