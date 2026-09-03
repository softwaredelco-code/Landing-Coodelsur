import { formSectionsNanocredito } from "@/shared/config/creditos/form-sections";
import { formatCOP } from "@/shared/utils";

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
