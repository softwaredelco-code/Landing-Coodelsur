/**
 * Servicio de Cruce de Datos DataCrédito y Solicitudes en Excel.
 * Implementa las 5 Reglas de Negocio Estrictas de Coodelsur SAS.
 */

import {
  analyzeVector,
  CruceItemResult,
  CruceKPIs,
  DataCreditoExtracted,
  EstadoCruce,
  parseMoneyValue,
} from "@/domain/datacredito/types";
import type { LeadExportRecord } from "@/application/lead/export-leads-excel";
import { formatCOP } from "@/shared/utils";
import * as XLSX from "xlsx-js-style";

/** Encabezados del formato oficial de Coodelsur para solicitudes y cruce crediticio */
export const COODELSUR_TEMPLATE_HEADERS = [
  "cedula",
  "Nombre",
  "TELEFONO",
  "Actividad",
  "Monto Solicitado",
  "Monto APROBADO",
  "Línea de crédito",
  "Tasa",
  "Plazo",
  "puntaje",
  "monto sugerido",
  "ingreso data",
  "endeudamiento",
  "vectores",
  "creditos vigentes",
  "total deuda",
  "valor cuotas",
  "capacidad de pago",
  "salud cotizante, beneficiario, subsidido",
  "propiedades",
];

/**
 * Construye el archivo Excel base en formato oficial Coodelsur directamente
 * desde las solicitudes registradas en base de datos.
 */
