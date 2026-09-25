import { normalizeDocumentNumber } from "@/domain/identity/cedula";
import type { TipoCredito, UtmParams } from "@/shared/types/credito";

const WITME_RESERVED_KEYS = new Set([
  "tipo_credito",
  "tipoCredito",
  "nombre",
  "cedula",
  "documento",
  "telefono",
  "celular",
  "email",
  "correo",
  "datos",
  "datos_formulario",
  "acepta_terminos",
  "aceptaTerminos",
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "utm_term",
  "utm_content",
  "witme_id",
  "witmeId",
  "id_externo",
  "external_id",
]);

/** Alias comunes de Witme → campos internos del formulario Small. */
const FIELD_ALIASES: Record<string, string> = {
  capital_solicitado: "capitalSeleccionado",
  monto: "capitalSeleccionado",
  monto_solicitado: "capitalSeleccionado",
  cantidad_cuotas: "cantidadCuotas",
  cuotas: "cantidadCuotas",
  valor_cuota: "valorCuota",
  tipo_identificacion: "tipoIdentificacion",
  estado_civil: "estadoCivil",
  fecha_nacimiento: "fechaNacimiento",
  fecha_expedicion: "fechaExpedicion",
  personas_a_cargo: "personasACargo",
  destino_credito: "destinoCredito",
  mora_vigente: "moraVigente",
  ingresos_mensuales: "ingresosMensuales",
  otros_ingresos: "otrosIngresos",
  origen_otros_ingresos: "origenOtrosIngresos",
  origen_otros_ingresos_otro: "origenOtrosIngresosOtro",
  sector_domicilio: "sectorDomicilio",
  tiene_vivienda: "tieneVivienda",
  tiene_vehiculo: "tieneVehiculo",
  placa_vehiculo: "placaVehiculo",
  fecha_ingreso: "fechaIngreso",
  referencia_tipo: "referenciaTipo",
  referencia_parentesco: "referenciaParentesco",
  referencia_parentesco_otro: "referenciaParentescoOtro",
  referencia_familiar_nombre: "referenciaFamiliarNombre",
  referencia_familiar_telefono: "referenciaFamiliarTelefono",
  tipo_cuenta: "tipoCuenta",
  entidad_bancaria: "entidadBancaria",
  numero_cuenta: "numeroCuenta",
  cedula_frontal: "cedulaFrontal",
  cedula_reverso: "cedulaReverso",
  video_verificacion: "videoVerificacion",
};

function normalizeFieldKey(key: string): string {
  return FIELD_ALIASES[key] ?? key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeFormData(...sources: unknown[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const source of sources) {
    if (!isPlainObject(source)) continue;

    for (const [rawKey, value] of Object.entries(source)) {
      if (value === undefined || value === null || value === "") continue;
      merged[normalizeFieldKey(rawKey)] = value;
    }
  }

  return merged;
}

function readString(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export function normalizeTipoCreditoFromWitme(raw: string | undefined): TipoCredito {
  const map: Record<string, TipoCredito> = {
    nanocredito: "microcredito_small",
    nanocrédito: "microcredito_small",
    microcredito_small: "microcredito_small",
    "microcredito small": "microcredito_small",
    small: "microcredito_small",
    libranza: "libranza",
    "credito libranza": "libranza",
    rural: "libranza",
    microcredito_urbano: "microcredito_urbano",
    "microcredito urbano": "microcredito_urbano",
    urbano: "microcredito_urbano",
    microcredito: "libranza",
    microcrédito: "libranza",
    consumo: "consumo",
    comercial: "comercial",
    libranza: "libranza",
  };
  return map[raw?.toLowerCase() ?? ""] ?? "microcredito_small";
}

export interface MappedWitmeLead {
  tipoCredito: TipoCredito;
  nombre: string;
  cedula: string;
  telefono: string;
  email?: string;
  aceptaTerminos: boolean;
  utm: UtmParams;
  witmeLeadId?: string;
  datosFormulario: Record<string, unknown>;
}

/** Normaliza el JSON que envía Witme al formato interno de Lead. */
export function mapWitmePayload(raw: Record<string, unknown>): MappedWitmeLead | null {
  const nombre = readString(raw, "nombre");
  const cedulaRaw = readString(raw, "cedula", "documento");
  const telefono = readString(raw, "telefono", "celular");

  if (!nombre || !cedulaRaw || !telefono) {
    return null;
  }

  const nestedSources = [raw.datos, raw.datos_formulario];
  const passthrough: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!WITME_RESERVED_KEYS.has(key)) {
      passthrough[key] = value;
    }
  }

  const datosFormulario = mergeFormData(...nestedSources, passthrough, {
    tipoCredito: normalizeTipoCreditoFromWitme(
      readString(raw, "tipo_credito", "tipoCredito"),
    ),
  });

  datosFormulario.fuente = "witme_webhook";
  datosFormulario.witmeLeadId =
    readString(raw, "witme_id", "witmeId", "id_externo", "external_id") ?? null;
  datosFormulario.payloadOriginal = raw;

  const email = readString(raw, "email", "correo") ?? readString(datosFormulario, "email");
  if (email) datosFormulario.email = email;

  const utm: UtmParams = {
    utmSource: readString(raw, "utm_source") ?? "witme",
    utmCampaign: readString(raw, "utm_campaign"),
    utmMedium: readString(raw, "utm_medium"),
    utmTerm: readString(raw, "utm_term"),
    utmContent: readString(raw, "utm_content"),
  };

  return {
    tipoCredito: normalizeTipoCreditoFromWitme(readString(raw, "tipo_credito", "tipoCredito")),
    nombre,
    cedula: normalizeDocumentNumber(cedulaRaw) || cedulaRaw,
    telefono,
    email,
    aceptaTerminos:
      raw.aceptaTerminos === true ||
      raw.acepta_terminos === true ||
      datosFormulario.aceptaTerminos === true,
    utm,
    witmeLeadId: readString(raw, "witme_id", "witmeId", "id_externo", "external_id"),
    datosFormulario,
  };
}
