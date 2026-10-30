/**
 * Generador de informe resumen de solicitudes por Estado y Producto en Excel (.xlsx).
 * Replica con precisión el diseño corporativo de Coodelsur:
 * - Filtro superior de Origen / Canal y Producto con celda destacada.
 * - Tabla con encabezados verde oliva (#708238) y texto en blanco.
 * - Fila "Aprobado" destacada en verde suave (#E2EFDA).
 * - Columna de cantidad con formato numérico y columna de porcentaje (%).
 * - Fila de "Total general" en negrita con borde superior simple y borde inferior doble.
 */

import { formatLeadOrigen } from "@/domain/lead/lead-origin";
import * as XLSX from "xlsx-js-style";

export interface ResumenRow {
  estadoKey: string;
  estadoLabel: string;
  cantidad: number;
  porcentaje: number; // 0 a 1 (ej: 0.05 para 5%)
  porcentajeDisplay: string; // ej: "5%"
  highlight: boolean;
}

export interface ResumenInformeData {
  origenLabel: string;
  productoLabel: string;
  periodoLabel?: string | null;
  filas: ResumenRow[];
  totalGeneral: number;
}

export const PRODUCTOS_INFORME: Array<{ value: string; label: string }> = [
  { value: "microcredito_small", label: "Microcrédito Small" },
  { value: "microcredito_urbano", label: "Microcrédito Urbano" },
  { value: "microcredito_rural", label: "Microcrédito Rural" },
  { value: "libranza", label: "Crédito Libranza" },
  { value: "consumo", label: "Crédito Consumo" },
  { value: "comercial", label: "Crédito Comercial" },
];

export const TIPO_CREDITO_LABELS: Record<string, string> = {
  microcredito_small: "Microcrédito Small",
  microcredito_urbano: "Microcrédito Urbano",
  microcredito_rural: "Microcrédito Rural",
  libranza: "Crédito Libranza",
  consumo: "Crédito Consumo",
  comercial: "Crédito Comercial",
};

export const ESTADOS_ORDEN_RESUMEN = [
  {
    key: "aprobado",
    label: "Aprobado",
    highlight: true,
    aliases: ["aprobado"],
    alwaysInclude: true,
  },
  {
    key: "desembolsado",
    label: "Desembolsado",
    highlight: false,
    aliases: ["desembolsado"],
    alwaysInclude: true,
  },
  {
    key: "incompleto",
    label: "Incompleta",
    highlight: false,
    aliases: ["incompleto"],
    alwaysInclude: true,
  },
  {
    key: "rechazado_no_cumple",
    label: "Rechazado: No cumple requisitos",
    highlight: false,
    aliases: ["rechazado_no_cumple", "descartado"],
    alwaysInclude: true,
  },
  {
    key: "rechazado_reportado",
    label: "Rechazado: Reportado",
    highlight: false,
    aliases: ["rechazado_reportado"],
    alwaysInclude: true,
  },
  {
    key: "completo",
    label: "Completa",
    highlight: false,
    aliases: ["completo", "recibido"],
    alwaysInclude: true,
  },
  {
    key: "no_interesado",
    label: "No interesado",
    highlight: false,
    aliases: ["no_interesado"],
    alwaysInclude: true,
  },
  {
    key: "por_contactar",
    label: "Por Contactar",
    highlight: false,
    aliases: ["por_contactar", "revisado", "contactado"],
    alwaysInclude: false, // se incluye si hay registros
  },
] as const;

/**
 * Calcula los datos del informe a partir de conteos por estado o lista de leads.
 */
