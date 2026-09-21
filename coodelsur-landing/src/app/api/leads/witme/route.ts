import { createLead } from "@/application/lead/create-lead";
import { mapWitmePayload } from "@/application/lead/map-witme-payload";
import { getClientIp } from "@/shared/utils";
import { NextResponse } from "next/server";

/**
 * Webhook Witme → Coodelsur.
 * Witme envía cada lead completado; se guarda en PostgreSQL y aparece en /admin/leads.
 *
 * Auth: Authorization: Bearer <WITME_API_KEY>
 */
function validateWitmeAuth(request: Request): boolean {
  const apiKey = process.env.WITME_API_KEY?.trim();
  if (!apiKey) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === apiKey;
}

export async function POST(request: Request) {
  if (!validateWitmeAuth(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const mapped = mapWitmePayload(rawBody);

    if (!mapped) {
      return NextResponse.json(
        {
          error: "Payload inválido",
          details: "Se requieren al menos nombre, cedula/documento y telefono/celular",
        },
        { status: 422 },
      );
    }

    const ip = getClientIp(request);

    const lead = await createLead({
      tipoCredito: mapped.tipoCredito,
      nombre: mapped.nombre,
      cedula: mapped.cedula,
      telefono: mapped.telefono,
      email: mapped.email,
      datosFormulario: mapped.datosFormulario,
      origen: "witme",
      utm: mapped.utm,
      ip,
      aceptaTerminos: mapped.aceptaTerminos,
    });

    return NextResponse.json(
      {
        success: true,
        id: lead.id,
        origen: "witme",
        storage: lead.storage ?? "database",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/leads/witme]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://tu-dominio.com";

  return NextResponse.json({
    service: "witme-webhook",
    configured: Boolean(process.env.WITME_API_KEY?.trim()),
    method: "POST",
    url: `${siteUrl}/api/leads/witme`,
    auth: "Authorization: Bearer <WITME_API_KEY>",
    requiredFields: ["nombre", "cedula|documento", "telefono|celular"],
    optionalFields: [
      "email|correo",
      "tipo_credito|tipoCredito",
      "datos|datos_formulario (objeto con todos los campos del formulario Witme)",
      "witme_id (ID del lead en Witme, recomendado)",
      "acepta_terminos",
      "utm_source",
      "utm_campaign",
    ],
    redirectExamples: {
      landing: `${siteUrl}/?utm_source=witme&utm_medium=redirect&utm_campaign={CAMPAIGN_ID}`,
      formWithAmount: `${siteUrl}/solicitar?monto=400000&utm_source=witme&utm_medium=redirect&utm_campaign={CAMPAIGN_ID}`,
      shortRef: `${siteUrl}/solicitar?monto=400000&ref=witme&utm_campaign={CAMPAIGN_ID}`,
      productDirect: `${siteUrl}/credito/microcredito_small?utm_source=witme&utm_medium=redirect`,
    },
    trackingNotes: [
      "Opción A (webhook): origen del lead = witme automáticamente.",
      "Opción B (redirect): incluir utm_source=witme o ref=witme para marcar el lead como Witme en admin.",
      "Sin esos parámetros, el lead se registra como web directo.",
    ],
    notes: [
      "Los campos pueden ir en el root del JSON o dentro de datos / datos_formulario.",
      "Acepta snake_case (capital_solicitado) y camelCase (capitalSeleccionado).",
      "Cada lead aparece en el panel admin con origen witme.",
    ],
  });
}
