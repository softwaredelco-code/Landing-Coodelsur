/**
 * Servicio de Postbacks de conversión para Witme.
 *
 * Especificaciones acordadas con Witme:
 * 1. Método: GET.
 * 2. Evento: Crédito desembolsado por payout fijo (estado "desembolsado").
 * 3. Parámetro: witme_id.
 * 4. Autenticación: No hace falta token.
 * 5. Reintentos: Hasta 3 intentos si no responde o devuelve 5xx (500).
 *    En errores 4xx (400, 404, etc.) solo 1 intento (no se reintenta).
 * 6. Dos postbacks independientes: Nanocrédito vs Microcrédito (payouts distintos).
 */

import { prisma } from "@/infrastructure/database/prisma";
import { getLeadFromFile, updateLeadInFile } from "@/infrastructure/persistence/file-store";

export interface PostbackResult {
  success: boolean;
  status: "success" | "error" | "pending_url";
  attempts: number;
  httpStatus?: number | null;
  error?: string | null;
  url?: string | null;
  product: "nanocredito" | "microcredito";
  witmeId: string;
  triggeredAt: string;
}

/**
 * Extrae el ID de seguimiento de Witme guardado en el lead.
 */
export function extractWitmeId(datosFormulario: unknown): string | null {
  if (!datosFormulario || typeof datosFormulario !== "object") return null;
  const d = datosFormulario as Record<string, unknown>;
  const candidate =
    d.witmeLeadId ||
    d.witme_id ||
    d.witmeId ||
    d.click_id ||
    d.id_externo ||
    d.external_id;

  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  return null;
}

/**
 * Determina si el tipo de crédito corresponde a Nanocrédito o Microcrédito.
 */
export function resolvePostbackProduct(tipoCredito: string): "nanocredito" | "microcredito" {
  const normalized = (tipoCredito || "").toLowerCase();
  if (
    normalized === "microcredito_small" ||
    normalized === "nanocredito" ||
    normalized.includes("small") ||
    normalized.includes("nano")
  ) {
    return "nanocredito";
  }
  return "microcredito";
}

/**
 * Obtiene la URL base configurada según el producto.
 */
export function getPostbackBaseUrl(product: "nanocredito" | "microcredito"): string | null {
  if (product === "nanocredito") {
    return (
      process.env.WITME_POSTBACK_URL_NANOCREDITO?.trim() ||
      process.env.WITME_POSTBACK_URL_SMALL?.trim() ||
      null
    );
  }
  return (
    process.env.WITME_POSTBACK_URL_MICROCREDITO?.trim() ||
    process.env.WITME_POSTBACK_URL_LIBRANZA?.trim() ||
    null
  );
}

/**
 * Construye la URL final inyectando el parámetro `witme_id`.
 */
export function buildPostbackUrl(baseUrl: string, witmeId: string): string {
  const cleanBase = baseUrl.trim();
  if (cleanBase.includes("{witme_id}") || cleanBase.includes("{click_id}")) {
    return cleanBase
      .replace(/{witme_id}/gi, encodeURIComponent(witmeId))
      .replace(/{click_id}/gi, encodeURIComponent(witmeId));
  }

  try {
    const url = new URL(cleanBase);
    url.searchParams.set("witme_id", witmeId);
    return url.toString();
  } catch {
    const sep = cleanBase.includes("?") ? "&" : "?";
    return `${cleanBase}${sep}witme_id=${encodeURIComponent(witmeId)}`;
  }
}

/**
 * Ejecuta la llamada GET al postback con la política de reintentos de Witme:
 * - 3 intentos en errores 500 o fallos de red/timeout.
 * - 1 solo intento en errores 4xx (400, etc.).
 */
