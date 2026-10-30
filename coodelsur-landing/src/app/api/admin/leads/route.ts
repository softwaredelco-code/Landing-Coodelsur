import { prisma } from "@/infrastructure/database/prisma";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/infrastructure/auth/require-admin";
import {
  getLeadFromFile,
  isDbConnectionError,
  isTransientDbError,
  listLeadsFromFile,
  updateLeadInFile,
} from "@/infrastructure/persistence/file-store";
import { mapLeadListRow } from "@/domain/lead/lead-summary";
import { parseMonthRange } from "@/application/lead/fetch-leads-for-export";
import { triggerWitmePostbackForLead } from "@/application/tracking/witme-postback";

const estadoCountsCache = new Map<
  string,
  { counts: Record<string, number>; timestamp: number }
>();
const CACHE_TTL_MS = 15_000;

function getEstadosForFilter(estado: string): string[] {
  if (estado === "completo") return ["completo", "recibido"];
  if (estado === "por_contactar") return ["por_contactar", "revisado", "contactado"];
  if (estado === "rechazado_no_cumple") return ["rechazado_no_cumple", "descartado"];
  return [estado];
}

function computeTotalFromCounts(
  estadoCounts: Record<string, number>,
  estado: string | null,
): number {
  if (!estado) {
    return Object.values(estadoCounts).reduce((acc, curr) => acc + curr, 0);
  }
  const matchingEstados = getEstadosForFilter(estado);
  return matchingEstados.reduce((acc, key) => acc + (estadoCounts[key] ?? 0), 0);
}

