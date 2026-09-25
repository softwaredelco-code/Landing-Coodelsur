/**
 * Exportación exhaustiva de solicitudes de crédito a Excel (.xlsx) para el panel admin.
 * Incluye todos los campos de los formularios (Microcrédito Small, Urbano, Rural, Libranza, etc.),
 * estructurados en columnas legibles, con formato de moneda, fechas, opciones traducidas y
 * detección automática de campos adicionales.
 */

import { isAttachmentAvailable } from "@/domain/lead/attachments";
import { formatCOP } from "@/shared/utils";
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
  fechaAceptacionTerminos?: Date | string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmMedium?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  ip?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  fechaCreacion: Date | string;
  fechaActualizacion?: Date | string;
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

/* ─── Diccionarios de etiquetas legibles ──────────────────────── */

const ESTADO_LABELS: Record<string, string> = {
  incompleto: "Incompleta",
  recibido: "Recibida",
  revisado: "Revisada",
  contactado: "Contactada",
  descartado: "Descartada",
};

const TIPO_CREDITO_LABELS: Record<string, string> = {
  microcredito_small: "Microcrédito Small",
  microcredito_urbano: "Microcrédito Urbano",
  microcredito_rural: "Microcrédito Rural",
  libranza: "Crédito Libranza",
  consumo: "Crédito Consumo",
  comercial: "Crédito Comercial",
};

const TIPO_IDENTIFICACION_LABELS: Record<string, string> = {
  CC: "Cédula de Ciudadanía (CC)",
  CE: "Cédula de Extranjería (CE)",
  TI: "Tarjeta de Identidad (TI)",
  NIT: "NIT",
  PAS: "Pasaporte",
  PPT: "Permiso Protección Temporal (PPT)",
};

const GENERO_LABELS: Record<string, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
  otro: "Otro",
  no_decir: "Prefiero no decir",
};

const ESTADO_CIVIL_LABELS: Record<string, string> = {
  soltero: "Soltero/a",
  casado: "Casado/a",
  union_libre: "Unión libre",
  separado: "Separado/a",
  viudo: "Viudo/a",
};

const SI_NO_LABELS: Record<string, string> = {
  si: "Sí",
  no: "No",
  no_se: "No sé",
  true: "Sí",
  false: "No",
};

const SECTOR_DOMICILIO_LABELS: Record<string, string> = {
  urbano: "Urbano",
  rural: "Rural",
};

const TIPO_CUENTA_LABELS: Record<string, string> = {
  ahorros: "Ahorros",
  corriente: "Corriente",
  llave: "Llave bancaria (Bre-B)",
};

const TIPO_REFERENCIA_LABELS: Record<string, string> = {
  familiar: "Familiar",
  personal: "Personal",
  comercial: "Comercial",
};

const PARENTESCO_LABELS: Record<string, string> = {
  padre: "Padre",
  madre: "Madre",
  hijo: "Hijo/a",
  hermano: "Hermano/a",
  conyuge: "Cónyuge o pareja",
  tio: "Tío/a",
  primo: "Primo/a",
  abuelo: "Abuelo/a",
  suegro: "Suegro/a",
  cunado: "Cuñado/a",
  amigo: "Amigo/a",
  companero_trabajo: "Compañero/a de trabajo",
  vecino: "Vecino/a",
  conocido: "Conocido/a",
  otro: "Otro",
};

const DESTINO_CREDITO_LABELS: Record<string, string> = {
  capital_trabajo: "Capital de trabajo",
  mercancia: "Compra de mercancía o insumos",
  equipos_herramientas: "Compra de equipos o herramientas",
  gastos_negocio: "Gastos operativos del negocio",
  gastos_personales: "Gastos personales o familiares",
  salud: "Salud o medicamentos",
  educacion: "Educación o capacitación",
  transporte: "Transporte o movilidad",
  otro: "Otro",
};

const ORIGEN_OTROS_INGRESOS_LABELS: Record<string, string> = {
  arriendos: "Arriendos",
  negocio_propio: "Negocio propio o ventas informales",
  pension: "Pensión o mesada pensional",
  apoyo_familiar: "Apoyo económico familiar",
  remesas: "Remesas del exterior",
  freelance: "Trabajo freelance u honorarios",
  dividendos_intereses: "Dividendos o intereses",
  otro: "Otro",
};

