import { loadLeadForAdminDetail } from "@/application/lead/load-admin-lead-detail";
import { deleteLead } from "@/application/lead/delete-lead";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/infrastructure/auth/require-admin";
import { prisma } from "@/infrastructure/database/prisma";
import {
  getLeadFromFile,
  isDbConnectionError,
  updateLeadInFile,
} from "@/infrastructure/persistence/file-store";
import { triggerWitmePostbackForLead } from "@/application/tracking/witme-postback";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const lead = await loadLeadForAdminDetail(params.id);
  if (!lead) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(
    { lead, source: "database" },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const leadId = params.id;
  if (!leadId) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    montoAprobado?: number | string | null;
    estado?: string;
    datosBancariosConfirmados?: {
      cuentaConfirmada: boolean;
      tipoCuentaConfirmada?: string | null;
      entidadBancariaConfirmada?: string | null;
      numeroCuentaConfirmada?: string | null;
    } | null;
  };

  let parsedMontoAprobado: number | null | undefined = undefined;
  if (body.montoAprobado !== undefined) {
    if (body.montoAprobado === null || body.montoAprobado === "") {
      parsedMontoAprobado = null;
    } else {
      const num = Number(body.montoAprobado);
      if (isNaN(num) || num < 0) {
        return NextResponse.json(
          { error: "El monto aprobado debe ser un número válido mayor o igual a 0" },
          { status: 400 },
        );
      }
      parsedMontoAprobado = Math.round(num);
    }
  }

  let parsedBancarios:
    | {
        cuentaConfirmada: boolean;
        tipoCuentaConfirmada: string | null;
        entidadBancariaConfirmada: string | null;
        numeroCuentaConfirmada: string | null;
        fechaConfirmacionCuenta: string | null;
      }
    | undefined = undefined;

  if (body.datosBancariosConfirmados !== undefined) {
    if (body.datosBancariosConfirmados === null || !body.datosBancariosConfirmados.cuentaConfirmada) {
      parsedBancarios = {
        cuentaConfirmada: false,
        tipoCuentaConfirmada: null,
        entidadBancariaConfirmada: null,
        numeroCuentaConfirmada: null,
        fechaConfirmacionCuenta: null,
      };
    } else {
      const tipo = String(body.datosBancariosConfirmados.tipoCuentaConfirmada ?? "").trim();
      const entidad = String(body.datosBancariosConfirmados.entidadBancariaConfirmada ?? "").trim();
      const numero = String(body.datosBancariosConfirmados.numeroCuentaConfirmada ?? "").trim();

      if (!tipo || !entidad || !numero) {
        return NextResponse.json(
          { error: "Completa el tipo de cuenta, la entidad bancaria y el número de cuenta o llave para confirmar." },
          { status: 400 },
        );
      }

      parsedBancarios = {
        cuentaConfirmada: true,
        tipoCuentaConfirmada: tipo,
        entidadBancariaConfirmada: entidad,
        numeroCuentaConfirmada: numero,
        fechaConfirmacionCuenta: new Date().toISOString(),
      };
    }
  }

  const nuevoEstado = body.estado?.trim();

  try {
    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, datosFormulario: true, estado: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const currentDatos =
      existing.datosFormulario && typeof existing.datosFormulario === "object"
        ? (existing.datosFormulario as Record<string, unknown>)
        : {};

    const updatedDatos: Record<string, unknown> = {
      ...currentDatos,
    };

    if (parsedMontoAprobado !== undefined) {
      updatedDatos.montoAprobado = parsedMontoAprobado;
      updatedDatos.fechaAprobacionMonto =
        parsedMontoAprobado !== null ? new Date().toISOString() : null;
    }

    if (parsedBancarios !== undefined) {
      updatedDatos.cuentaConfirmada = parsedBancarios.cuentaConfirmada;
      updatedDatos.tipoCuentaConfirmada = parsedBancarios.tipoCuentaConfirmada;
      updatedDatos.entidadBancariaConfirmada = parsedBancarios.entidadBancariaConfirmada;
      updatedDatos.numeroCuentaConfirmada = parsedBancarios.numeroCuentaConfirmada;
      updatedDatos.fechaConfirmacionCuenta = parsedBancarios.fechaConfirmacionCuenta;
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        datosFormulario: updatedDatos as any,
        ...(nuevoEstado ? { estado: nuevoEstado as any } : {}),
      },
    });

    if (nuevoEstado === "desembolsado" && existing.estado !== "desembolsado") {
      void triggerWitmePostbackForLead(leadId).catch((err) => {
        console.error(`[PATCH /api/admin/leads/[id]] Error en postback witme (${leadId}):`, err);
      });
    }

    const refreshedLead = await loadLeadForAdminDetail(leadId);
    return NextResponse.json({
      success: true,
      lead: refreshedLead,
      source: "database",
    });
  } catch (error) {
    if (isDbConnectionError(error) || getLeadFromFile(leadId)) {
      const fileLead = getLeadFromFile(leadId);
      if (!fileLead) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }

      const currentDatos =
        fileLead.datosFormulario && typeof fileLead.datosFormulario === "object"
          ? (fileLead.datosFormulario as Record<string, unknown>)
          : {};

      const updatedDatos: Record<string, unknown> = {
        ...currentDatos,
      };

      if (parsedMontoAprobado !== undefined) {
        updatedDatos.montoAprobado = parsedMontoAprobado;
        updatedDatos.fechaAprobacionMonto =
          parsedMontoAprobado !== null ? new Date().toISOString() : null;
      }

      if (parsedBancarios !== undefined) {
        updatedDatos.cuentaConfirmada = parsedBancarios.cuentaConfirmada;
        updatedDatos.tipoCuentaConfirmada = parsedBancarios.tipoCuentaConfirmada;
        updatedDatos.entidadBancariaConfirmada = parsedBancarios.entidadBancariaConfirmada;
        updatedDatos.numeroCuentaConfirmada = parsedBancarios.numeroCuentaConfirmada;
        updatedDatos.fechaConfirmacionCuenta = parsedBancarios.fechaConfirmacionCuenta;
      }

      updateLeadInFile(leadId, {
        datosFormulario: updatedDatos,
        ...(nuevoEstado ? { estado: nuevoEstado } : {}),
      });

      const refreshedLead = await loadLeadForAdminDetail(leadId);
      return NextResponse.json({
        success: true,
        lead: refreshedLead,
        source: "file",
      });
    }

    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await deleteLead(params.id);
  if (!result) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    attachmentsRemoved: result.attachmentsRemoved,
    source: result.storage,
  });
}

