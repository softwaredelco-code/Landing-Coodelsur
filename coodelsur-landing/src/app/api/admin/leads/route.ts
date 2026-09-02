import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminToken, readCookie } from "@/lib/admin/auth";
import {
  getLeadFromFile,
  isDbConnectionError,
  listLeadsFromFile,
  updateLeadEstadoInFile,
} from "@/lib/leads/file-store";
import { mapLeadListRow } from "@/lib/leads/lead-summary";
import type { LeadEstado } from "@prisma/client";

function requireAdmin(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
  return isValidAdminToken(token, password);
}

export async function GET(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? 50), 100);
  const skip = Math.max(Number(searchParams.get("skip") ?? 0), 0);
  const estado = searchParams.get("estado") as LeadEstado | null;
  const tipo = searchParams.get("tipoCredito");
  const q = searchParams.get("q")?.trim()?.toLowerCase();

  try {
    const where = {
      ...(estado ? { estado } : {}),
      ...(tipo ? { tipoCredito: tipo } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: "insensitive" as const } },
              { cedula: { contains: q } },
              { telefono: { contains: q } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { fechaCreacion: "desc" },
        take,
        skip,
        select: {
          id: true,
          tipoCredito: true,
          nombre: true,
          cedula: true,
          telefono: true,
          email: true,
          origen: true,
          estado: true,
          aceptaTerminos: true,
          ciudad: true,
          fechaCreacion: true,
          capitalSolicitado: true,
          progresoFormulario: true,
          pasoActualFormulario: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json(
      {
        leads: leads.map(mapLeadListRow),
        total,
        take,
        skip,
        source: "database",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    let leads = listLeadsFromFile();
    if (estado) leads = leads.filter((l) => l.estado === estado);
    if (tipo) leads = leads.filter((l) => l.tipoCredito === tipo);
    if (q) {
      leads = leads.filter(
        (l) =>
          l.nombre.toLowerCase().includes(q) ||
          l.cedula.includes(q) ||
          l.telefono.includes(q) ||
          (l.email ?? "").toLowerCase().includes(q),
      );
    }
    const total = leads.length;
    return NextResponse.json({
      leads: leads.slice(skip, skip + take).map(mapLeadListRow),
      total,
      take,
      skip,
      source: "file",
    });
  }
}

export async function PATCH(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; estado?: LeadEstado };
  if (!body.id || !body.estado) {
    return NextResponse.json({ error: "id y estado requeridos" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.update({
      where: { id: body.id },
      data: { estado: body.estado },
    });
    return NextResponse.json({ success: true, lead, source: "database" });
  } catch (error) {
    if (!isDbConnectionError(error) && getLeadFromFile(body.id)) {
      // id existe en archivo aunque el error no sea de conexión
    }
    if (isDbConnectionError(error) || getLeadFromFile(body.id)) {
      const lead = updateLeadEstadoInFile(body.id, body.estado);
      if (!lead) {
        return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
      }
      return NextResponse.json({ success: true, lead, source: "file" });
    }
    throw error;
  }
}
