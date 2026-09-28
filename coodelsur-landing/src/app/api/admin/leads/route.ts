import { prisma } from "@/infrastructure/database/prisma";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminToken, readCookie } from "@/infrastructure/auth/auth";
import {
  getLeadFromFile,
  isDbConnectionError,
  listLeadsFromFile,
  updateLeadEstadoInFile,
} from "@/infrastructure/persistence/file-store";
import { mapLeadListRow } from "@/domain/lead/lead-summary";
import type { LeadEstado } from "@prisma/client";

function requireAdmin(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
  return isValidAdminToken(token, password);
}

let cachedEstadoCounts: { counts: Record<string, number>; timestamp: number } | null = null;
const CACHE_TTL_MS = 20_000;

export async function GET(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? 50), 100);
  const skip = Math.max(Number(searchParams.get("skip") ?? 0), 0);
  const estado = searchParams.get("estado")?.trim() || null;
  const tipo = searchParams.get("tipoCredito");
  const origen = searchParams.get("origen")?.trim();
  const q = searchParams.get("q")?.trim()?.toLowerCase();

  try {
    const estadoFilter = estado
      ? estado === "completo"
        ? { in: ["completo", "recibido"] as any }
        : estado === "por_contactar"
          ? { in: ["por_contactar", "revisado", "contactado"] as any }
          : estado === "rechazado_no_cumple"
            ? { in: ["rechazado_no_cumple", "descartado"] as any }
            : (estado as any)
      : undefined;

    const hasFilters = Boolean(estadoFilter || tipo || origen || q);

    const where = {
      ...(estadoFilter ? { estado: estadoFilter } : {}),
      ...(tipo ? { tipoCredito: tipo } : {}),
      ...(origen ? { origen } : {}),
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

    // Obtener estadoCounts usando caché en memoria
    let estadoCounts: Record<string, number>;
    const now = Date.now();
    if (cachedEstadoCounts && now - cachedEstadoCounts.timestamp < CACHE_TTL_MS) {
      estadoCounts = cachedEstadoCounts.counts;
    } else {
      const estadoGroups = await prisma.lead.groupBy({
        by: ["estado"],
        _count: { id: true },
      });
      estadoCounts = Object.fromEntries(
        estadoGroups.map((row) => [row.estado, row._count.id]),
      );
      cachedEstadoCounts = { counts: estadoCounts, timestamp: now };
    }

    const leadsQuery = prisma.lead.findMany({
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
    });

    let leads;
    let total: number;

    if (hasFilters) {
      const [fetchedLeads, count] = await Promise.all([
        leadsQuery,
        prisma.lead.count({ where }),
      ]);
      leads = fetchedLeads;
      total = count;
    } else {
      leads = await leadsQuery;
      total = Object.values(estadoCounts).reduce((acc, curr) => acc + curr, 0);
    }

    return NextResponse.json(
      {
        leads: leads.map(mapLeadListRow),
        total,
        take,
        skip,
        estadoCounts,
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
    if (origen) leads = leads.filter((l) => l.origen === origen);
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
    const estadoCounts = leads.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.estado] = (acc[lead.estado] ?? 0) + 1;
      return acc;
    }, {});
    return NextResponse.json({
      leads: leads.slice(skip, skip + take).map(mapLeadListRow),
      total,
      take,
      skip,
      estadoCounts,
      source: "file",
    });
  }
}

export async function PATCH(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { id?: string; estado?: string };
  const leadId = body.id?.trim();
  const leadEstado = body.estado?.trim();

  if (!leadId || !leadEstado) {
    return NextResponse.json({ error: "id y estado requeridos" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { estado: leadEstado as any },
    });
    cachedEstadoCounts = null;
    return NextResponse.json({ success: true, lead, source: "database" });
  } catch (error) {
    if (isDbConnectionError(error) || getLeadFromFile(leadId)) {
      const lead = updateLeadEstadoInFile(leadId, leadEstado);
      if (!lead) {
        return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
      }
      cachedEstadoCounts = null;
      return NextResponse.json({ success: true, lead, source: "file" });
    }
    throw error;
  }
}