async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === 1 && isTransientDbError(err)) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw err;
    }
  }
  throw new Error("DB retry exhausted");
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? 50), 100);
  const skip = Math.max(Number(searchParams.get("skip") ?? 0), 0);
  const estado = searchParams.get("estado")?.trim() || null;
  const tipo = searchParams.get("tipoCredito")?.trim() || null;
  const origen = searchParams.get("origen")?.trim() || null;
  const q = searchParams.get("q")?.trim()?.toLowerCase() || null;
  const mes = searchParams.get("mes")?.trim() || null;
  const fechaCreacionRange = parseMonthRange(mes);

  try {
    const allowedEstados = estado ? getEstadosForFilter(estado) : null;
    const estadoFilter = allowedEstados
      ? allowedEstados.length === 1
        ? (allowedEstados[0] as any)
        : ({ in: allowedEstados } as any)
      : undefined;

    const whereWithoutEstado = {
      ...(tipo ? { tipoCredito: tipo } : {}),
      ...(origen ? { origen } : {}),
      ...(fechaCreacionRange ? { fechaCreacion: fechaCreacionRange } : {}),
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

    const where = {
      ...whereWithoutEstado,
      ...(estadoFilter ? { estado: estadoFilter } : {}),
    };

    const cacheKey = `${mes ?? ""}|${tipo ?? ""}|${origen ?? ""}|${q ?? ""}`;
    let estadoCounts: Record<string, number>;
    const now = Date.now();
    const cached = estadoCountsCache.get(cacheKey);

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      estadoCounts = cached.counts;
    } else {
      const estadoGroups = await withDbRetry(() =>
        prisma.lead.groupBy({
          by: ["estado"],
          where: whereWithoutEstado,
          _count: { id: true },
        }),
      );
      estadoCounts = Object.fromEntries(
        estadoGroups.map((row) => [row.estado, row._count.id]),
      );
      if (estadoCountsCache.size > 30) {
        estadoCountsCache.clear();
      }
      estadoCountsCache.set(cacheKey, { counts: estadoCounts, timestamp: now });
    }

    const leads = await withDbRetry(() =>
      prisma.lead.findMany({
        where,
        orderBy: [{ fechaActualizacion: "desc" }, { fechaCreacion: "desc" }],
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
          fechaActualizacion: true,
          capitalSolicitado: true,
          progresoFormulario: true,
          pasoActualFormulario: true,
        },
      }),
    );

    const total = computeTotalFromCounts(estadoCounts, estado);

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
    if (!isDbConnectionError(error)) {
      console.error("[GET /api/admin/leads]", error);
      return NextResponse.json(
        { error: "No se pudieron consultar las solicitudes en este momento" },
        { status: 500 },
      );
    }

    let leads = listLeadsFromFile();
    if (tipo) leads = leads.filter((l) => l.tipoCredito === tipo);
    if (origen) leads = leads.filter((l) => l.origen === origen);
    if (fechaCreacionRange) {
      leads = leads.filter((l) => {
        const d = new Date(l.fechaCreacion);
        return d >= fechaCreacionRange.gte && d < fechaCreacionRange.lt;
      });
    }
    if (q) {
      leads = leads.filter(
        (l) =>
          l.nombre.toLowerCase().includes(q) ||
          l.cedula.includes(q) ||
          l.telefono.includes(q) ||
          (l.email ?? "").toLowerCase().includes(q),
      );
    }

    const estadoCounts = leads.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.estado] = (acc[lead.estado] ?? 0) + 1;
      return acc;
    }, {});

    if (estado) {
      const allowed = getEstadosForFilter(estado);
      leads = leads.filter((l) => allowed.includes(l.estado));
    }

    const total = leads.length;
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
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    estado?: string;
    montoAprobado?: number | string | null;
  };
  const leadId = body.id?.trim();
  const leadEstado = body.estado?.trim();

  if (!leadId || (!leadEstado && body.montoAprobado === undefined)) {
    return NextResponse.json({ error: "id y al menos estado o montoAprobado requeridos" }, { status: 400 });
  }

  let parsedMontoAprobado: number | null | undefined = undefined;
  if (body.montoAprobado !== undefined) {
    if (body.montoAprobado === null || body.montoAprobado === "") {
      parsedMontoAprobado = null;
    } else {
      const num = Number(body.montoAprobado);
      if (!isNaN(num) && num >= 0) {
        parsedMontoAprobado = Math.round(num);
      }
    }
  }

  try {
    const previousLead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { estado: true, datosFormulario: true },
    });

    if (!previousLead) {
      return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    }

    const currentDatos =
      previousLead.datosFormulario && typeof previousLead.datosFormulario === "object"
        ? (previousLead.datosFormulario as Record<string, unknown>)
        : {};

    const updatedDatos = { ...currentDatos };
    if (parsedMontoAprobado !== undefined) {
      updatedDatos.montoAprobado = parsedMontoAprobado;
      updatedDatos.fechaAprobacionMonto =
        parsedMontoAprobado !== null ? new Date().toISOString() : null;
    }

    const updateData: Record<string, unknown> = {};
    if (leadEstado) updateData.estado = leadEstado as any;
    if (parsedMontoAprobado !== undefined) updateData.datosFormulario = updatedDatos as any;

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData as any,
    });
    estadoCountsCache.clear();

    if (leadEstado === "desembolsado" && previousLead?.estado !== "desembolsado") {
      void triggerWitmePostbackForLead(leadId).catch((err) => {
        console.error(`[PATCH /api/admin/leads] Error en postback witme (${leadId}):`, err);
      });
    }

    return NextResponse.json({ success: true, lead, source: "database" });
  } catch (error) {
    if (isDbConnectionError(error) || getLeadFromFile(leadId)) {
      const prevFileLead = getLeadFromFile(leadId);
      if (!prevFileLead) {
        return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
      }

      const currentDatos =
        prevFileLead.datosFormulario && typeof prevFileLead.datosFormulario === "object"
          ? (prevFileLead.datosFormulario as Record<string, unknown>)
          : {};

      const updatedDatos = { ...currentDatos };
      if (parsedMontoAprobado !== undefined) {
        updatedDatos.montoAprobado = parsedMontoAprobado;
        updatedDatos.fechaAprobacionMonto =
          parsedMontoAprobado !== null ? new Date().toISOString() : null;
      }

      const fileUpdate: Record<string, unknown> = {};
      if (leadEstado) fileUpdate.estado = leadEstado;
      if (parsedMontoAprobado !== undefined) fileUpdate.datosFormulario = updatedDatos;

      const lead = updateLeadInFile(leadId, fileUpdate);
      if (!lead) {
        return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
      }
      estadoCountsCache.clear();

      if (leadEstado === "desembolsado" && prevFileLead?.estado !== "desembolsado") {
        void triggerWitmePostbackForLead(leadId).catch((err) => {
          console.error(`[PATCH /api/admin/leads] Error en postback witme file (${leadId}):`, err);
        });
      }

      return NextResponse.json({ success: true, lead, source: "file" });
    }
    throw error;
  }
}
