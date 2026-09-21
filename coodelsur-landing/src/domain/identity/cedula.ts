/**
 * Validación y verificación de documentos de identidad colombianos.
 *
 * Formato CC: 6, 7, 8 o 10 dígitos. Integración opcional con Verifik/Registraduría.
 *
 * @see cedula-local.ts — validación offline usada en el formulario
 * @see POST /api/verify-cedula — endpoint de verificación externa
 */

/** Normaliza número de documento: solo dígitos. */
export function normalizeDocumentNumber(value: string): string {
  return value.replace(/\D/g, "");
}

/** Longitudes válidas de cédula de ciudadanía colombiana (Registraduría). */
export const COLOMBIAN_CC_LENGTHS = [6, 7, 8, 10] as const;

export function isValidColombianCcLength(digitCount: number): boolean {
  return (COLOMBIAN_CC_LENGTHS as readonly number[]).includes(digitCount);
}

/** Cédula de ciudadanía colombiana: 6, 7, 8 o 10 dígitos numéricos. */
export function isValidCcFormat(documentNumber: string): boolean {
  const digits = normalizeDocumentNumber(documentNumber);
  if (!/^\d+$/.test(digits)) return false;
  return isValidColombianCcLength(digits.length);
}

export function getColombianCcFormatMessage(): string {
  return "La cédula de ciudadanía debe tener 6, 7, 8 o 10 dígitos (solo números, formato colombiano).";
}

/** Convierte YYYY-MM-DD (input date) a DD/MM/YYYY (Verifik). */
export function toVerifikDate(isoDate: string): string | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export type CedulaVerificationStatus =
  | "valid"
  | "not_found"
  | "name_mismatch"
  | "invalid_format"
  | "unsupported_document"
  | "service_unavailable"
  | "not_configured";

export interface CedulaVerificationResult {
  status: CedulaVerificationStatus;
  message: string;
  provider?: "verifik";
  documentType?: string;
  documentNumber?: string;
  registeredName?: string;
  raw?: Record<string, unknown>;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function namesRoughlyMatch(formName: string, registeredName: string): boolean {
  const a = normalizeName(formName);
  const b = normalizeName(registeredName);
  if (!a || !b) return true;
  if (a === b) return true;

  const aParts = a.split(" ").filter(Boolean);
  const bParts = b.split(" ").filter(Boolean);
  const overlap = aParts.filter((part) => bParts.includes(part)).length;
  return overlap >= Math.min(2, Math.min(aParts.length, bParts.length));
}

function extractRegisteredName(payload: Record<string, unknown>): string | undefined {
  const data = payload.data as Record<string, unknown> | undefined;
  const candidate =
    (typeof data?.fullName === "string" && data.fullName) ||
    (typeof data?.nombre === "string" && data.nombre) ||
    (typeof payload.fullName === "string" && payload.fullName) ||
    (typeof payload.nombre === "string" && payload.nombre);

  return candidate || undefined;
}

/**
 * Consulta Registraduría vía Verifik (servicio de pago).
 * Requiere VERIFIK_API_KEY. Sin clave, devuelve `not_configured`.
 */
export async function verifyCedulaWithProvider(input: {
  documentType: string;
  documentNumber: string;
  nombre?: string;
  fechaExpedicion?: string;
}): Promise<CedulaVerificationResult> {
  const documentType = input.documentType.trim().toUpperCase();
  const documentNumber = normalizeDocumentNumber(input.documentNumber);

  if (documentType !== "CC") {
    return {
      status: "unsupported_document",
      message:
        "La verificación automática con Registraduría aplica solo a cédula de ciudadanía (CC). Tu solicitud se revisará manualmente.",
      documentType,
      documentNumber,
    };
  }

  if (!isValidCcFormat(documentNumber)) {
    return {
      status: "invalid_format",
      message: getColombianCcFormatMessage(),
      documentType,
      documentNumber,
    };
  }

  const apiKey = process.env.VERIFIK_API_KEY?.trim();
  if (!apiKey) {
    return {
      status: "not_configured",
      message:
        "La verificación en línea no está activa. Tu documento se validará manualmente al revisar la solicitud.",
      documentType,
      documentNumber,
    };
  }

  try {
    const url = new URL("https://api.verifik.co/v2/co/cedula/registraduria");
    url.searchParams.set("documentType", "CC");
    url.searchParams.set("documentNumber", documentNumber);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      if (response.status === 404) {
        return {
          status: "not_found",
          message: "No encontramos esta cédula en Registraduría. Revisa el número ingresado.",
          provider: "verifik",
          documentType,
          documentNumber,
          raw: payload,
        };
      }

      return {
        status: "service_unavailable",
        message:
          "No pudimos consultar Registraduría en este momento. Puedes continuar; validaremos tu documento manualmente.",
        provider: "verifik",
        documentType,
        documentNumber,
        raw: payload,
      };
    }

    const registeredName = extractRegisteredName(payload);
    if (input.nombre && registeredName && !namesRoughlyMatch(input.nombre, registeredName)) {
      return {
        status: "name_mismatch",
        message:
          "La cédula existe, pero el nombre no coincide con el registrado. Verifica tus datos.",
        provider: "verifik",
        documentType,
        documentNumber,
        registeredName,
        raw: payload,
      };
    }

    return {
      status: "valid",
      message: registeredName
        ? `Cédula verificada en Registraduría (${registeredName}).`
        : "Cédula verificada en Registraduría.",
      provider: "verifik",
      documentType,
      documentNumber,
      registeredName,
      raw: payload,
    };
  } catch (error) {
    console.error("[verifyCedulaWithProvider]", error);
    return {
      status: "service_unavailable",
      message:
        "No pudimos consultar Registraduría en este momento. Puedes continuar; validaremos tu documento manualmente.",
      provider: "verifik",
      documentType,
      documentNumber,
    };
  }
}
