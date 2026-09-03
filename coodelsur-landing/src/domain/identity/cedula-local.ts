import {
  getColombianCcFormatMessage,
  isValidCcFormat,
  normalizeDocumentNumber,
} from "@/domain/identity/cedula";

export type LocalValidationIssue =
  | "invalid_format"
  | "invalid_name"
  | "underage"
  | "invalid_birth_date"
  | "invalid_expedition_date"
  | "expedition_before_birth"
  | "expedition_in_future";

export interface LocalIdentityValidationInput {
  documentType: string;
  documentNumber: string;
  nombre: string;
  fechaNacimiento: string;
  fechaExpedicion: string;
}

export interface LocalIdentityValidationResult {
  ok: boolean;
  issues: LocalValidationIssue[];
  messages: string[];
  meta: {
    age?: number;
    documentType: string;
    documentNumber: string;
  };
}

const MIN_CREDIT_AGE = 18;
const MIN_NAME_WORDS = 2;

function parseIsoDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function calculateAge(birthDate: Date, reference = new Date()): number {
  let age = reference.getFullYear() - birthDate.getFullYear();
  const monthDiff = reference.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function isValidName(nombre: string): boolean {
  const trimmed = nombre.trim();
  if (trimmed.length < 5) return false;
  if (/\d/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length >= MIN_NAME_WORDS;
}

/** Reglas de formato por tipo de documento colombiano. */
export function isValidDocumentFormat(documentType: string, documentNumber: string): boolean {
  const type = documentType.trim().toUpperCase();
  const digits = normalizeDocumentNumber(documentNumber);
  const alphanumeric = documentNumber.replace(/\s/g, "").toUpperCase();

  switch (type) {
    case "CC":
      return isValidCcFormat(documentNumber);
    case "CE":
      return /^\d{6,10}$/.test(digits);
    case "TI":
      return /^\d{10,11}$/.test(digits);
    case "PPT":
      return /^\d{5,8}$/.test(digits);
    case "NIT":
      return /^\d{9,10}$/.test(digits);
    case "PAS":
      return /^[A-Z0-9]{5,15}$/.test(alphanumeric);
    default:
      return digits.length >= 5 && digits.length <= 15;
  }
}

export function validateLocalIdentity(
  input: LocalIdentityValidationInput,
): LocalIdentityValidationResult {
  const documentType = input.documentType.trim().toUpperCase();
  const documentNumber = normalizeDocumentNumber(input.documentNumber);
  const issues: LocalValidationIssue[] = [];
  const messages: string[] = [];

  if (!isValidDocumentFormat(documentType, input.documentNumber)) {
    issues.push("invalid_format");
    messages.push(getDocumentFormatMessage(documentType));
  }

  if (!isValidName(input.nombre)) {
    issues.push("invalid_name");
    messages.push("Ingresa tu nombre completo (nombre y apellido, sin números).");
  }

  const birthDate = parseIsoDate(input.fechaNacimiento);
  if (!birthDate) {
    issues.push("invalid_birth_date");
    messages.push("La fecha de nacimiento no es válida.");
  }

  const expeditionDate = parseIsoDate(input.fechaExpedicion);
  if (!expeditionDate) {
    issues.push("invalid_expedition_date");
    messages.push("La fecha de expedición del documento no es válida.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let age: number | undefined;

  if (birthDate) {
    age = calculateAge(birthDate, today);
    if (age < MIN_CREDIT_AGE) {
      issues.push("underage");
      messages.push(`Debes ser mayor de ${MIN_CREDIT_AGE} años para solicitar crédito.`);
    }
  }

  if (birthDate && expeditionDate) {
    if (expeditionDate <= birthDate) {
      issues.push("expedition_before_birth");
      messages.push("La fecha de expedición debe ser posterior a la fecha de nacimiento.");
    } else if (documentType === "CC") {
      const ageAtExpedition = calculateAge(birthDate, expeditionDate);
      if (ageAtExpedition < MIN_CREDIT_AGE) {
        issues.push("invalid_expedition_date");
        messages.push(
          "La cédula de ciudadanía suele expedirse a partir de los 18 años. Revisa las fechas.",
        );
      }
    }
  }

  if (expeditionDate && expeditionDate > today) {
    issues.push("expedition_in_future");
    messages.push("La fecha de expedición no puede ser futura.");
  }

  return {
    ok: issues.length === 0,
    issues,
    messages,
    meta: {
      age,
      documentType,
      documentNumber,
    },
  };
}

function getDocumentFormatMessage(documentType: string): string {
  switch (documentType.toUpperCase()) {
    case "CC":
      return getColombianCcFormatMessage();
    case "CE":
      return "La cédula de extranjería debe tener entre 6 y 10 dígitos.";
    case "TI":
      return "La tarjeta de identidad debe tener 10 u 11 dígitos.";
    case "PPT":
      return "El PPT debe tener entre 5 y 8 dígitos.";
    case "NIT":
      return "El NIT debe tener 9 o 10 dígitos.";
    case "PAS":
      return "El pasaporte debe tener entre 5 y 15 caracteres alfanuméricos.";
    default:
      return "El número de identificación no tiene un formato válido.";
  }
}

export function buildLocalValidationSuccessMessage(documentType: string): string {
  if (documentType.toUpperCase() === "CC") {
    return "Cédula con formato válido. Validaremos con las fotos adjuntas y revisión del equipo.";
  }
  return "Documento con formato válido. Se revisará manualmente con los archivos adjuntos.";
}

/** Normaliza el valor mientras el usuario escribe, según el tipo de documento. */
export function formatDocumentInput(documentType: string, value: string): string {
  const type = documentType.trim().toUpperCase();

  if (type === "PAS") {
    return value.replace(/\s/g, "").toUpperCase().slice(0, 15);
  }

  const digits = normalizeDocumentNumber(value);
  const maxLength = type === "TI" ? 11 : 10;
  return digits.slice(0, maxLength);
}

export function getDocumentFormatHint(documentType: string): string | undefined {
  switch (documentType.trim().toUpperCase()) {
    case "CC":
      return "Solo números. Cédula colombiana: 6, 7 o 10 dígitos.";
    case "CE":
      return "Solo números. Cédula de extranjería: entre 6 y 10 dígitos.";
    case "TI":
      return "Solo números. Tarjeta de identidad: 10 u 11 dígitos.";
    default:
      return undefined;
  }
}
