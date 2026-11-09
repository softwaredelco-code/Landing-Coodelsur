/**
 * Tipos de datos para el módulo de cruce de DataCrédito con IA.
 * Coodelsur SAS
 */

export interface DataCreditoExtracted {
  documento_identidad: string;
  nombre_titular: string;
  puntaje: number;
  monto_sugerido: number;
  ingreso_data: number;
  endeudamiento: string;
  vectores: string;
  analisis_vectores?: string;
  creditos_vigentes: number;
  total_deuda: number;
  valor_cuotas: number;
  peor_mora: string;
  nivel_riesgo: "Bajo" | "Medio" | "Alto" | string;
  diagnostico_ia: string;
}

export type EstadoCruce = "coincidencia" | "sin_reporte" | "no_en_formulario";

export interface VectorMonthDetail {
  mes: number;
  simbolo: string;
  significado: string;
  estado: "al_dia" | "mora_leve" | "mora_grave" | "neutro";
}

export interface VectorAnalysis {
  vector: string;
  resumen: string;
  detalle: string;
  estado: "optimo" | "alerta" | "critico" | "desconocido";
  mesesAlDia: number;
  mesesMora: number;
  mesesNeutro: number;
  peorEstado: string;
  desglose: VectorMonthDetail[];
}

/**
 * Analiza e interpreta con rigor técnico el vector histórico de comportamiento de DataCrédito (12 o 24 meses).
 * Explica en lenguaje claro el significado de códigos como N, 0, 1, 2, 3, C, etc.
 */
export function analyzeVector(rawVector?: string | null): VectorAnalysis {
  const vector = (rawVector ?? "").trim().toUpperCase();

  if (!vector || vector === "PENDIENTE REPORTE") {
    return {
      vector: vector || "Pendiente reporte",
      resumen: "Sin vector disponible",
      detalle: "No se cuenta con el historial mensual de pagos o el reporte crediticio está pendiente de carga.",
      estado: "desconocido",
      mesesAlDia: 0,
      mesesMora: 0,
      mesesNeutro: 0,
      peorEstado: "Sin información",
      desglose: [],
    };
  }

  const chars = Array.from(vector);
  let alDia = 0;
  let moraLeve = 0;
  let moraGrave = 0;
  let neutro = 0;

  const desglose: VectorMonthDetail[] = chars.map((char, index) => {
    const mesNum = index + 1;
    switch (char) {
      case "N":
        alDia++;
        return { mes: mesNum, simbolo: char, significado: "Al día (Normal)", estado: "al_dia" };
      case "0":
        neutro++;
        return { mes: mesNum, simbolo: char, significado: "Sin saldo / Inactivo", estado: "neutro" };
      case "1":
        moraLeve++;
        return { mes: mesNum, simbolo: char, significado: "Mora de 30 a 59 días", estado: "mora_leve" };
      case "2":
        moraLeve++;
        return { mes: mesNum, simbolo: char, significado: "Mora de 60 a 89 días", estado: "mora_leve" };
      case "3":
        moraGrave++;
        return { mes: mesNum, simbolo: char, significado: "Mora de 90 a 119 días", estado: "mora_grave" };
      case "4":
        moraGrave++;
        return { mes: mesNum, simbolo: char, significado: "Mora de 120 días o más", estado: "mora_grave" };
      case "C":
      case "K":
        moraGrave++;
        return { mes: mesNum, simbolo: char, significado: "Cartera castigada", estado: "mora_grave" };
      case "D":
        moraGrave++;
        return { mes: mesNum, simbolo: char, significado: "Dudoso recaudo", estado: "mora_grave" };
      default:
        neutro++;
        return { mes: mesNum, simbolo: char, significado: "Sin reporte", estado: "neutro" };
    }
  });

  const totalMeses = chars.length;
  const mesesMora = moraLeve + moraGrave;

  if (moraGrave > 0) {
    return {
      vector,
      resumen: `Riesgo crítico: ${mesesMora} mes(es) con mora grave o castigada`,
      detalle: `El titular presenta antecedentes severos de incumplimiento en el vector histórico (${moraGrave} mes(es) con mora mayor a 90 días o cartera castigada). Representa un alto riesgo de crédito.`,
      estado: "critico",
      mesesAlDia: alDia,
      mesesMora,
      mesesNeutro: neutro,
      peorEstado: "Mora grave / Castigada",
      desglose,
    };
  }

  if (moraLeve > 0) {
    return {
      vector,
      resumen: `Alerta: ${moraLeve} mes(es) con atraso leve (30-89 días)`,
      detalle: `El titular registra ${moraLeve} atraso(s) en los últimos ${totalMeses} meses. Aunque mantiene ${alDia} mes(es) al día, se debe validar la capacidad de pago antes de otorgar el crédito.`,
      estado: "alerta",
      mesesAlDia: alDia,
      mesesMora,
      mesesNeutro: neutro,
      peorEstado: "Mora leve (30-89 días)",
      desglose,
    };
  }

  if (alDia >= 1) {
    return {
      vector,
      resumen: `${alDia} de ${totalMeses} meses al día (Comportamiento óptimo)`,
      detalle: `El titular presenta un historial intachable: ${alDia} meses consecutivos con pagos puntuales y al día (código 'N' = Normal). No registra ningún tipo de atraso ni morosidad en el buró crediticio.`,
      estado: "optimo",
      mesesAlDia: alDia,
      mesesMora: 0,
      mesesNeutro: neutro,
      peorEstado: "Al día",
      desglose,
    };
  }

  return {
    vector,
    resumen: "Sin moras registradas (Inactivo)",
    detalle: "El vector muestra cuentas sin saldo o sin movimientos en los meses reportados.",
    estado: "optimo",
    mesesAlDia: alDia,
    mesesMora: 0,
    mesesNeutro: neutro,
    peorEstado: "Sin movimiento",
    desglose,
  };
}

