import { createLead } from "@/application/lead/create-lead";
import { getClientIp } from "@/shared/utils";
import { inferOrigen } from "@/presentation/tracking/utm";
import type { TipoCredito, UtmParams } from "@/shared/types/credito";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Webhook Witme.
 * Auth: Authorization: Bearer <WITME_API_KEY>
 */
const witmeLeadSchema = z
  .object({
    tipo_credito: z.string().optional(),
    tipoCredito: z.string().optional(),
    nombre: z.string().min(2),
    cedula: z.string().min(5),
    telefono: z.string().min(7),
    email: z.string().email().optional(),
    datos: z.record(z.unknown()).optional(),
    datos_formulario: z.record(z.unknown()).optional(),
    acepta_terminos: z.boolean().optional(),
    aceptaTerminos: z.boolean().optional(),
    utm_source: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_term: z.string().optional(),
    utm_content: z.string().optional(),
  })
  .passthrough();

function validateWitmeAuth(request: Request): boolean {
  const apiKey = process.env.WITME_API_KEY;
  if (!apiKey) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace(/^Bearer\s+/i, "");
  return token === apiKey;
}

function normalizeTipoCredito(raw: string | undefined): TipoCredito {
  const map: Record<string, TipoCredito> = {
    nanocredito: "microcredito_small",
    nanocrédito: "microcredito_small",
    microcredito_small: "microcredito_small",
    "microcredito small": "microcredito_small",
    microcredito_rural: "microcredito_rural",
    "microcredito rural": "microcredito_rural",
    microcredito: "microcredito_rural",
    microcrédito: "microcredito_rural",
    microcredito_urbano: "microcredito_urbano",
    "microcredito urbano": "microcredito_urbano",
    consumo: "consumo",
    comercial: "comercial",
    libranza: "libranza",
  };
  return map[raw?.toLowerCase() ?? ""] ?? "microcredito_small";
}

export async function POST(request: Request) {
  if (!validateWitmeAuth(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const rawBody = (await request.json()) as unknown;
    const parsed = witmeLeadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload inválido", details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const data = parsed.data;
    const ip = getClientIp(request);

    const utm: UtmParams = {
      utmSource: data.utm_source ?? "witme",
      utmCampaign: data.utm_campaign,
      utmMedium: data.utm_medium,
      utmTerm: data.utm_term,
      utmContent: data.utm_content,
    };

    const lead = await createLead({
      tipoCredito: normalizeTipoCredito(data.tipo_credito ?? data.tipoCredito),
      nombre: data.nombre,
      cedula: data.cedula,
      telefono: data.telefono,
      email: data.email,
      datosFormulario: {
        ...(data.datos ?? data.datos_formulario ?? {}),
        fuente: "witme_webhook",
        payloadOriginal: rawBody,
      },
      origen: (inferOrigen(utm) as "witme") || "witme",
      utm,
      ip,
      aceptaTerminos: data.aceptaTerminos ?? data.acepta_terminos ?? false,
    });

    return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/leads/witme]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: "witme-webhook",
    configured: Boolean(process.env.WITME_API_KEY),
    method: "POST",
    auth: "Authorization: Bearer <WITME_API_KEY>",
  });
}