export function buildCoodelsurTemplateExcelBuffer(leads: LeadExportRecord[]): Uint8Array {
  const rows: unknown[][] = [COODELSUR_TEMPLATE_HEADERS];

  for (const lead of leads) {
    const datos = (
      lead.datosFormulario && typeof lead.datosFormulario === "object"
        ? (lead.datosFormulario as Record<string, unknown>)
        : {}
    );

    const actividad =
      String(
        datos.ocupacion ||
        datos.actividadEconomica ||
        datos.cargo ||
        datos.profesion ||
        "na",
      ).trim();

    const rawMonto =
      lead.capitalSolicitado ??
      datos.capitalSeleccionado ??
      datos.capitalSolicitado ??
      0;
    const montoSolicitado = parseMoneyValue(rawMonto) ?? 0;

    const montoAprobado =
      datos.montoAprobado !== undefined && datos.montoAprobado !== null
        ? parseMoneyValue(datos.montoAprobado) ?? datos.montoAprobado
        : "";

    let lineaCredito = "SMALL";
    if (lead.tipoCredito === "microcredito_small") lineaCredito = "SMALL";
    else if (lead.tipoCredito === "microcredito_urbano") lineaCredito = "URBANO";
    else if (lead.tipoCredito === "microcredito_rural") lineaCredito = "RURAL";
    else if (lead.tipoCredito === "libranza") lineaCredito = "LIBRANZA";
    else if (lead.tipoCredito === "consumo") lineaCredito = "CONSUMO";
    else if (lead.tipoCredito === "comercial") lineaCredito = "COMERCIAL";
    else if (lead.tipoCredito) lineaCredito = String(lead.tipoCredito).toUpperCase();

    const tasa = String(datos.tasa || datos.tasaInteres || "2.1").trim();
    const plazo = String(datos.cantidadCuotas || datos.plazo || "2").trim();

    rows.push([
      lead.cedula,
      lead.nombre,
      lead.telefono,
      actividad,
      montoSolicitado,
      montoAprobado,
      lineaCredito,
      tasa,
      plazo,
      "", // puntaje
      "", // monto sugerido
      "", // ingreso data
      "", // endeudamiento
      "", // vectores
      "", // creditos vigentes
      "", // total deuda
      "", // valor cuotas
      "", // capacidad de pago (regla de negocio: vacía siempre)
      "", // salud cotizante, beneficiario, subsidido (regla de negocio: vacía siempre)
      "", // propiedades (regla de negocio: vacía siempre)
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Uint8Array(buf);
}

/** Regla 1: Normalización de cédulas (sin puntos, guiones, espacios ni ceros a la izquierda) */
export function normalizeCedula(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val).trim();
  // Quitar sufijo decimal de números de Excel como 1075311822.0
  str = str.replace(/\.0+$/, "");
  // Quitar cualquier carácter no numérico
  const digits = str.replace(/\D/g, "");
  // Quitar ceros a la izquierda
  return digits.replace(/^0+/, "");
}

/** Patrones de búsqueda para la columna de cédula / documento */
const CEDULA_HEADER_CANDIDATES = [
  "documento_identidad",
  "documento",
  "cedula",
  "cédula",
  "no_documento",
  "numero_documento",
  "número documento",
  "numero documento",
  "no. documento",
  "identificacion",
  "identificación",
  "cc",
  "dni",
  "numero identificacion",
  "número identificación",
];

const NOMBRE_HEADER_CANDIDATES = [
  "nombre",
  "nombres",
  "nombres y apellidos",
  "nombre completo",
  "nombre_titular",
  "solicitante",
  "cliente",
];

/** Regla 2: Detección inteligente de columnas en el archivo Excel */
export function detectColumnIndices(headers: string[]): {
  cedulaCol: number;
  nombreCol: number;
  telefonoCol: number;
  emailCol: number;
  montoCol: number;
} {
  let cedulaCol = -1;
  let nombreCol = -1;
  let telefonoCol = -1;
  let emailCol = -1;
  let montoCol = -1;

  for (let i = 0; i < headers.length; i++) {
    const raw = (headers[i] || "").toLowerCase().trim();
    const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Cédula
    if (cedulaCol === -1) {
      for (const cand of CEDULA_HEADER_CANDIDATES) {
        const candNorm = cand.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalized === candNorm || normalized.includes(candNorm)) {
          cedulaCol = i;
          break;
        }
      }
    }

    // Nombre
    if (nombreCol === -1) {
      for (const cand of NOMBRE_HEADER_CANDIDATES) {
        const candNorm = cand.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalized === candNorm || normalized.includes(candNorm)) {
          nombreCol = i;
          break;
        }
      }
    }

    // Teléfono
    if (telefonoCol === -1 && (normalized.includes("telefono") || normalized.includes("celular"))) {
      telefonoCol = i;
    }

    // Email
    if (emailCol === -1 && (normalized.includes("correo") || normalized.includes("email"))) {
      emailCol = i;
    }

    // Monto
    if (montoCol === -1 && (normalized.includes("monto") || normalized.includes("capital"))) {
      montoCol = i;
    }
  }

  return { cedulaCol, nombreCol, telefonoCol, emailCol, montoCol };
}

export interface CruceProcessResult {
  kpis: CruceKPIs;
  records: CruceItemResult[];
  excelBuffer: Uint8Array;
}

/**
 * Ejecuta el cruce completo entre el Excel y la lista de extracciones de DataCrédito.
 */
