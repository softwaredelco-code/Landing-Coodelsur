import { formSectionsNanocredito } from "@/shared/config/creditos/form-sections";
import { formatCOP } from "@/shared/utils";

const KNOWN_FORM_FIELD_NAMES = new Set(
  formSectionsNanocredito.flatMap((section) => section.fields.map((field) => field.name)),
);

const WITME_METADATA_KEYS = new Set([
  "fuente",
  "witmeLeadId",
  "payloadOriginal",
  "_progreso",
  "resultadoNodos",
  "cedulaVerificacion",
]);

export interface AdminLeadField {
  label: string;
  value: string;
}

export interface AdminLeadSection {
  id: string;
  title: string;
  fields: AdminLeadField[];
}

const MONEY_FIELDS = new Set([
  "capitalSeleccionado",
  "valorCuota",
  "ingresosMensuales",
  "otrosIngresos",
  "valorCreditoFinanciado",
  "estudioCredito",
  "cuotaCapitalInteres",
  "cuotaFianzaMensual",
  "cuotaVidaDeudoresMensual",
]);

const SKIP_FIELDS = new Set([
  "cedulaFrontal",
  "cedulaReverso",
  "videoVerificacion",
  "firma",
  "geolocalizacion",
  "tipoCredito",
]);

/** Ya se muestran en la tarjeta de contacto del detalle. */
const CONTACT_SUMMARY_FIELDS = new Set(["nombre", "email", "cedula", "telefono"]);

function formatFieldValue(name: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (MONEY_FIELDS.has(name)) return formatCOP(value);
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "—";
  }
  return "—";
}

/** Agrupa los datos del formulario en secciones legibles para el panel admin. */
export function buildAdminLeadSections(datosFormulario: unknown): AdminLeadSection[] {
  const datos =
    datosFormulario && typeof datosFormulario === "object"
      ? (datosFormulario as Record<string, unknown>)
      : {};

  return formSectionsNanocredito
    .filter((section) => section.id !== "verificacion" && section.id !== "domicilio")
    .map((section) => ({
      id: section.id,
      title: section.title,
      fields: section.fields
        .filter((field) => field.type !== "hidden" && !SKIP_FIELDS.has(field.name))
        .filter(
          (field) =>
            !(section.id === "general" && CONTACT_SUMMARY_FIELDS.has(field.name)),
        )
        .map((field) => ({
          label: field.label,
          value: formatFieldValue(field.name, datos[field.name]),
        })),
    }))
    .filter((section) => section.fields.some((field) => field.value !== "—"));
}

/** Campos de Witme que no coinciden con el catálogo del formulario Small. */
export function buildAdminWitmeExtraSection(datosFormulario: unknown): AdminLeadSection | null {
  const datos =
    datosFormulario && typeof datosFormulario === "object"
      ? (datosFormulario as Record<string, unknown>)
      : {};

  if (datos.fuente !== "witme_webhook") return null;

  const fields = Object.entries(datos)
    .filter(([key]) => !KNOWN_FORM_FIELD_NAMES.has(key) && !WITME_METADATA_KEYS.has(key))
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({
      label: key,
      value: formatFieldValue(key, value),
    }))
    .filter((field) => field.value !== "—");

  if (fields.length === 0) return null;

  return {
    id: "witme-extra",
    title: "Datos adicionales (Witme)",
    fields,
  };
}
