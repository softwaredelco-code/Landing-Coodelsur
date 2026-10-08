import { createLead } from "@/application/lead/create-lead";
import { mapWitmePayload, type MappedWitmeLead } from "@/application/lead/map-witme-payload";
import { calcularProgresoFormulario } from "@/domain/lead/form-progress";
import { getClientIp } from "@/shared/utils";
import type { TipoCredito } from "@/shared/types/credito";
import { NextResponse } from "next/server";

/**
 * Webhook Witme → Coodelsur.
 * Witme envía cada lead (inicial o incompleto); se guarda en PostgreSQL con estado "incompleto"
 * y origen "witme". La respuesta retorna la URL de redirección directa al formulario con los
 * datos precargados para que el cliente termine de llenar los campos faltantes.
 * Al enviarse la solicitud completa, se actualiza el mismo registro y pasa a estado completo/recibido.
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

/** Obtiene el origen/host de la petición de forma dinámica (compatible con proxies y cPanel). */
function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host?.includes("localhost") ? "http" : "https");

  if (host) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/$/, "");
  }

  return "https://solicitar-credito.coodelsursas.com.co";
}

/** Construye la URL de redirección con el borrador enlazado y los datos precargados. */
function buildWitmeRedirectUrl(
  baseUrl: string,
  tipoCredito: TipoCredito,
  leadId: string,
  mapped: MappedWitmeLead,
): string {
  const formPath =
    tipoCredito === "microcredito_small"
      ? "/credito/microcredito_small"
      : tipoCredito === "libranza"
        ? "/credito/libranza"
        : `/credito/${tipoCredito}`;

  const params = new URLSearchParams();

  // Enlace del borrador en la DB para que el frontend lo reconozca y actualice
  params.set("draftLeadId", leadId);
  params.set("leadId", leadId);

  // Datos básicos del solicitante
  if (mapped.nombre) params.set("nombre", mapped.nombre);
  if (mapped.cedula) params.set("cedula", mapped.cedula);
  if (mapped.telefono) params.set("telefono", mapped.telefono);
  if (mapped.email) params.set("email", mapped.email);

  // Monto y plazo seleccionados
  const capital = mapped.datosFormulario.capitalSeleccionado;
  if (capital && !Number.isNaN(Number(capital)) && Number(capital) > 0) {
    params.set("monto", String(capital));
    params.set("capitalSeleccionado", String(capital));
  }

  const cuotas = mapped.datosFormulario.cantidadCuotas;
  if (cuotas && !Number.isNaN(Number(cuotas)) && Number(cuotas) > 0) {
    let cuotasVal = Number(cuotas);
    if (tipoCredito === "microcredito_small" && (cuotasVal < 1 || cuotasVal > 4)) {
      cuotasVal = 2;
    }
    params.set("cuotas", String(cuotasVal));
    params.set("cantidadCuotas", String(cuotasVal));
  } else if (tipoCredito === "microcredito_small") {
    params.set("cuotas", "2");
    params.set("cantidadCuotas", "2");
  }

  // Atribución de campaña para asegurar origen Witme
  params.set("utm_source", mapped.utm.utmSource || "witme");
  params.set("utm_medium", mapped.utm.utmMedium || "api_redirect");
  if (mapped.utm.utmCampaign) params.set("utm_campaign", mapped.utm.utmCampaign);
  if (mapped.utm.utmContent) params.set("utm_content", mapped.utm.utmContent);
  params.set("ref", "witme");

  return `${baseUrl}${formPath}?${params.toString()}`;
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

    // Calcular avance del formulario con los campos enviados por Witme
    const progreso = calcularProgresoFormulario(mapped.datosFormulario, 0);
    mapped.datosFormulario._progreso = progreso;

    // Detectar si es un lead completo o un borrador inicial para redirección
    const rawEstado = String(rawBody.estado ?? "").toLowerCase();
    const esCompleto =
      rawEstado === "completo" ||
      rawEstado === "recibido" ||
      progreso.porcentaje >= 65 ||
      Boolean(
        mapped.datosFormulario.cedulaFrontal ||
        mapped.datosFormulario.cedula_frontal ||
        mapped.datosFormulario.firma
      );

    const estadoFinal = esCompleto ? "completo" : "incompleto";

    const lead = await createLead({
      tipoCredito: mapped.tipoCredito,
      nombre: mapped.nombre,
      cedula: mapped.cedula,
      telefono: mapped.telefono,
      email: mapped.email,
      datosFormulario: mapped.datosFormulario,
      origen: "witme",
      estado: estadoFinal,
      utm: mapped.utm,
      ip,
      aceptaTerminos: mapped.aceptaTerminos,
    });

    const origin = getRequestOrigin(request);
    const redirectUrl = buildWitmeRedirectUrl(origin, mapped.tipoCredito, lead.id, mapped);

    return NextResponse.json(
      {
        success: true,
        id: lead.id,
        leadId: lead.id,
        draftLeadId: lead.id,
        estado: estadoFinal,
        origen: "witme",
        redirect_url: redirectUrl,
        redirectUrl: redirectUrl,
        url: redirectUrl,
        redirect: redirectUrl,
        message: esCompleto
          ? "Lead registrado con éxito en estado completo para revisión administrativa."
          : "Lead registrado como incompleto. Redirigir al cliente a 'redirect_url' para completar los campos faltantes.",
        storage: lead.storage ?? "database",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/leads/witme]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);

  return NextResponse.json({
    service: "witme-webhook",
    configured: Boolean(process.env.WITME_API_KEY?.trim()),
    method: "POST",
    url: `${origin}/api/leads/witme`,
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
    responseExample: {
      success: true,
      id: "c7a2b9f1-0000-0000-0000-000000000000",
      leadId: "c7a2b9f1-0000-0000-0000-000000000000",
      draftLeadId: "c7a2b9f1-0000-0000-0000-000000000000",
      estado: "incompleto",
      origen: "witme",
      redirect_url: `${origin}/credito/microcredito_small?draftLeadId={LEAD_ID}&leadId={LEAD_ID}&nombre={NOMBRE}&cedula={CEDULA}&telefono={TELEFONO}&email={EMAIL}&monto={MONTO}&utm_source=witme&utm_medium=api_redirect&ref=witme`,
      redirectUrl: `${origin}/credito/microcredito_small?draftLeadId={LEAD_ID}&leadId={LEAD_ID}&...`,
      url: `${origin}/credito/microcredito_small?draftLeadId={LEAD_ID}&leadId={LEAD_ID}&...`,
      message: "Lead registrado como incompleto. Redirigir al cliente a 'redirect_url' para completar los campos faltantes.",
    },
    flowInstructions: [
      "1. Witme envía los datos disponibles por POST /api/leads/witme.",
      "2. Coodelsur registra el lead con estado 'incompleto' y origen 'witme'.",
      "3. La API responde HTTP 201 con 'redirect_url' conteniendo el leadId y campos precargados.",
      "4. Witme redirige al cliente a esa URL.",
      "5. El cliente visualiza sus datos precargados y completa los pasos faltantes (fotos, banco, etc.).",
      "6. Al enviar el formulario final, el lead existente se actualiza a 'completo' sin duplicar registros.",
    ],
    redirectExamples: {
      landing: `${origin}/?utm_source=witme&utm_medium=redirect&utm_campaign={CAMPAIGN_ID}`,
      formWithAmount: `${origin}/solicitar?monto=400000&utm_source=witme&utm_medium=redirect&utm_campaign={CAMPAIGN_ID}`,
      shortRef: `${origin}/solicitar?monto=400000&ref=witme&utm_campaign={CAMPAIGN_ID}`,
      productDirect: `${origin}/credito/microcredito_small?utm_source=witme&utm_medium=redirect`,
    },
    trackingNotes: [
      "Opción A (webhook + redirect): el webhook guarda el lead incompleto y retorna redirect_url para finalizarlo.",
      "Opción B (redirect directo): incluir utm_source=witme o ref=witme para marcar el lead como Witme en admin.",
    ],
  });
}
