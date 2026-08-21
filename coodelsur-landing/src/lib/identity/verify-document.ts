import {
  buildLocalValidationSuccessMessage,
  validateLocalIdentity,
} from "@/lib/identity/cedula-local";
import {
  verifyCedulaWithProvider,
  type CedulaVerificationStatus,
} from "@/lib/identity/cedula";
import { findRecentDuplicateCedula } from "@/lib/leads/duplicate-cedula";

export interface DocumentVerificationInput {
  documentType: string;
  documentNumber: string;
  nombre: string;
  fechaNacimiento: string;
  fechaExpedicion: string;
  checkDuplicate?: boolean;
}

export interface DocumentVerificationResult {
  ok: boolean;
  status: CedulaVerificationStatus | "valid_local" | "duplicate";
  message: string;
  registeredName?: string;
  localChecks?: string[];
  duplicateLeadId?: string;
  provider?: "local" | "verifik";
}

/**
 * Validación gratuita (formato, edad, fechas, nombre) + duplicados en DB.
 * Si VERIFIK_API_KEY está configurada, agrega consulta opcional a Registraduría.
 */
export async function verifyDocumentComplete(
  input: DocumentVerificationInput,
): Promise<DocumentVerificationResult> {
  const local = validateLocalIdentity(input);

  if (!local.ok) {
    return {
      ok: false,
      status: mapLocalIssueToStatus(local.issues[0] ?? "invalid_format"),
      message: local.messages[0] ?? "Los datos del documento no son válidos.",
      localChecks: local.messages,
      provider: "local",
    };
  }

  if (input.checkDuplicate) {
    const duplicate = await findRecentDuplicateCedula(input.documentNumber);
    if (duplicate.duplicate) {
      return {
        ok: false,
        status: "duplicate",
        message: duplicate.message ?? "Ya existe una solicitud con este documento.",
        duplicateLeadId: duplicate.existingLeadId,
        provider: "local",
      };
    }
  }

  const documentType = input.documentType.trim().toUpperCase();
  const baseMessage = buildLocalValidationSuccessMessage(documentType);

  if (documentType === "CC" && process.env.VERIFIK_API_KEY?.trim()) {
    const providerResult = await verifyCedulaWithProvider({
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      nombre: input.nombre,
      fechaExpedicion: input.fechaExpedicion,
    });

    if (
      providerResult.status === "not_found" ||
      providerResult.status === "name_mismatch" ||
      providerResult.status === "invalid_format"
    ) {
      return {
        ok: false,
        status: providerResult.status,
        message: providerResult.message,
        registeredName: providerResult.registeredName,
        provider: "verifik",
      };
    }

    if (providerResult.status === "valid") {
      return {
        ok: true,
        status: "valid",
        message: providerResult.message,
        registeredName: providerResult.registeredName,
        provider: "verifik",
      };
    }
  }

  return {
    ok: true,
    status: "valid_local",
    message: baseMessage,
    localChecks: [
      "Formato de documento válido",
      `Mayor de edad (${local.meta.age ?? "18+"} años)`,
      "Fechas de nacimiento y expedición coherentes",
      input.checkDuplicate ? "Sin solicitudes duplicadas recientes" : "Validación local completada",
    ],
    provider: "local",
  };
}

function mapLocalIssueToStatus(issue: string): CedulaVerificationStatus {
  switch (issue) {
    case "invalid_name":
      return "name_mismatch";
    default:
      return "invalid_format";
  }
}

export function buildCedulaVerificacionPayload(result: DocumentVerificationResult) {
  return {
    status: result.status,
    message: result.message,
    registeredName: result.registeredName,
    localChecks: result.localChecks,
    duplicateLeadId: result.duplicateLeadId,
    provider: result.provider,
    verifiedAt: new Date().toISOString(),
  };
}