const NIVEL_EDUCACION_LABELS: Record<string, string> = {
  primaria: "Primaria",
  secundaria: "Secundaria",
  tecnico: "Técnico",
  tecnologo: "Tecnólogo",
  profesional: "Profesional",
  especializacion: "Especialización",
  maestria: "Maestría",
  doctorado: "Doctorado",
  ninguno: "Ninguno",
};

const TIPO_CONTRATO_LABELS: Record<string, string> = {
  indefinido: "Término indefinido",
  fijo: "Término fijo",
  prestacion_servicios: "Prestación de servicios",
  obra_labor: "Obra o labor",
  aprendizaje: "Contrato de aprendizaje",
  otro: "Otro",
};

/* ─── Helpers de extracción ────────────────────────────────── */

function datosOf(lead: LeadExportRecord): Record<string, unknown> {
  if (!lead.datosFormulario || typeof lead.datosFormulario !== "object") return {};
  return lead.datosFormulario as Record<string, unknown>;
}

function readString(datos: Record<string, unknown>, key: string): string {
  const value = datos[key];
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return "";
}

function readNumber(datos: Record<string, unknown>, key: string): number | null {
  const value = datos[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return formatCOP(value);
}

function readOption(
  datos: Record<string, unknown>,
  key: string,
  labels: Record<string, string>,
): string {
  const raw = readString(datos, key);
  if (!raw) return "";
  return labels[raw.toLowerCase()] ?? labels[raw] ?? raw;
}

function readAttachmentInfo(datos: Record<string, unknown>, field: string): string {
  const item = datos[field];
  if (!item) return "No adjunto";

  if (typeof item === "string") {
    if (item.startsWith("http")) return item;
    if (item.startsWith("data:")) return "Disponible (inline)";
    return "Disponible";
  }

  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    if (typeof obj.url === "string" && obj.url.startsWith("http")) {
      return obj.url;
    }
    if (typeof obj.path === "string" && obj.path.trim()) {
      return `Storage: ${obj.path}`;
    }
    if (isAttachmentAvailable(item)) {
      return "Disponible";
    }
  }

  return "No adjunto";
}


function readCedulaVerificacion(datos: Record<string, unknown>): string {
  const cv = datos.cedulaVerificacion;
  if (!cv || typeof cv !== "object") return "";
  const obj = cv as Record<string, unknown>;
  const status = String(obj.status ?? "");
  const message = String(obj.message ?? "");
  if (status && message) return `${status}: ${message}`;
  return status || message || "";
}

function readProgreso(lead: LeadExportRecord, datos: Record<string, unknown>): string | number {
  if (lead.estado !== "incompleto") return "100%";
  if (lead.progresoFormulario != null) return `${lead.progresoFormulario}%`;
  const p = datos._progreso;
  if (p && typeof p === "object") {
    const porc = (p as { porcentaje?: unknown }).porcentaje;
    if (typeof porc === "number") return `${porc}%`;
  }
  return "";
}

/* ─── Columnas completas del formulario ──────────────────────── */