export interface CruceItemResult {
  id?: string;
  cedula: string;
  nombre: string;
  telefono?: string;
  email?: string;
  estadoSolicitud?: string;
  montoSolicitado?: number | string;
  puntaje: number | null | "Pendiente reporte";
  montoSugerido: number | null | "Pendiente reporte";
  ingresoData: number | null | "Pendiente reporte";
  endeudamiento: string | "Pendiente reporte";
  capacidadPago: ""; // Siempre vacía por regla de negocio estricta
  vectores: string | "Pendiente reporte";
  analisisVectores?: string;
  creditosVigentes: number | null | "Pendiente reporte";
  totalDeuda: number | null | "Pendiente reporte";
  valorCuotas: number | null | "Pendiente reporte";
  peorMora: string | "Pendiente reporte";
  nivelRiesgo: "Bajo" | "Medio" | "Alto" | "Pendiente reporte" | string;
  diagnosticoIA: string | "Pendiente reporte";
  estadoCruce: EstadoCruce;
  estadoCruceLabel: "Coincidencia exitosa" | "Pendiente reporte" | "No registrada en formulario";
  archivoPdf?: string;
}

export interface CruceKPIs {
  totalExcel: number;
  totalPdfs: number;
  coincidencias: number;
  tasaCoincidencia: number;
  scorePromedio: number;
  pendientes: number;
  noEnFormulario: number;
}

export interface CruceLogEvent {
  time: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

export interface CruceStreamMessage {
  type: "start" | "log" | "progress" | "done" | "error";
  current?: number;
  total?: number;
  filename?: string;
  message?: string;
  kpis?: CruceKPIs;
  records?: CruceItemResult[];
  excelBase64?: string;
  downloadFilename?: string;
  error?: string;
}

/**
 * Convierte cualquier valor monetario/numérico a número limpio.
 * Soporta números, strings con formato colombiano (puntos de miles: 4.973.000),
 * comas internacionales (4,973,000) o signos de moneda ($).
 */
export function parseMoneyValue(val: unknown): number | null {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str || str.toLowerCase().includes("pendiente") || str === "N/A" || str === "—") return null;

  let cleaned = str.replace(/[$ ]/g, "");

  if (cleaned.includes(".") && cleaned.includes(",")) {
    if (cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",")) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    cleaned = cleaned.replace(/\./g, "");
  } else if ((cleaned.match(/,/g) || []).length > 1) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
      cleaned = cleaned.replace(".", "");
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
      cleaned = cleaned.replace(",", "");
    } else {
      cleaned = cleaned.replace(",", ".");
    }
  }

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Formatea un valor numérico o string como moneda en pesos colombianos ($ #,##0).
 * Si es texto como 'Pendiente reporte' o vacío, mantiene la descripción legible.
 */
export function formatMoney(val: unknown): string {
  if (val === null || val === undefined || val === "" || val === "—") return "—";
  const num = parseMoneyValue(val);
  if (num === null) return String(val);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(num);
}

