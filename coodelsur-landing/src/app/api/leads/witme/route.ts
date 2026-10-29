import { createLead } from "@/application/lead/create-lead";
import { mapWitmePayload, type MappedWitmeLead } from "@/application/lead/map-witme-payload";
import {
  findRecentDuplicateCedula,
  resolveClientDuplicateByProgress,
} from "@/domain/lead/duplicate-cedula";
import { calcularProgresoFormulario } from "@/domain/lead/form-progress";
import { cleanupIncompleteDraftsForContact } from "@/application/lead/save-draft-lead";
import { prisma } from "@/infrastructure/database/prisma";
import { getClientIp } from "@/shared/utils";
import type { TipoCredito } from "@/shared/types/credito";
import { NextResponse } from "next/server";

/**
 * Webhook Witme → Coodelsur.
 *
 * Políticas estrictas:
 * 1. Únicamente se permite el ingreso de leads COMPLETOS a la base de datos.
 *    Si el lead viene incompleto, NO se persiste en PostgreSQL; se devuelve HTTP 422
 *    con los campos faltantes y la URL de redirección directa con datos precargados.
 * 2. Control riguroso de duplicados:
 *    - Por witme_id / id_externo: evita procesar múltiples veces la misma solicitud.
 *    - Por cédula: detecta si ya existe una solicitud activa en los últimos 30 días.
 *    - Por teléfono y cédula: evita envíos redundantes o repetidos en 24 horas.
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

/** Construye la URL de redirección con los datos precargados para que el cliente finalice en el portal. */
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

  // Enlace del borrador en la DB solo si existe
  if (leadId) {
    params.set("draftLeadId", leadId);
    params.set("leadId", leadId);
  }

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

/**
 * Valida si un lead enviado por Witme cuenta con toda la información requerida
 * para ser considerado un lead completo.
 */