const BASE_COLUMNS: ExportColumn[] = [
  // 1. Datos de la solicitud
  { header: "ID Solicitud", width: 38, value: (l) => l.id },
  { header: "Fecha y Hora Solicitud", width: 22, value: (l) => formatDateTime(l.fechaCreacion) },
  { header: "Estado", width: 14, value: (l) => ESTADO_LABELS[l.estado] ?? l.estado },
  { header: "Producto", width: 22, value: (l) => TIPO_CREDITO_LABELS[l.tipoCredito] ?? l.tipoCredito },
  { header: "Origen / Canal", width: 15, value: (l) => l.origen },
  { header: "Progreso Formulario", width: 14, value: (l) => readProgreso(l, datosOf(l)) },
  { header: "Paso Actual", width: 18, value: (l) => l.pasoActualFormulario ?? readString(datosOf(l), "pasoActualFormulario") },
  { header: "Acepta Términos (Hábeas Data)", width: 16, value: (l) => (l.aceptaTerminos ? "Sí" : "No") },
  {
    header: "Fecha Aceptación Términos",
    width: 22,
    value: (l) =>
      formatDateTime(
        l.fechaAceptacionTerminos ?? readString(datosOf(l), "fechaAceptacionTerminos"),
      ),
  },

  // 2. Datos personales del solicitante
  { header: "Nombres y Apellidos", width: 30, value: (l) => l.nombre },
  {
    header: "Tipo Documento",
    width: 24,
    value: (l) =>
      readOption(datosOf(l), "tipoIdentificacion", TIPO_IDENTIFICACION_LABELS) ||
      readString(datosOf(l), "tipoIdentificacion"),
  },
  { header: "Número Documento", width: 16, value: (l) => l.cedula },
  { header: "Fecha Expedición Documento", width: 18, value: (l) => formatDate(readString(datosOf(l), "fechaExpedicion")) },
  { header: "Correo Electrónico", width: 28, value: (l) => l.email ?? readString(datosOf(l), "email") },
  { header: "Teléfono Celular", width: 16, value: (l) => l.telefono },
  { header: "Género", width: 14, value: (l) => readOption(datosOf(l), "genero", GENERO_LABELS) },
  { header: "Estado Civil", width: 16, value: (l) => readOption(datosOf(l), "estadoCivil", ESTADO_CIVIL_LABELS) },
  { header: "Fecha Nacimiento", width: 16, value: (l) => formatDate(readString(datosOf(l), "fechaNacimiento")) },
  { header: "Estrato", width: 10, value: (l) => readString(datosOf(l), "estrato") },
  { header: "Personas a Cargo", width: 14, value: (l) => readString(datosOf(l), "personasACargo") },
  { header: "Nivel Educación", width: 18, value: (l) => readOption(datosOf(l), "nivelEducacion", NIVEL_EDUCACION_LABELS) },
  { header: "Profesión", width: 20, value: (l) => readString(datosOf(l), "profesion") },
  { header: "Nombre Cónyuge / Pareja", width: 26, value: (l) => readString(datosOf(l), "nombreConyuge") },

  // 3. Domicilio y residencia
  { header: "Departamento", width: 18, value: (l) => readString(datosOf(l), "departamento") },
  { header: "Municipio", width: 18, value: (l) => readString(datosOf(l), "municipio") },
  { header: "Ciudad Residencia", width: 18, value: (l) => readString(datosOf(l), "ciudad") || (l.ciudad ?? "") },
  {
    header: "Sector Domicilio",
    width: 14,
    value: (l) => readOption(datosOf(l), "sectorDomicilio", SECTOR_DOMICILIO_LABELS),
  },
  { header: "Dirección Residencia", width: 32, value: (l) => readString(datosOf(l), "direccion") },
  { header: "Barrio Residencia", width: 22, value: (l) => readString(datosOf(l), "barrio") },

  // 4. Datos del crédito y condiciones
  {
    header: "Monto Solicitado (COP)",
    width: 20,
    value: (l) => {
      const monto = l.capitalSolicitado ?? readNumber(datosOf(l), "capitalSeleccionado");
      return monto != null ? formatMoney(monto) : "";
    },
  },
  { header: "Cantidad Cuotas", width: 14, value: (l) => readString(datosOf(l), "cantidadCuotas") },
  {
    header: "Valor Estimado Cuota (COP)",
    width: 20,
    value: (l) => {
      const c = readNumber(datosOf(l), "valorCuota");
      return c != null ? formatMoney(c) : "";
    },
  },
  {
    header: "Destino del Crédito",
    width: 26,
    value: (l) => readOption(datosOf(l), "destinoCredito", DESTINO_CREDITO_LABELS),
  },
  {
    header: "Día Pago Oportuno",
    width: 14,
    value: (l) => readString(datosOf(l), "diaPagoOportuno") || readString(datosOf(l), "diaPagoCuota"),
  },
  { header: "Mes Pago Oportuno", width: 14, value: (l) => readString(datosOf(l), "mesPagoOportuno") },
  { header: "Año Pago Oportuno", width: 14, value: (l) => readString(datosOf(l), "anoPagoOportuno") },
  { header: "Modo Pago Oportuno", width: 20, value: (l) => readString(datosOf(l), "fechaPagoOportunoModo") },
  {
    header: "Cuota Capital e Interés",
    width: 20,
    value: (l) => {
      const v = readNumber(datosOf(l), "cuotaCapitalInteres");
      return v != null ? formatMoney(v) : "";
    },
  },
  {
    header: "Cuota Fianza Mensual",
    width: 18,
    value: (l) => {
      const v = readNumber(datosOf(l), "cuotaFianzaMensual");
      return v != null ? formatMoney(v) : "";
    },
  },
  {
    header: "Cuota Seguro Deudores",
    width: 18,
    value: (l) => {
      const v = readNumber(datosOf(l), "cuotaVidaDeudoresMensual");
      return v != null ? formatMoney(v) : "";
    },
  },
  {
    header: "Valor Total Financiado",
    width: 20,
    value: (l) => {
      const v = readNumber(datosOf(l), "valorCreditoFinanciado");
      return v != null ? formatMoney(v) : "";
    },
  },
  {
    header: "Estudio de Crédito",
    width: 18,
    value: (l) => {
      const v = readNumber(datosOf(l), "estudioCredito");
      return v != null ? formatMoney(v) : "";
    },
  },
  {
    header: "¿Mora Vigente en Centrales?",
    width: 18,
    value: (l) => readOption(datosOf(l), "moraVigente", SI_NO_LABELS),
  },

  // 5. Información financiera
  {
    header: "Ingresos Mensuales (COP)",
    width: 20,
    value: (l) => {
      const v = readNumber(datosOf(l), "ingresosMensuales");
      return v != null ? formatMoney(v) : "";
    },
  },
  {
    header: "Origen Otros Ingresos",
    width: 26,
    value: (l) => readOption(datosOf(l), "origenOtrosIngresos", ORIGEN_OTROS_INGRESOS_LABELS),
  },
  { header: "Detalle Otros Ingresos (Otro)", width: 24, value: (l) => readString(datosOf(l), "origenOtrosIngresosOtro") },
  {
    header: "Valor Otros Ingresos (COP)",
    width: 20,
    value: (l) => {
      const v = readNumber(datosOf(l), "otrosIngresos");
      return v != null ? formatMoney(v) : "";
    },
  },
  {
    header: "Egresos Mensuales (COP)",
    width: 20,
    value: (l) => {
      const v = readNumber(datosOf(l), "egresosMensuales");
      return v != null ? formatMoney(v) : "";
    },
  },
  {
    header: "Activos Totales (COP)",
    width: 20,
    value: (l) => {
      const v = readNumber(datosOf(l), "activosTotales");
      return v != null ? formatMoney(v) : "";
    },
  },
  {
    header: "Pasivos Totales (COP)",
    width: 20,
    value: (l) => {
      const v = readNumber(datosOf(l), "pasivosTotales");
      return v != null ? formatMoney(v) : "";
    },
  },

  // 6. Información laboral / empleo
  { header: "Ocupación u Oficio", width: 22, value: (l) => readString(datosOf(l), "ocupacion") },
  {
    header: "Empresa / Empleador",
    width: 26,
    value: (l) => readString(datosOf(l), "empresa") || readString(datosOf(l), "empresaLaboral"),
  },
  {
    header: "Cargo",
    width: 22,
    value: (l) => readString(datosOf(l), "cargo") || readString(datosOf(l), "cargoLaboral"),
  },
  {
    header: "Tipo de Contrato",
    width: 20,
    value: (l) => readOption(datosOf(l), "tipoContrato", TIPO_CONTRATO_LABELS),
  },
  {
    header: "Fecha Ingreso Laboral",
    width: 18,
    value: (l) => formatDate(readString(datosOf(l), "fechaIngreso") || readString(datosOf(l), "fechaIngresoLaboral")),
  },
  { header: "Teléfono Laboral", width: 16, value: (l) => readString(datosOf(l), "telefonoLaboral") },
  { header: "Dirección Laboral", width: 28, value: (l) => readString(datosOf(l), "direccionLaboral") },
  { header: "Barrio Laboral", width: 20, value: (l) => readString(datosOf(l), "barrioLaboral") },
  { header: "Ciudad Laboral", width: 18, value: (l) => readString(datosOf(l), "ciudadLaboral") },
  { header: "Actividad Económica", width: 22, value: (l) => readString(datosOf(l), "actividadEconomica") },
  {
    header: "Tiene Convenio Vigente",
    width: 18,
    value: (l) => readOption(datosOf(l), "tieneConvenioVigente", SI_NO_LABELS),
  },

  // 7. Información de negocio (Microcrédito Urbano / Rural)
  { header: "Nombre del Negocio", width: 24, value: (l) => readString(datosOf(l), "nombreNegocio") },
  { header: "Fecha Inicio Negocio", width: 18, value: (l) => formatDate(readString(datosOf(l), "fechaInicioNegocio")) },
  { header: "Dirección del Negocio", width: 28, value: (l) => readString(datosOf(l), "direccionNegocio") },
  { header: "Barrio del Negocio", width: 20, value: (l) => readString(datosOf(l), "barrioNegocio") },
  { header: "Ciudad del Negocio", width: 18, value: (l) => readString(datosOf(l), "ciudadNegocio") },
  { header: "Teléfono del Negocio", width: 16, value: (l) => readString(datosOf(l), "telefonoNegocio") },

  // 8. Activos propios (Vivienda y Vehículo)
  {
    header: "¿Tiene Vivienda Propia?",
    width: 18,
    value: (l) => readOption(datosOf(l), "tieneVivienda", SI_NO_LABELS),
  },
  {
    header: "Vivienda a Nombre del Cliente",
    width: 20,
    value: (l) => readOption(datosOf(l), "viviendaANombreCliente", SI_NO_LABELS),
  },
  { header: "Dirección de la Vivienda", width: 28, value: (l) => readString(datosOf(l), "direccionVivienda") },
  {
    header: "¿Tiene Vehículo?",
    width: 16,
    value: (l) => readOption(datosOf(l), "tieneVehiculo", SI_NO_LABELS),
  },
  {
    header: "Vehículo a Nombre del Cliente",
    width: 20,
    value: (l) => readOption(datosOf(l), "vehiculoANombreCliente", SI_NO_LABELS),
  },
  { header: "Placa del Vehículo", width: 16, value: (l) => readString(datosOf(l), "placaVehiculo").toUpperCase() },

  // 9. Referencia familiar o personal
  {
    header: "Tipo de Referencia",
    width: 16,
    value: (l) => readOption(datosOf(l), "referenciaTipo", TIPO_REFERENCIA_LABELS),
  },
  {
    header: "Parentesco Referencia",
    width: 18,
    value: (l) => readOption(datosOf(l), "referenciaParentesco", PARENTESCO_LABELS),
  },
  { header: "Parentesco Referencia (Otro)", width: 20, value: (l) => readString(datosOf(l), "referenciaParentescoOtro") },
  { header: "Nombre Referencia", width: 28, value: (l) => readString(datosOf(l), "referenciaFamiliarNombre") },
  { header: "Teléfono Referencia", width: 16, value: (l) => readString(datosOf(l), "referenciaFamiliarTelefono") },

  // 10. Datos bancarios para desembolso
  {
    header: "Tipo de Cuenta",
    width: 16,
    value: (l) => readOption(datosOf(l), "tipoCuenta", TIPO_CUENTA_LABELS),
  },
  { header: "Entidad Bancaria", width: 24, value: (l) => readString(datosOf(l), "entidadBancaria") },
  { header: "Número Cuenta / Llave", width: 24, value: (l) => readString(datosOf(l), "numeroCuenta") },

  // 11. Documentos y validaciones
  { header: "Cédula Frontal", width: 30, value: (l) => readAttachmentInfo(datosOf(l), "cedulaFrontal") },
  { header: "Cédula Reverso", width: 30, value: (l) => readAttachmentInfo(datosOf(l), "cedulaReverso") },
  { header: "Video Verificación", width: 30, value: (l) => readAttachmentInfo(datosOf(l), "videoVerificacion") },
  { header: "Firma Digital", width: 20, value: (l) => readAttachmentInfo(datosOf(l), "firma") },
  { header: "Validación Cédula (Registraduría)", width: 30, value: (l) => readCedulaVerificacion(datosOf(l)) },
  { header: "Resultado Nodos", width: 16, value: (l) => readString(datosOf(l), "resultadoNodos") },

];

