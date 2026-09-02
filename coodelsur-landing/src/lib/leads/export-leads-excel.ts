/**
 * Exportación de solicitudes a Excel para el panel admin.
 * Solo incluye la información principal, organizada para revisión operativa.
 */

import { isAttachmentAvailable } from "@/lib/leads/attachments";
import { formatCOP } from "@/lib/utils";
import * as XLSX from "xlsx-js-style";

export interface LeadExportRecord {
  id: string;
  tipoCredito: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string | null;
  origen: string;
  estado: string;
  aceptaTerminos: boolean;
  fechaCreacion: Date | string;
  capitalSolicitado?: number | null;
  progresoFormulario?: number | null;
  pasoActualFormulario?: string | null;
  datosFormulario: unknown;
}

interface ExportColumn {
  header: string;
  width: number;
  value: (lead: LeadExportRecord) => string | number;
}

const ESTADO_LABELS: Record<string, string> = {
  incompleto: "Incompleta",
  recibido: "Recibida",
  revisado: "Revisada",
  contactado: "Contactada",
  descartado: "Descartada",
};

const TIPO_CREDITO_LABELS: Record<string, string> = {
  microcredito_small: "Microcrédito Small",
};

function datosOf(lead: LeadExportRecord): Record<string, unknown> {
  if (!lead.datosFormulario || typeof lead.datosFormulario !== "object") return {};
  return lead.datosFormulario as Record<string, unknown>;
}

function readString(datos: Record<string, unknown>, key: string): string {
  const value = datos[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readNumber(datos: Record<string, unknown>, key: string): number | null {
  const value = datos[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return formatCOP(value);
}

function attachmentStatus(datos: Record<string, unknown>, field: string): string {
  return isAttachmentAvailable(datos[field]) ? "Sí" : "No";
}

/** Columnas principales del informe operativo. */
const EXPORT_COLUMNS: ExportColumn[] = [
  {
    header: "Fecha solicitud",
    width: 18,
    value: (l) => formatDate(l.fechaCreacion),
  },
  {
    header: "Estado",
    width: 14,
    value: (l) => ESTADO_LABELS[l.estado] ?? l.estado,
  },
  {
    header: "Producto",
    width: 20,
    value: (l) => TIPO_CREDITO_LABELS[l.tipoCredito] ?? l.tipoCredito,
  },
  {
    header: "Nombre",
    width: 28,
    value: (l) => l.nombre,
  },
  {
    header: "Documento",
    width: 16,
    value: (l) => l.cedula,
  },
  {
    header: "Teléfono",
    width: 14,
    value: (l) => l.telefono,
  },
  {
    header: "Email",
    width: 26,
    value: (l) => l.email ?? "",
  },
  {
    header: "Monto solicitado",
    width: 18,
    value: (l) => {
      const monto =
        l.capitalSolicitado ?? readNumber(datosOf(l), "capitalSeleccionado");
      return monto !== null ? formatMoney(monto) : "";
    },
  },
  {
    header: "Cuotas",
    width: 10,
    value: (l) => readNumber(datosOf(l), "cantidadCuotas") ?? "",
  },
  {
    header: "Valor cuota",
    width: 16,
    value: (l) => {
      const cuota = readNumber(datosOf(l), "valorCuota");
      return cuota !== null ? formatMoney(cuota) : "";
    },
  },
  {
    header: "Destino crédito",
    width: 22,
    value: (l) => readString(datosOf(l), "destinoCredito"),
  },
  {
    header: "Ingresos mensuales",
    width: 18,
    value: (l) => {
      const ingresos = readNumber(datosOf(l), "ingresosMensuales");
      return ingresos !== null ? formatMoney(ingresos) : "";
    },
  },
  {
    header: "Departamento",
    width: 16,
    value: (l) => readString(datosOf(l), "departamento"),
  },
  {
    header: "Municipio",
    width: 16,
    value: (l) => readString(datosOf(l), "municipio"),
  },
  {
    header: "Dirección",
    width: 30,
    value: (l) => {
      const datos = datosOf(l);
      return [readString(datos, "direccion"), readString(datos, "barrio")]
        .filter(Boolean)
        .join(", ");
    },
  },
  {
    header: "Referencia",
    width: 24,
    value: (l) => readString(datosOf(l), "referenciaFamiliarNombre"),
  },
  {
    header: "Tel. referencia",
    width: 14,
    value: (l) => readString(datosOf(l), "referenciaFamiliarTelefono"),
  },
  {
    header: "Banco",
    width: 20,
    value: (l) => readString(datosOf(l), "entidadBancaria"),
  },
  {
    header: "Cuenta / llave",
    width: 20,
    value: (l) => readString(datosOf(l), "numeroCuenta"),
  },
  {
    header: "Origen",
    width: 12,
    value: (l) => l.origen,
  },
  {
    header: "Progreso (%)",
    width: 12,
    value: (l) => {
      if (l.estado !== "incompleto") return "";
      if (l.progresoFormulario !== null && l.progresoFormulario !== undefined) {
        return l.progresoFormulario;
      }
      const progreso = datosOf(l)._progreso;
      if (progreso && typeof progreso === "object") {
        const porcentaje = (progreso as { porcentaje?: unknown }).porcentaje;
        return typeof porcentaje === "number" ? porcentaje : "";
      }
      return "";
    },
  },
  {
    header: "Cédula adjunta",
    width: 14,
    value: (l) => {
      const datos = datosOf(l);
      const frontal = attachmentStatus(datos, "cedulaFrontal");
      const reverso = attachmentStatus(datos, "cedulaReverso");
      if (frontal === "Sí" && reverso === "Sí") return "Completa";
      if (frontal === "Sí" || reverso === "Sí") return "Parcial";
      return "No";
    },
  },
  {
    header: "Video",
    width: 10,
    value: (l) => attachmentStatus(datosOf(l), "videoVerificacion"),
  },
  {
    header: "Firma",
    width: 10,
    value: (l) => attachmentStatus(datosOf(l), "firma"),
  },
  {
    header: "ID solicitud",
    width: 38,
    value: (l) => l.id,
  },
];

function applyHeaderBoldStyle(worksheet: XLSX.WorkSheet, columnCount: number) {
  for (let column = 0; column < columnCount; column += 1) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: column });
    const cell = worksheet[cellRef];
    if (!cell) continue;
    cell.s = {
      font: { bold: true },
      alignment: { vertical: "center", wrapText: true },
    };
  }
}

/** Construye el buffer `.xlsx` con una hoja "Solicitudes". */
export function buildLeadsExcelBuffer(leads: LeadExportRecord[]): Buffer {
  const headers = EXPORT_COLUMNS.map((column) => column.header);
  const rows = leads.map((lead) =>
    EXPORT_COLUMNS.map((column) => {
      const value = column.value(lead);
      if (value === null || value === undefined) return "";
      return value;
    }),
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = EXPORT_COLUMNS.map((column) => ({ wch: column.width }));
  applyHeaderBoldStyle(worksheet, headers.length);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Solicitudes");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildExportFilename(scope: "selected" | "report"): string {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = scope === "selected" ? "seleccionadas" : "informe-general";
  return `solicitudes-coodelsur-${suffix}-${date}.xlsx`;
}
