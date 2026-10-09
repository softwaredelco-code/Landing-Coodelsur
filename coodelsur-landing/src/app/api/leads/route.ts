import { calcularDesgloseCuota } from "@/domain/credito/amortizacion";
import { createLead, extractLeadFromFormBody } from "@/application/lead/create-lead";
import { sendLeadConfirmationEmail } from "@/infrastructure/email/lead-confirmation";
import {
  buildCedulaVerificacionPayload,
  verifyDocumentComplete,
} from "@/application/identity/verify-document";
import { getClientIp } from "@/shared/utils";
import { montoCoincideConTipo, resolverTipoPorMonto } from "@/shared/config/creditos/montos";
import { nanocreditoSchema } from "@/shared/validation/nanocredito";
import { microcreditoUrbanoSchema } from "@/shared/validation/microcredito-urbano/schema";
import { libranzaSchema } from "@/shared/validation/libranza/schema";
import { buildFormSchema, leadApiSchema } from "@/shared/validation/schemas";
import { NextResponse } from "next/server";
import type { TipoCredito, UtmParams } from "@/shared/types/credito";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Receptor de solicitudes del formulario unificado.
 *
 * Defensa en profundidad:
 * 1) Valida el schema del producto
 * 2) Verifica que el monto coincida con el `tipoCredito` declarado
 *    (evita manipulación del cliente)
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ip = getClientIp(request);

    const tipoRaw = String(body.tipoCredito ?? "");
    if (!tipoRaw) {
      return NextResponse.json({ error: "Tipo de crédito requerido" }, { status: 400 });
    }

    const tipoCanonico = (
      tipoRaw === "nanocredito" ? "microcredito_small" : tipoRaw
    ) as TipoCredito;

    const capitalRaw = Number(body.capitalSeleccionado || 0);
    const cuotasRaw = Number(body.cantidadCuotas || 0);
    let normalizedBody: Record<string, unknown> = {
      ...body,
      tipoCredito: tipoCanonico,
    };

    if (capitalRaw > 0 && cuotasRaw > 0) {
      try {
        const desglose = calcularDesgloseCuota(tipoCanonico, capitalRaw, cuotasRaw);
        normalizedBody = {
          ...normalizedBody,
          valorCuota: desglose.valorCuotaTotal,
          valorCreditoFinanciado: desglose.valorCreditoFinanciado,
          estudioCredito: desglose.estudioCredito,
          cuotaCapitalInteres: desglose.cuotaCapitalInteres,
          cuotaFianzaMensual: desglose.fianzaMensual,
          cuotaVidaDeudoresMensual: desglose.vidaDeudoresMensual,
        };
      } catch {
        // En caso de que el tipo no use desglose estándar
      }
    }

    const formSchema =
      tipoCanonico === "microcredito_small"
        ? nanocreditoSchema
        : tipoCanonico === "microcredito_urbano"
          ? microcreditoUrbanoSchema
          : tipoCanonico === "libranza"
            ? libranzaSchema
            : buildFormSchema(tipoCanonico);
    const formResult = formSchema.safeParse(normalizedBody);

    if (!formResult.success) {
      const fieldErrors = formResult.error.flatten().fieldErrors;
      const issues = formResult.error.issues;
      const issueMessages = Array.from(new Set(issues.map((i) => i.message)));
      const errorSummary = `Campos incompletos o con error: ${issueMessages.slice(0, 3).join(". ")}`;
      return NextResponse.json(
        {
          error: errorSummary,
          details: fieldErrors,
          issues: issues.map((i) => ({
            field: String(i.path[0] ?? i.path.join(".")),
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 422 },
      );
    }

    const capital = Number(
      (formResult.data as { capitalSeleccionado?: number }).capitalSeleccionado ??
        body.capitalSeleccionado,
    );

    // El monto debe pertenecer al producto declarado.
    if (!montoCoincideConTipo(tipoCanonico, capital)) {
      const detected = resolverTipoPorMonto(capital);
      return NextResponse.json(
        {
          error: "El monto solicitado no corresponde al tipo de crédito indicado",
          details: {
            capitalSeleccionado: ["El monto no corresponde al rango de este producto"],
            tipoCredito: tipoCanonico,
            capital,
            sugerido: detected.ok
              ? (detected.rango?.tipo ?? detected.candidatos.map((c) => c.tipo))
              : null,
          },
        },
        { status: 422 },
      );
    }

    const utm = body.utm as UtmParams | undefined;
    const leadData = extractLeadFromFormBody(
      { ...formResult.data, utm, geoCliente: body.geoCliente },
      utm,
    );

    const apiResult = leadApiSchema.safeParse({
      ...leadData,
      email: leadData.email || undefined,
    });

    if (!apiResult.success) {
      const issues = apiResult.error.issues.map((i) => i.message);
      return NextResponse.json(
        {
          error: `Datos de solicitud incompletos: ${issues.slice(0, 3).join(". ")}`,
          details: apiResult.error.flatten().fieldErrors,
        },
        { status: 422 },
      );
    }

    const cedulaVerificacion = await verifyDocumentComplete({
      documentType: String(formResult.data.tipoIdentificacion ?? "CC"),
      documentNumber: formResult.data.cedula,
      nombre: formResult.data.nombre,
      fechaNacimiento: formResult.data.fechaNacimiento,
      fechaExpedicion: formResult.data.fechaExpedicion,
      checkDuplicate: true,
    });

    if (!cedulaVerificacion.ok) {
      return NextResponse.json(
        {
          error: cedulaVerificacion.message,
          details: {
            cedula: [cedulaVerificacion.message],
            cedulaVerificacion: cedulaVerificacion.status,
          },
        },
        { status: 422 },
      );
    }

    leadData.datosFormulario.cedulaVerificacion = buildCedulaVerificacionPayload(cedulaVerificacion);

    const draftLeadId =
      typeof body.draftLeadId === "string" && body.draftLeadId.trim()
        ? body.draftLeadId.trim()
        : null;

    const lead = await createLead({ ...leadData, ip, draftLeadId, exigirVideo: true });

    void sendLeadConfirmationEmail({
      to: leadData.email ?? "",
      leadId: lead.id,
      nombre: leadData.nombre,
      tipoCredito: leadData.tipoCredito,
      estado: "recibido",
      datosFormulario: leadData.datosFormulario,
    }).catch((error) => {
      console.error("[POST /api/leads] email", error);
    });

    return NextResponse.json(
      {
        success: true,
        id: lead.id,
        storage: lead.storage ?? "database",
        cedulaVerificacion: {
          status: cedulaVerificacion.status,
          message: cedulaVerificacion.message,
        },
        emailQueued: Boolean(leadData.email),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/leads]", error);
    const message =
      error instanceof Error && error.message.includes("supera el límite")
        ? error.message
        : error instanceof Error && error.message.includes("Tiempo agotado")
          ? error.message
          : error instanceof Error && error.message.includes("PrismaClient")
            ? "No se pudo conectar a la base de datos para guardar la solicitud. Intenta de nuevo."
            : error instanceof Error
              ? `Error al guardar: ${error.message}`
              : "No se pudo procesar la solicitud en el servidor. Intenta de nuevo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