/* ─── Conjunto de llaves estándar para detectar campos extra ── */

const KNOWN_DATA_KEYS = new Set([
  "tipoCredito", "nombre", "cedula", "telefono", "email", "tipoIdentificacion",
  "fechaExpedicion", "fechaNacimiento", "genero", "estadoCivil", "estrato",
  "personasACargo", "nivelEducacion", "profesion", "nombreConyuge",
  "departamento", "municipio", "ciudad", "sectorDomicilio", "direccion", "barrio",
  "capitalSeleccionado", "capitalSolicitado", "cantidadCuotas", "valorCuota",
  "destinoCredito", "diaPagoOportuno", "mesPagoOportuno", "anoPagoOportuno",
  "diaPagoCuota", "fechaPagoOportunoModo", "cuotaCapitalInteres", "cuotaFianzaMensual",
  "cuotaVidaDeudoresMensual", "valorCreditoFinanciado", "estudioCredito", "moraVigente",
  "ingresosMensuales", "origenOtrosIngresos", "origenOtrosIngresosOtro", "otrosIngresos",
  "egresosMensuales", "activosTotales", "pasivosTotales",
  "ocupacion", "empresa", "empresaLaboral", "cargo", "cargoLaboral", "tipoContrato",
  "fechaIngreso", "fechaIngresoLaboral", "telefonoLaboral", "direccionLaboral",
  "barrioLaboral", "ciudadLaboral", "actividadEconomica", "tieneConvenioVigente",
  "nombreNegocio", "fechaInicioNegocio", "direccionNegocio", "barrioNegocio",
  "ciudadNegocio", "telefonoNegocio",
  "tieneVivienda", "viviendaANombreCliente", "direccionVivienda",
  "tieneVehiculo", "vehiculoANombreCliente", "placaVehiculo",
  "referenciaTipo", "referenciaParentesco", "referenciaParentescoOtro",
  "referenciaFamiliarNombre", "referenciaFamiliarTelefono",
  "tipoCuenta", "entidadBancaria", "numeroCuenta",
  "cedulaFrontal", "cedulaReverso", "videoVerificacion", "firma",
  "cedulaVerificacion", "resultadoNodos", "geolocalizacion",
  "aceptaTerminos", "fechaAceptacionTerminos", "ip", "utm", "geoCliente",
  "utmCampaign", "utmSource", "utmMedium", "utmTerm", "utmContent",
  "latitud", "longitud", "pais",
  "_progreso", "pasoActualFormulario", "draftLeadId", "id", "storage",
]);