export function calcularDatosResumen(params: {
  tipoCredito?: string | null;
  origen?: string | null;
  mes?: string | null;
  periodoLabel?: string | null;
  countsByEstado: Record<string, number>;
}): ResumenInformeData {
  const { tipoCredito, origen, mes, periodoLabel, countsByEstado } = params;

  const productoLabel = tipoCredito
    ? TIPO_CREDITO_LABELS[tipoCredito] ?? tipoCredito
    : "(Varios elementos)";

  const origenLabel = origen ? formatLeadOrigen(origen) : "(Varios elementos)";

  // Calcular totales mapeados
  const filas: ResumenRow[] = [];
  const processedAliases = new Set<string>();
  let totalGeneral = 0;

  for (const def of ESTADOS_ORDEN_RESUMEN) {
    let cant = 0;
    for (const alias of def.aliases) {
      cant += countsByEstado[alias] ?? 0;
      processedAliases.add(alias);
    }

    if (def.alwaysInclude || cant > 0) {
      filas.push({
        estadoKey: def.key,
        estadoLabel: def.label,
        cantidad: cant,
        porcentaje: 0,
        porcentajeDisplay: "0%",
        highlight: def.highlight,
      });
      totalGeneral += cant;
    }
  }

  // Si hay algún estado inesperado en countsByEstado que no fue mapeado
  for (const [key, count] of Object.entries(countsByEstado)) {
    if (!processedAliases.has(key) && count > 0) {
      filas.push({
        estadoKey: key,
        estadoLabel: key,
        cantidad: count,
        porcentaje: 0,
        porcentajeDisplay: "0%",
        highlight: false,
      });
      totalGeneral += count;
    }
  }

  // Calcular porcentajes
  for (const fila of filas) {
    const pct = totalGeneral > 0 ? fila.cantidad / totalGeneral : 0;
    fila.porcentaje = pct;
    fila.porcentajeDisplay = `${Math.round(pct * 100)}%`;
  }

  return {
    origenLabel,
    productoLabel,
    periodoLabel: periodoLabel || (mes ? `Mes: ${mes}` : null),
    filas,
    totalGeneral,
  };
}

/**
 * Construye el buffer binario del archivo Excel (.xlsx) con estilos exactos.
 */
