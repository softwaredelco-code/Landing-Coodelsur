import { prisma } from "@/infrastructure/database/prisma";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/infrastructure/auth/require-admin";
import {
  getLeadFromFile,
  isDbConnectionError,
  listLeadsFromFile,
  updateLeadEstadoInFile,
  updateLeadInFile,
} from "@/infrastructure/persistence/file-store";
import { mapLeadListRow } from "@/domain/lead/lead-summary";
import { parseMonthRange } from "@/application/lead/fetch-leads-for-export";
import { triggerWitmePostbackForLead } from "@/application/tracking/witme-postback";
import type { LeadEstado } from "@prisma/client";

let cachedEstadoCounts: { counts: Record<string, number>; timestamp: number } | null = null;
const CACHE_TTL_MS = 20_000;

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? 50), 100);
  const skip = Math.max(Number(searchParams.get("skip") ?? 0), 0);
  const estado = searchParams.get("estado")?.trim() || null;
  const tipo = searchParams.get("tipoCredito");
  const origen = searchParams.get("origen")?.trim();
  const q = searchParams.get("q")?.trim()?.toLowerCase();
  const mes = searchParams.get("mes")?.trim() || null;
  const fechaCreacionRange = parseMonthRange(mes);

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

    const hasFilters = Boolean(estadoFilter || tipo || origen || q || fechaCreacionRange);

    const where = {
      ...(estadoFilter ? { estado: estadoFilter } : {}),
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
    cachedEstadoCounts = null;

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
      cachedEstadoCounts = null;

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