/** Detecta cualquier campo adicional presente en los leads para agregarlo al final del Excel. */
function collectExtraColumns(leads: LeadExportRecord[]): ExportColumn[] {
  const extraKeysSet = new Set<string>();

  for (const lead of leads) {
    const datos = datosOf(lead);
    for (const key of Object.keys(datos)) {
      if (!KNOWN_DATA_KEYS.has(key) && !key.startsWith("_") && !key.startsWith("payload")) {
        extraKeysSet.add(key);
      }
    }
  }

  return Array.from(extraKeysSet)
    .sort()
    .map((key) => ({
      header: `[Adicional] ${key}`,
      width: Math.max(18, key.length + 12),
      value: (l: LeadExportRecord) => {
        const val = datosOf(l)[key];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return String(val);
      },
    }));
}

/* ─── Estilos y construcción del Excel ─────────────────────── */

function applyHeaderStyle(worksheet: XLSX.WorkSheet, columnCount: number) {
  for (let column = 0; column < columnCount; column += 1) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: column });
    const cell = worksheet[cellRef];
    if (!cell) continue;
    cell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, name: "Calibri", sz: 10 },
      fill: { fgColor: { rgb: "002446" } }, // Coodelsur azul corporativo principal
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "013B72" } },
        bottom: { style: "medium", color: { rgb: "013B72" } },
        left: { style: "thin", color: { rgb: "013B72" } },
        right: { style: "thin", color: { rgb: "013B72" } },
      },
    };
  }
}

/** Construye el buffer `.xlsx` con todos los campos del formulario. */
export function buildLeadsExcelBuffer(leads: LeadExportRecord[]): Buffer {
  const extraColumns = collectExtraColumns(leads);
  const allColumns = [...BASE_COLUMNS, ...extraColumns];

  const headers = allColumns.map((column) => column.header);
  const rows = leads.map((lead) =>
    allColumns.map((column) => {
      const value = column.value(lead);
      if (value === null || value === undefined) return "";
      return value;
    }),
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = allColumns.map((column) => ({ wch: column.width }));
  worksheet["!rows"] = [{ hpt: 26 }]; // Altura generosa para el encabezado

  if (leads.length > 0) {
    worksheet["!autofilter"] = {
      ref: `A1:${XLSX.utils.encode_col(allColumns.length - 1)}${leads.length + 1}`,
    };
  }

  applyHeaderStyle(worksheet, allColumns.length);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Solicitudes Coodelsur");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildExportFilename(scope: "selected" | "report"): string {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = scope === "selected" ? "seleccionadas" : "informe-general";
  return `solicitudes-coodelsur-${suffix}-${date}.xlsx`;
}