function checkWitmeLeadCompleteness(
  mapped: MappedWitmeLead,
  rawBody: Record<string, unknown>,
): { complete: boolean; missingFields: string[] } {
  const missing: string[] = [];
  const d = mapped.datosFormulario;

  // 1. Datos básicos de contacto e identificación
  const nombreLimpio = (mapped.nombre || "").trim();
  if (nombreLimpio.length < 3 || nombreLimpio.split(/\s+/).length < 2) {
    missing.push("nombre completo (nombres y apellidos)");
  }
  if (!mapped.cedula || mapped.cedula.length < 5) {
    missing.push("cedula");
  }
  const cleanPhone = (mapped.telefono || "").replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    missing.push("telefono (celular de 10 dígitos)");
  }
  if (!mapped.email || !mapped.email.includes("@") || !mapped.email.includes(".")) {
    missing.push("email válido");
  }

  // 2. Parámetros del crédito
  const capital = Number(d.capitalSeleccionado ?? 0);
  if (!capital || capital <= 0) {
    missing.push("capitalSeleccionado (monto)");
  }
  const cuotas = Number(d.cantidadCuotas ?? 0);
  if (!cuotas || cuotas <= 0) {
    missing.push("cantidadCuotas (plazo)");
  }
  if (!d.destinoCredito) {
    missing.push("destinoCredito");
  }

  // 3. Datos personales y residencia
  if (!d.tipoIdentificacion) missing.push("tipoIdentificacion");
  if (!d.fechaNacimiento) missing.push("fechaNacimiento");
  if (!d.fechaExpedicion) missing.push("fechaExpedicion");
  if (!d.genero) missing.push("genero");
  if (!d.estadoCivil) missing.push("estadoCivil");
  if (!d.departamento) missing.push("departamento");
  if (!d.municipio && !d.ciudad) missing.push("municipio");
  if (!d.direccion) missing.push("direccion");
  if (!d.barrio) missing.push("barrio");
  if (!d.estrato) missing.push("estrato");

  // 4. Datos financieros y bancarios
  const ingresos = Number(d.ingresosMensuales ?? 0);
  if (!ingresos || ingresos <= 0) missing.push("ingresosMensuales");
  if (!d.tipoCuenta) missing.push("tipoCuenta");
  if (!d.entidadBancaria) missing.push("entidadBancaria");
  if (!d.numeroCuenta) missing.push("numeroCuenta");

  // 5. Centrales de riesgo y mora
  if (!d.moraVigente) {
    missing.push("moraVigente (si/no)");
  } else if (d.moraVigente === "si") {
    if (!d.moraEntidad) missing.push("moraEntidad");
    if (!d.moraTiempo) missing.push("moraTiempo");
    if (!d.moraValor) missing.push("moraValor");
    if (!d.tieneCodeudor) {
      missing.push("tieneCodeudor (si/no)");
    } else if (d.tieneCodeudor === "si") {
      if (!d.codeudorNombre) missing.push("codeudorNombre");
      if (!d.codeudorCedula) missing.push("codeudorCedula");
      if (!d.codeudorTelefono) missing.push("codeudorTelefono");
    }
  }

  // 6. Referencias
  const tieneRefNombre = Boolean(d.referenciaFamiliarNombre || d.referenciaNombre);
  const tieneRefTel = Boolean(d.referenciaFamiliarTelefono || d.referenciaTelefono || d.referenciaCelular);
  if (!tieneRefNombre) missing.push("referenciaFamiliarNombre");
  if (!tieneRefTel) missing.push("referenciaFamiliarTelefono");

  // 7. Aceptación de términos
  if (!mapped.aceptaTerminos) {
    missing.push("aceptaTerminos");
  }

  // Si el remitente declaró explícitamente estado completo o se adjuntaron documentos
  const rawEstado = String(rawBody.estado ?? "").toLowerCase();
  const vieneDeclaradoCompleto = rawEstado === "completo" || rawEstado === "recibido";
  const tieneArchivos = Boolean(
    d.cedulaFrontal || d.cedula_frontal || d.firma || d.videoVerificacion || d.video_verificacion
  );

  // Un lead se considera completo solo si no le falta ningún campo esencial
  // o si viene declarado completo con al menos datos personales, financieros y bancarios
  const complete = missing.length === 0 || (vieneDeclaradoCompleto && missing.length <= 2 && tieneArchivos);

  return { complete, missingFields: missing };
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

    const origin = getRequestOrigin(request);

    // =========================================================================
    // 1. EVALUACIÓN DE COMPLETITUD Y PROGRESO DEL LEAD ENTRANTE
    // =========================================================================
    const completeness = checkWitmeLeadCompleteness(mapped, rawBody);
    const redirectUrl = buildWitmeRedirectUrl(origin, mapped.tipoCredito, "", mapped);
    const incomingProgreso = completeness.complete
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(calcularProgresoFormulario(mapped.datosFormulario, 0).porcentaje),
          ),
        );

    // =========================================================================
    // 2. CONTROL DE DUPLICADOS Y POLÍTICA DE MAYOR PORCENTAJE (WITME)
    //    1. Código de error HTTP 409
    //    2. Payload con status: "duplicate"
    //    3. Se conserva únicamente el registro con mayor porcentaje completado
    // =========================================================================
    const duplicateResolution = await resolveClientDuplicateByProgress({
      cedula: mapped.cedula,
      telefono: mapped.telefono,
      witmeId: mapped.witmeLeadId,
      incomingProgreso,
      windowDays: 30,
    });

    if (
      duplicateResolution.isDuplicate &&
      duplicateResolution.action === "REJECT_INCOMING_DUPLICATE"
    ) {
      return NextResponse.json(
        {
          status: "duplicate",
          duplicate: true,
          error: "Lead duplicado",
          message:
            duplicateResolution.message ??
            "Lead duplicado: ya existe un registro con mayor o igual porcentaje completado para este cliente.",
          leadId: duplicateResolution.existingLead?.id,
          existingLeadId: duplicateResolution.existingLead?.id,
          estado: duplicateResolution.existingLead?.estado,
          porcentaje: duplicateResolution.existingLead?.progreso,
          existingProgreso: duplicateResolution.existingLead?.progreso,
          incomingProgreso,
        },
        { status: 409 },
      );
    }

    // =========================================================================
    // 3. REGLA: ÚNICAMENTE LEADS COMPLETOS INGRESAN A LA BASE DE DATOS
    // =========================================================================
    if (!completeness.complete) {
      return NextResponse.json(
        {
          status: "incomplete",
          success: false,
          error: "Lead incompleto no permitido",
          message:
            "No se permite el ingreso de leads incompletos por parte de la API de Witme. Únicamente se admiten solicitudes completas.",
          camposFaltantes: completeness.missingFields,
          redirect_url: redirectUrl,
          redirectUrl: redirectUrl,
          incomingProgreso,
        },
        { status: 422 },
      );
    }

    // =========================================================================
    // 4. REGISTRO DEL LEAD COMPLETO (Y PURGA DE CUALQUIER BORRADOR INFERIOR)
    // =========================================================================
    const ip = getClientIp(request);

    const lead = await createLead({
      tipoCredito: mapped.tipoCredito,
      nombre: mapped.nombre,
      cedula: mapped.cedula,
      telefono: mapped.telefono,
      email: mapped.email,
      datosFormulario: mapped.datosFormulario,
      origen: "witme",
      estado: "completo",
      utm: mapped.utm,
      ip,
      aceptaTerminos: mapped.aceptaTerminos,
    });

    // Asegurar que no quede ningún borrador previo incompleto para este cliente (1 solo registro)
    await cleanupIncompleteDraftsForContact(mapped.cedula, mapped.telefono);

    const finalRedirectUrl = buildWitmeRedirectUrl(origin, mapped.tipoCredito, lead.id, mapped);

    return NextResponse.json(
      {
        status: "created",
        success: true,
        id: lead.id,
        leadId: lead.id,
        estado: "completo",
        origen: "witme",
        redirect_url: finalRedirectUrl,
        redirectUrl: finalRedirectUrl,
        message: "Lead completo registrado con éxito para revisión administrativa.",
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
    policy: {
      incompletePolicy: "REJECT (Solo se admiten leads completos en base de datos. Leads incompletos reciben 422 con redirect_url)",
      duplicatePolicy: "HTTP 409 { status: 'duplicate' } (Comparación por porcentaje de completitud: se mantiene un único registro por cliente con el mayor porcentaje completado y se eliminan duplicados inferiores)",
    },
    requiredFields: [
      "nombre (completo)",
      "cedula|documento",
      "telefono|celular",
      "email|correo",
      "tipo_credito|tipoCredito",
      "capital_solicitado|monto",
      "cantidad_cuotas|cuotas",
      "destino_credito",
      "tipo_identificacion",
      "fecha_nacimiento",
      "fecha_expedicion",
      "genero",
      "estado_civil",
      "departamento",
      "municipio|ciudad",
      "direccion",
      "barrio",
      "estrato",
      "ingresos_mensuales",
      "tipo_cuenta",
      "entidad_bancaria",
      "numero_cuenta",
      "mora_vigente (si/no)",
      "referencia_familiar_nombre",
      "referencia_familiar_telefono",
      "acepta_terminos (true)",
    ],
    optionalFields: [
      "witme_id (ID único de Witme para deduplicación estricta)",
      "utm_source",
      "utm_campaign",
      "utm_medium",
    ],
    redirectUrlFormat: `${origin}/credito/microcredito_small?nombre={NOMBRE}&cedula={CEDULA}&telefono={TELEFONO}&email={EMAIL}&monto={MONTO}&utm_source=witme&utm_medium=api_redirect&ref=witme`,
  });
}