export function buildResumenExcelBuffer(data: ResumenInformeData): Uint8Array {
  const ws: XLSX.WorkSheet = {};
  let currentRow = 1;

  // 1. Origen / Canal
  ws[`A${currentRow}`] = {
    t: "s",
    v: "Origen / Canal",
    s: { font: { name: "Calibri", sz: 11 }, alignment: { vertical: "center" } },
  };
  ws[`B${currentRow}`] = {
    t: "s",
    v: data.origenLabel,
    s: {
      font: { name: "Calibri", sz: 11 },
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "C0C0C0" } },
        bottom: { style: "thin", color: { rgb: "C0C0C0" } },
        left: { style: "thin", color: { rgb: "C0C0C0" } },
        right: { style: "thin", color: { rgb: "C0C0C0" } },
      },
    },
  };
  currentRow += 1;

  // 2. Producto
  ws[`A${currentRow}`] = {
    t: "s",
    v: "Producto",
    s: { font: { name: "Calibri", sz: 11 }, alignment: { vertical: "center" } },
  };
  ws[`B${currentRow}`] = {
    t: "s",
    v: data.productoLabel,
    s: {
      font: { name: "Calibri", sz: 11, bold: true },
      fill: { fgColor: { rgb: "A9D18E" } }, // Verde destacado del selector
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "849E5D" } },
        bottom: { style: "thin", color: { rgb: "849E5D" } },
        left: { style: "thin", color: { rgb: "849E5D" } },
        right: { style: "thin", color: { rgb: "849E5D" } },
      },
    },
  };
  currentRow += 1;

  // 3. Período (opcional si viene filtrado)
  if (data.periodoLabel) {
    ws[`A${currentRow}`] = {
      t: "s",
      v: "Período",
      s: { font: { name: "Calibri", sz: 11 }, alignment: { vertical: "center" } },
    };
    ws[`B${currentRow}`] = {
      t: "s",
      v: data.periodoLabel,
      s: {
        font: { name: "Calibri", sz: 11 },
        alignment: { horizontal: "left", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "C0C0C0" } },
          bottom: { style: "thin", color: { rgb: "C0C0C0" } },
          left: { style: "thin", color: { rgb: "C0C0C0" } },
          right: { style: "thin", color: { rgb: "C0C0C0" } },
        },
      },
    };
    currentRow += 1;
  }

  // Fila vacía separadora
  currentRow += 1;
  const headerRowIndex = currentRow;

  // 4. Encabezados de la tabla: ESTADO | CANTIDAD | %
  const headerStyle = {
    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "708238" } }, // Verde oliva corporativo
    alignment: { vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "59682C" } },
      bottom: { style: "thin", color: { rgb: "59682C" } },
      left: { style: "thin", color: { rgb: "59682C" } },
      right: { style: "thin", color: { rgb: "59682C" } },
    },
  };

  ws[`A${headerRowIndex}`] = {
    t: "s",
    v: "ESTADO",
    s: { ...headerStyle, alignment: { horizontal: "left", vertical: "center" } },
  };
  ws[`B${headerRowIndex}`] = {
    t: "s",
    v: "CANTIDAD",
    s: { ...headerStyle, alignment: { horizontal: "right", vertical: "center" } },
  };
  ws[`C${headerRowIndex}`] = {
    t: "s",
    v: "%",
    s: { ...headerStyle, alignment: { horizontal: "right", vertical: "center" } },
  };

  currentRow += 1;
  const dataStartRow = currentRow;

  // 5. Filas de datos
  for (const fila of data.filas) {
    const bgFill = fila.highlight ? { fgColor: { rgb: "E2EFDA" } } : undefined;

    const rowStyle = {
      font: { name: "Calibri", sz: 11 },
      ...(bgFill ? { fill: bgFill } : {}),
      alignment: { vertical: "center" },
    };

    ws[`A${currentRow}`] = {
      t: "s",
      v: fila.estadoLabel,
      s: { ...rowStyle, alignment: { horizontal: "left", vertical: "center" } },
    };

    ws[`B${currentRow}`] = {
      t: "n",
      v: fila.cantidad,
      z: "#,##0",
      s: { ...rowStyle, alignment: { horizontal: "right", vertical: "center" } },
    };

    ws[`C${currentRow}`] = {
      t: "n",
      v: fila.porcentaje,
      z: "0%",
      s: { ...rowStyle, alignment: { horizontal: "right", vertical: "center" } },
    };

    currentRow += 1;
  }

  const dataEndRow = currentRow - 1;

  // 6. Fila Total General
  const totalBorder = {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "double", color: { rgb: "000000" } },
  };

  const totalStyle = {
    font: { name: "Calibri", sz: 11, bold: true },
    border: totalBorder,
    alignment: { vertical: "center" },
  };

  ws[`A${currentRow}`] = {
    t: "s",
    v: "Total general",
    s: { ...totalStyle, alignment: { horizontal: "left", vertical: "center" } },
  };

  ws[`B${currentRow}`] = {
    t: "n",
    v: data.totalGeneral,
    z: "#,##0",
    s: { ...totalStyle, alignment: { horizontal: "right", vertical: "center" } },
  };

  ws[`C${currentRow}`] = {
    t: "n",
    v: 1.0,
    z: "0%",
    s: { ...totalStyle, alignment: { horizontal: "right", vertical: "center" } },
  };

  // 7. Dimensiones y autofiltro
  ws["!ref"] = `A1:C${currentRow}`;
  ws["!cols"] = [{ wch: 38 }, { wch: 15 }, { wch: 10 }];

  const rowHeights: Array<{ hpt: number }> = [];
  for (let r = 1; r <= currentRow; r += 1) {
    if (r === headerRowIndex) {
      rowHeights.push({ hpt: 22 });
    } else if (r === headerRowIndex - 1) {
      rowHeights.push({ hpt: 10 });
    } else {
      rowHeights.push({ hpt: 19 });
    }
  }
  ws["!rows"] = rowHeights;

  if (dataEndRow >= dataStartRow) {
    ws["!autofilter"] = { ref: `A${headerRowIndex}:C${dataEndRow}` };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, "Informe por Estado");

  const raw = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  });
  return new Uint8Array(raw);
}

/**
 * Nombre de archivo sugerido para la descarga del resumen.
 */
export function buildResumenFilename(
  tipoCredito?: string | null,
  mes?: string | null,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const slugProducto = tipoCredito ? tipoCredito.replace(/_/g, "-") : "todos-los-productos";
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    return `informe-resumen-${slugProducto}-${mes}.xlsx`;
  }
  return `informe-resumen-${slugProducto}-${date}.xlsx`;
}