export async function executePostbackCall(
  targetUrl: string,
  witmeId: string,
  product: "nanocredito" | "microcredito",
): Promise<PostbackResult> {
  const maxAttempts = 3;
  let attempt = 0;
  let lastStatus: number | null = null;
  let lastError: string | null = null;
  const now = new Date().toISOString();

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      console.log(
        `[WitmePostback] Intento ${attempt}/${maxAttempts} (${product}) -> ${targetUrl}`,
      );

      const res = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Coodelsur-Postback/1.0",
          Accept: "application/json, text/plain, */*",
        },
        signal: controller.signal,
      });

      lastStatus = res.status;

      if (res.ok) {
        console.log(
          `[WitmePostback] Éxito HTTP ${res.status} en intento ${attempt} para ${witmeId}`,
        );
        return {
          success: true,
          status: "success",
          attempts: attempt,
          httpStatus: res.status,
          url: targetUrl,
          product,
          witmeId,
          triggeredAt: now,
        };
      }

      // Regla 5: "error 400 u otros errores 4** solo 1 intento"
      if (res.status >= 400 && res.status < 500) {
        lastError = `HTTP ${res.status}: Respuesta de cliente 4xx recibida de Witme (no se reintenta)`;
        console.warn(`[WitmePostback] Detenido por error 4xx: ${lastError}`);
        break;
      }

      // Error 500 u otros 5xx: Reintentar
      lastError = `HTTP ${res.status}: Error del servidor Witme (5xx)`;
      console.warn(`[WitmePostback] Falló intento ${attempt}: ${lastError}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        lastError = "Timeout de conexión (10s)";
      } else {
        lastError = err instanceof Error ? err.message : String(err);
      }
      console.warn(`[WitmePostback] Error de red en intento ${attempt}: ${lastError}`);
    } finally {
      clearTimeout(timer);
    }

    // Espera incremental entre reintentos para errores 500 (1.5s, 3s)
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  return {
    success: false,
    status: "error",
    attempts: attempt,
    httpStatus: lastStatus,
    error: lastError,
    url: targetUrl,
    product,
    witmeId,
    triggeredAt: now,
  };
}

/**
 * Dispara el postback de conversión para un lead determinado.
 * Si el lead no proviene de Witme o no tiene witme_id, no realiza llamada.
 */
export async function triggerWitmePostbackForLead(
  leadId: string,
  force = false,
): Promise<PostbackResult | null> {
  const now = new Date().toISOString();

  // 1. Cargar lead
  let lead: {
    id: string;
    tipoCredito: string;
    estado: string;
    origen: string;
    utmSource: string | null;
    datosFormulario: unknown;
  } | null = null;

  try {
    lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        tipoCredito: true,
        estado: true,
        origen: true,
        utmSource: true,
        datosFormulario: true,
      },
    });
  } catch {
    const fileLead = getLeadFromFile(leadId);
    if (fileLead) {
      lead = {
        id: fileLead.id,
        tipoCredito: fileLead.tipoCredito,
        estado: fileLead.estado,
        origen: fileLead.origen,
        utmSource: fileLead.utmSource ?? null,
        datosFormulario: fileLead.datosFormulario,
      };
    }
  }

  if (!lead) {
    console.warn(`[WitmePostback] Lead ${leadId} no encontrado.`);
    return null;
  }

  const datos = (lead.datosFormulario || {}) as Record<string, unknown>;
  const witmeId = extractWitmeId(datos);

  if (!witmeId) {
    console.log(`[WitmePostback] Lead ${leadId} no tiene witme_id, se omite postback.`);
    return null;
  }

  const product = resolvePostbackProduct(lead.tipoCredito);

  // Evitar duplicar conversión si ya se envió con éxito previamente (a menos que se fuerce)
  const previousPostback = datos.witmePostback as PostbackResult | undefined;
  if (!force && previousPostback?.status === "success") {
    console.log(`[WitmePostback] Lead ${leadId} ya tiene postback exitoso registrado.`);
    return previousPostback;
  }

  const baseUrl = getPostbackBaseUrl(product);
  if (!baseUrl) {
    console.warn(
      `[WitmePostback] Pendiente: No hay URL configurada para producto ${product} (env: WITME_POSTBACK_URL_${product.toUpperCase()}). Lead: ${leadId}`,
    );
    const pendingResult: PostbackResult = {
      success: false,
      status: "pending_url",
      attempts: 0,
      httpStatus: null,
      error: `Falta configurar variable de entorno WITME_POSTBACK_URL_${product.toUpperCase()}`,
      url: null,
      product,
      witmeId,
      triggeredAt: now,
    };

    await persistPostbackResult(leadId, datos, pendingResult);
    return pendingResult;
  }

  const targetUrl = buildPostbackUrl(baseUrl, witmeId);
  const result = await executePostbackCall(targetUrl, witmeId, product);

  await persistPostbackResult(leadId, datos, result);
  return result;
}

async function persistPostbackResult(
  leadId: string,
  datosActuales: Record<string, unknown>,
  result: PostbackResult,
) {
  const updatedDatos = {
    ...datosActuales,
    witmePostback: result,
  };

  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: { datosFormulario: updatedDatos as any },
    });
  } catch {
    updateLeadInFile(leadId, { datosFormulario: updatedDatos });
  }
}