export function processCruceData(
  excelBuffer: Uint8Array,
  extractedPdfs: Array<{ extracted: DataCreditoExtracted; filename: string }>,
): CruceProcessResult {
  const wb = XLSX.read(excelBuffer, { type: "buffer", cellStyles: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Convertir a Array of Arrays
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (rows.length === 0) {
    throw new Error("El archivo Excel se encuentra vacío.");
  }

  const rawHeaders = (rows[0] as unknown[]).map((c) => String(c ?? "").trim());
  const { cedulaCol, nombreCol, telefonoCol, emailCol, montoCol } = detectColumnIndices(rawHeaders);

  if (cedulaCol === -1) {
    throw new Error(
      "No se encontró una columna de documento o cédula en el Excel. Verifique que los encabezados incluyan 'Cédula', 'Documento' o 'Identificación'.",
    );
  }

  // Mapa de extracciones por cédula normalizada
  const pdfsByCedula = new Map<string, { extracted: DataCreditoExtracted; filename: string }>();
  for (const item of extractedPdfs) {
    let norm = normalizeCedula(item.extracted.documento_identidad);
    if (!norm) {
      const match = item.filename.match(/\d{6,12}/)?.[0];
      if (match) norm = normalizeCedula(match);
    }
    if (norm) {
      pdfsByCedula.set(norm, item);
    }
  }

  // Identificar si el Excel ya tenía columnas de análisis crediticio
  const analysisHeadersMap: Record<string, number> = {};
  const standardAnalysisKeys = [
    "Puntaje",
    "Monto sugerido",
    "Ingreso data",
    "Endeudamiento",
    "Capacidad de pago",
    "Vectores",
    "Créditos vigentes",
    "Total deuda",
    "Valor cuotas",
    "Nivel Riesgo",
    "Diagnóstico IA",
    "Estado Cruce",
  ];

  for (let i = 0; i < rawHeaders.length; i++) {
    const h = rawHeaders[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const std of standardAnalysisKeys) {
      const stdNorm = std.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (h === stdNorm) {
        analysisHeadersMap[std] = i;
      }
    }
  }

  // Determinar qué columnas nuevas debemos agregar al final
  const newColumnsToAdd: string[] = [];
  for (const key of standardAnalysisKeys) {
    if (analysisHeadersMap[key] === undefined) {
      analysisHeadersMap[key] = rawHeaders.length + newColumnsToAdd.length;
      newColumnsToAdd.push(key);
    }
  }

  const finalHeaders = [...rawHeaders, ...newColumnsToAdd];

  // Columnas que por regla de negocio deben quedar SIEMPRE vacías:
  // "capacidad de pago", "salud cotizante, beneficiario, subsidido", "propiedades"
  const alwaysEmptyColIndices: number[] = [];
  for (let i = 0; i < finalHeaders.length; i++) {
    const hNorm = finalHeaders[i]
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    if (
      hNorm === "capacidad de pago" ||
      hNorm.startsWith("salud cotizante") ||
      hNorm === "salud" ||
      hNorm === "propiedades"
    ) {
      alwaysEmptyColIndices.push(i);
    }
  }

  const matchedCedulas = new Set<string>();
  const records: CruceItemResult[] = [];
  const updatedRows: unknown[][] = [];

  // Agregar fila de encabezados
  updatedRows.push(finalHeaders);

  // 1. Procesar filas existentes del Excel (Regla 3 y Regla 5)
  for (let r = 1; r < rows.length; r++) {
    const originalRow = [...(rows[r] as unknown[])];
    // Asegurar tamaño del array
    while (originalRow.length < finalHeaders.length) {
      originalRow.push("");
    }

    const rawCedula = originalRow[cedulaCol];
    const normCedula = normalizeCedula(rawCedula);

    const rawNombre = nombreCol !== -1 ? String(originalRow[nombreCol] ?? "") : "";
    const rawTel = telefonoCol !== -1 ? String(originalRow[telefonoCol] ?? "") : "";
    const rawEmail = emailCol !== -1 ? String(originalRow[emailCol] ?? "") : "";
    const rawMonto = montoCol !== -1 ? originalRow[montoCol] : "";

    let pdfMatch = normCedula ? pdfsByCedula.get(normCedula) : undefined;

    // Respaldo 1: Coincidencia por nombre si la cédula difiere
    if (!pdfMatch && rawNombre) {
      const normRowNombre = rawNombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      for (const [pCed, pItem] of Array.from(pdfsByCedula.entries())) {
        const pNombre = (pItem.extracted.nombre_titular || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (pNombre && (normRowNombre.includes(pNombre) || pNombre.includes(normRowNombre))) {
          pdfMatch = pItem;
          matchedCedulas.add(pCed);
          break;
        }
      }
    }

    // Respaldo 2: Si hay 1 PDF y 1 sola solicitud en el Excel, asociarlos directamente
    if (!pdfMatch && extractedPdfs.length === 1 && rows.length === 2) {
      const singleItem = extractedPdfs[0];
      pdfMatch = singleItem;
      const singleCed = normalizeCedula(singleItem.extracted.documento_identidad) || normalizeCedula(singleItem.filename.match(/\d{6,12}/)?.[0]);
      if (singleCed) matchedCedulas.add(singleCed);
    }

    if (pdfMatch) {
      // Regla 3: Coincidencia exitosa
      matchedCedulas.add(normCedula);
      const ext = pdfMatch.extracted;

      const vAnalysis = analyzeVector(ext.vectores);

      const numMontoSugerido = parseMoneyValue(ext.monto_sugerido) ?? 0;
      const numIngresoData = parseMoneyValue(ext.ingreso_data) ?? 0;
      const numTotalDeuda = parseMoneyValue(ext.total_deuda) ?? 0;
      const numValorCuotas = parseMoneyValue(ext.valor_cuotas) ?? 0;

      if (montoCol !== -1) {
        const parsedMonto = parseMoneyValue(originalRow[montoCol]);
        if (parsedMonto !== null) {
          originalRow[montoCol] = parsedMonto;
        }
      }

      originalRow[analysisHeadersMap["Puntaje"]] = ext.puntaje;
      originalRow[analysisHeadersMap["Monto sugerido"]] = numMontoSugerido;
      originalRow[analysisHeadersMap["Ingreso data"]] = numIngresoData;
      originalRow[analysisHeadersMap["Endeudamiento"]] = ext.endeudamiento;
      // Regla obligatoria: "Capacidad de pago" COMPLETAMENTE VACÍA
      originalRow[analysisHeadersMap["Capacidad de pago"]] = "";
      originalRow[analysisHeadersMap["Vectores"]] = ext.vectores ? `${ext.vectores} (${vAnalysis.resumen})` : "";
      originalRow[analysisHeadersMap["Créditos vigentes"]] = ext.creditos_vigentes;
      originalRow[analysisHeadersMap["Total deuda"]] = numTotalDeuda;
      originalRow[analysisHeadersMap["Valor cuotas"]] = numValorCuotas;
      originalRow[analysisHeadersMap["Nivel Riesgo"]] = ext.nivel_riesgo;
      originalRow[analysisHeadersMap["Diagnóstico IA"]] = ext.diagnostico_ia;
      originalRow[analysisHeadersMap["Estado Cruce"]] = "Coincidencia exitosa";

      records.push({
        cedula: normCedula,
        nombre: rawNombre || ext.nombre_titular,
        telefono: rawTel,
        email: rawEmail,
        montoSolicitado: typeof rawMonto === "number" || typeof rawMonto === "string" ? rawMonto : undefined,
        puntaje: ext.puntaje,
        montoSugerido: ext.monto_sugerido,
        ingresoData: ext.ingreso_data,
        endeudamiento: ext.endeudamiento,
        capacidadPago: "",
        vectores: ext.vectores,
        analisisVectores: vAnalysis.detalle,
        creditosVigentes: ext.creditos_vigentes,
        totalDeuda: ext.total_deuda,
        valorCuotas: ext.valor_cuotas,
        peorMora: ext.peor_mora,
        nivelRiesgo: ext.nivel_riesgo,
        diagnosticoIA: ext.diagnostico_ia,
        estadoCruce: "coincidencia",
        estadoCruceLabel: "Coincidencia exitosa",
        archivoPdf: pdfMatch.filename,
      });
    } else {
      // Regla 5: Pendiente reporte
      originalRow[analysisHeadersMap["Puntaje"]] = "Pendiente reporte";
      originalRow[analysisHeadersMap["Monto sugerido"]] = "Pendiente reporte";
      originalRow[analysisHeadersMap["Ingreso data"]] = "Pendiente reporte";
      originalRow[analysisHeadersMap["Endeudamiento"]] = "Pendiente reporte";
      // Capacidad de pago vacía
      originalRow[analysisHeadersMap["Capacidad de pago"]] = "";
      originalRow[analysisHeadersMap["Vectores"]] = "Pendiente reporte";
      originalRow[analysisHeadersMap["Créditos vigentes"]] = "Pendiente reporte";
      originalRow[analysisHeadersMap["Total deuda"]] = "Pendiente reporte";
      originalRow[analysisHeadersMap["Valor cuotas"]] = "Pendiente reporte";
      originalRow[analysisHeadersMap["Nivel Riesgo"]] = "Pendiente reporte";
      originalRow[analysisHeadersMap["Diagnóstico IA"]] = "Pendiente reporte";
      originalRow[analysisHeadersMap["Estado Cruce"]] = "Pendiente reporte";

      records.push({
        cedula: normCedula || String(rawCedula ?? ""),
        nombre: rawNombre || "Sin nombre",
        telefono: rawTel,
        email: rawEmail,
        montoSolicitado: typeof rawMonto === "number" || typeof rawMonto === "string" ? rawMonto : undefined,
        puntaje: "Pendiente reporte",
        montoSugerido: "Pendiente reporte",
        ingresoData: "Pendiente reporte",
        endeudamiento: "Pendiente reporte",
        capacidadPago: "",
        vectores: "Pendiente reporte",
        analisisVectores: "Pendiente reporte",
        creditosVigentes: "Pendiente reporte",
        totalDeuda: "Pendiente reporte",
        valorCuotas: "Pendiente reporte",
        peorMora: "Pendiente reporte",
        nivelRiesgo: "Pendiente reporte",
        diagnosticoIA: "Pendiente reporte",
        estadoCruce: "sin_reporte",
        estadoCruceLabel: "Pendiente reporte",
      });
    }

    for (const emptyColIdx of alwaysEmptyColIndices) {
      originalRow[emptyColIdx] = "";
    }

    updatedRows.push(originalRow);
  }

  // 2. Procesar PDFs no registrados en el Excel (Regla 4)
  let noEnFormularioCount = 0;
  for (const [normCedula, pdfItem] of Array.from(pdfsByCedula.entries())) {
    if (!matchedCedulas.has(normCedula)) {
      noEnFormularioCount++;
      const ext = pdfItem.extracted;
      const vAnalysis = analyzeVector(ext.vectores);

      const newRow: unknown[] = new Array(finalHeaders.length).fill("");
      newRow[cedulaCol] = ext.documento_identidad || normCedula;
      if (nombreCol !== -1) {
        newRow[nombreCol] = ext.nombre_titular;
      }

      const numMontoSugerido = parseMoneyValue(ext.monto_sugerido) ?? 0;
      const numIngresoData = parseMoneyValue(ext.ingreso_data) ?? 0;
      const numTotalDeuda = parseMoneyValue(ext.total_deuda) ?? 0;
      const numValorCuotas = parseMoneyValue(ext.valor_cuotas) ?? 0;

      newRow[analysisHeadersMap["Puntaje"]] = ext.puntaje;
      newRow[analysisHeadersMap["Monto sugerido"]] = numMontoSugerido;
      newRow[analysisHeadersMap["Ingreso data"]] = numIngresoData;
      newRow[analysisHeadersMap["Endeudamiento"]] = ext.endeudamiento;
      // Capacidad de pago vacía
      newRow[analysisHeadersMap["Capacidad de pago"]] = "";
      newRow[analysisHeadersMap["Vectores"]] = ext.vectores ? `${ext.vectores} (${vAnalysis.resumen})` : "";
      newRow[analysisHeadersMap["Créditos vigentes"]] = ext.creditos_vigentes;
      newRow[analysisHeadersMap["Total deuda"]] = numTotalDeuda;
      newRow[analysisHeadersMap["Valor cuotas"]] = numValorCuotas;
      newRow[analysisHeadersMap["Nivel Riesgo"]] = ext.nivel_riesgo;
      newRow[analysisHeadersMap["Diagnóstico IA"]] = ext.diagnostico_ia;
      newRow[analysisHeadersMap["Estado Cruce"]] = "No registrada en formulario";

      updatedRows.push(newRow);

      records.push({
        cedula: ext.documento_identidad || normCedula,
        nombre: ext.nombre_titular || "No registrada en formulario",
        puntaje: ext.puntaje,
        montoSugerido: ext.monto_sugerido,
        ingresoData: ext.ingreso_data,
        endeudamiento: ext.endeudamiento,
        capacidadPago: "",
        vectores: ext.vectores,
        analisisVectores: vAnalysis.detalle,
        creditosVigentes: ext.creditos_vigentes,
        totalDeuda: ext.total_deuda,
        valorCuotas: ext.valor_cuotas,
        peorMora: ext.peor_mora,
        nivelRiesgo: ext.nivel_riesgo,
        diagnosticoIA: ext.diagnostico_ia,
        estadoCruce: "no_en_formulario",
        estadoCruceLabel: "No registrada en formulario",
        archivoPdf: pdfItem.filename,
      });
    }
  }

  // 3. Calcular KPIs
  const totalExcel = rows.length - 1;
  const totalPdfs = extractedPdfs.length;
  const coincidencias = matchedCedulas.size;
  const tasaCoincidencia = totalExcel > 0 ? Math.round((coincidencias / totalExcel) * 100) : 0;
  const pendientes = Math.max(0, totalExcel - coincidencias);

  const scores = records
    .filter((r) => typeof r.puntaje === "number" && r.puntaje > 0)
    .map((r) => r.puntaje as number);
  const scorePromedio =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const kpis: CruceKPIs = {
    totalExcel,
    totalPdfs,
    coincidencias,
    tasaCoincidencia,
    scorePromedio,
    pendientes,
    noEnFormulario: noEnFormularioCount,
  };

  // 4. Construir el nuevo Worksheet con estilos de alta calidad
  const updatedWs = XLSX.utils.aoa_to_sheet(updatedRows);

  // Estilos de columnas y anchos automáticos
  const colWidths = finalHeaders.map((header) => {
    const isAnalysisCol = standardAnalysisKeys.includes(header);
    return { wch: Math.max(14, header.length + (isAnalysisCol ? 6 : 4)) };
  });
  updatedWs["!cols"] = colWidths;
  updatedWs["!rows"] = [{ hpt: 28 }]; // Altura generosa para el encabezado

  if (updatedRows.length > 1) {
    updatedWs["!autofilter"] = {
      ref: `A1:${XLSX.utils.encode_col(finalHeaders.length - 1)}${updatedRows.length}`,
    };
  }

  // Aplicar estilos a las cabeceras (colores corporativos Coodelsur y amarillo para análisis)
  for (let c = 0; c < finalHeaders.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    const cell = updatedWs[cellRef];
    if (!cell) continue;

    const hNorm = finalHeaders[c]
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    // Columnas de análisis con cabecera amarilla según el formato oficial Coodelsur
    const isYellow = [
      "puntaje",
      "monto sugerido",
      "ingreso data",
      "endeudamiento",
      "vectores",
      "creditos vigentes",
      "total deuda",
      "valor cuotas",
    ].includes(hNorm);

    cell.s = {
      font: {
        bold: true,
        color: { rgb: isYellow ? "000000" : "FFFFFF" },
        name: "Calibri",
        sz: 10,
      },
      fill: {
        patternType: "solid",
        fgColor: { rgb: isYellow ? "FFE699" : "002446" }, // Amarillo para análisis, Azul Coodelsur para base y capacidad de pago
      },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "D9D9D9" } },
        bottom: { style: "medium", color: { rgb: "7F7F7F" } },
        left: { style: "thin", color: { rgb: "D9D9D9" } },
        right: { style: "thin", color: { rgb: "D9D9D9" } },
      },
    };
  }

  // Identificar columnas monetarias para aplicar formato de moneda ($#,##0)
  const monetaryKeys = [
    "Monto sugerido",
    "Ingreso data",
    "Total deuda",
    "Valor cuotas",
  ];
  const monetaryColIndices = new Set<number>();
  for (const key of monetaryKeys) {
    if (analysisHeadersMap[key] !== undefined) {
      monetaryColIndices.add(analysisHeadersMap[key]);
    }
  }
  if (montoCol !== -1) {
    monetaryColIndices.add(montoCol);
  }

  const nivelRiesgoCol = analysisHeadersMap["Nivel Riesgo"];
  const puntajeCol = analysisHeadersMap["Puntaje"];
  const estadoCruceCol = analysisHeadersMap["Estado Cruce"];

  // Aplicar estilos celda por celda a todas las filas de datos
  for (let r = 1; r < updatedRows.length; r++) {
    const isZebra = r % 2 === 0;

    for (let c = 0; c < finalHeaders.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = updatedWs[cellRef];
      if (!cell) continue;

      let fontColor = "1F2937";
      let isBold = false;
      let bgColor = isZebra ? "F9FAFB" : "FFFFFF";
      let horizontalAlign = "left";

      // 1. Formateo de Moneda ($#,##0)
      if (monetaryColIndices.has(c)) {
        horizontalAlign = "right";
        const num = parseMoneyValue(cell.v);
        if (num !== null) {
          cell.v = num;
          cell.t = "n";
          cell.z = "$#,##0";
        }
      }

      // 2. Columna Nivel de Riesgo: Semáforo estricto (Verde = Bajo, Amarillo = Medio, Rojo = Alto)
      if (c === nivelRiesgoCol && cell.v) {
        horizontalAlign = "center";
        isBold = true;
        const valLower = String(cell.v).toLowerCase().trim();

        if (valLower.includes("bajo")) {
          bgColor = "C6EFCE"; // Verde suave Excel
          fontColor = "006100"; // Verde oscuro legible
        } else if (valLower.includes("medio")) {
          bgColor = "FFEB9C"; // Amarillo suave Excel
          fontColor = "9C6500"; // Dorado/marrón oscuro legible
        } else if (valLower.includes("alto")) {
          bgColor = "FFC7CE"; // Rojo suave Excel
          fontColor = "9C0006"; // Rojo oscuro legible
        } else {
          bgColor = "F3F4F6";
          fontColor = "6B7280";
        }
      }

      // 3. Columna Puntaje / Score
      if (c === puntajeCol) {
        horizontalAlign = "center";
        isBold = true;
        if (typeof cell.v === "number") {
          cell.t = "n";
          if (cell.v >= 700) fontColor = "15803D"; // Verde
          else if (cell.v >= 550) fontColor = "B45309"; // Ámbar
          else if (cell.v > 0) fontColor = "B91C1C"; // Rojo
        }
      }

      // 4. Columna Cédula / Documento
      if (c === cedulaCol) {
        horizontalAlign = "center";
        fontColor = "111827";
      }

      // 5. Columna Estado Cruce
      if (c === estadoCruceCol && cell.v) {
        horizontalAlign = "center";
        isBold = true;
        const valLower = String(cell.v).toLowerCase();
        if (valLower.includes("coincidencia")) {
          fontColor = "15803D";
        } else if (valLower.includes("pendiente")) {
          fontColor = "B45309";
        } else {
          fontColor = "7E22CE";
        }
      }

      cell.s = {
        font: {
          name: "Calibri",
          sz: 10,
          bold: isBold,
          color: { rgb: fontColor },
        },
        fill: {
          patternType: "solid",
          fgColor: { rgb: bgColor },
        },
        alignment: {
          vertical: "center",
          horizontal: horizontalAlign,
        },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } },
        },
      };
    }
  }

  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, updatedWs, "Cruce DataCrédito");

  const rawOut = XLSX.write(newWb, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  });

  return {
    kpis,
    records,
    excelBuffer: new Uint8Array(rawOut),
  };
}
