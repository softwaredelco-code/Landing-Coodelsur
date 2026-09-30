/**
 * Generador del archivo Excel de Análisis de Crédito individual.
 * Extrae la hoja oficial 'Analisis' de la plantilla corporativa,
 * inyecta los datos de la solicitud y preserva el formato corporativo y fórmulas.
 */
import XLSX from "xlsx-js-style";
import path from "path";
import fs from "fs";

export interface LeadAnalisisInput {
  id: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string | null;
  tipoCredito: string;
  capitalSolicitado: number | null;
  valorCuota?: number | null;
  cantidadCuotas?: number | string | null;
  fechaCreacion: Date | string;
  datosFormulario?: Record<string, unknown> | null;
}

function resolveTemplatePath(): string {
  const candidates = [
    path.join(process.cwd(), "public", "templates", "analisis-credito-template.xlsx"),
    path.join(process.cwd(), "templates", "analisis-credito-template.xlsx"),
    path.join(__dirname, "..", "..", "..", "public", "templates", "analisis-credito-template.xlsx"),
    path.join(__dirname, "..", "..", "..", "templates", "analisis-credito-template.xlsx"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("No se encontró la plantilla de análisis de crédito (analisis-credito-template.xlsx)");
}

export function extractPrimerApellido(nombre: string): string {
  const parts = (nombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "Cliente";
  // Si tiene 3 o más palabras (ej: "Barrera Rodriguez Luz Carine" o "Luz Carine Barrera Rodriguez")
  // Tomamos la primera palabra si parece apellido o la penúltima
  const token = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function buildAnalisisFileName(nombre: string, cedula: string): string {
  const apellido = extractPrimerApellido(nombre);
  const cleanCedula = (cedula || "").replace(/\D/g, "") || "0";
  return `AnalisisCredito_${apellido}_${cleanCedula}_Nano.xlsx`;
}

function formatDestinoCredito(raw?: unknown): string {
  if (!raw || typeof raw !== "string") return "Libre inversión";
  const map: Record<string, string> = {
    consolidacion_deudas: "Consolidación de Deudas",
    gastos_personales: "Gastos Personales",
    capital_trabajo: "Capital de Trabajo",
    educacion: "Educación",
    salud: "Salud",
    viajes: "Viajes / Recreación",
    vivienda: "Mejoras de Vivienda",
  };
  return map[raw.toLowerCase()] || raw;
}

function formatLineaCredito(tipoCredito: string): string {
  switch (tipoCredito) {
    case "microcredito_small":
      return "Nanocredito";
    case "libranza":
      return "Libranza";
    case "microcredito_urbano":
      return "Microcrédito Urbano";
    default:
      return "Nanocredito";
  }
}

export function buildLeadAnalisisExcelBuffer(lead: LeadAnalisisInput): Buffer {
  const templatePath = resolveTemplatePath();
  const fileBuffer = fs.readFileSync(templatePath);
  const templateWb = XLSX.read(fileBuffer, {
    type: "buffer",
    cellStyles: true,
    cellFormula: true,
    cellDates: true,
  });

  const analisisSheet = templateWb.Sheets["Analisis"];
  if (!analisisSheet) {
    throw new Error("La plantilla no contiene la hoja 'Analisis'");
  }

  // Crear libro nuevo con EXCLUSIVAMENTE la hoja 'Analisis'
  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, analisisSheet, "Analisis");

  const datos = (lead.datosFormulario || {}) as Record<string, unknown>;

  // Extraer valores del lead
  const nombre = (lead.nombre || "").trim().toUpperCase();
  const cedula = (lead.cedula || "").trim();
  const empresa = String(datos.empresa || datos.empresaLaboral || datos.nombreEmpresa || "No reporta").trim();
  const cargo = String(datos.cargo || datos.ocupacion || "Empleado").trim();
  const destino = formatDestinoCredito(datos.destinoCredito || datos.destino_credito);
  const linea = formatLineaCredito(lead.tipoCredito);

  const montoSolicitado = Number(lead.capitalSolicitado || datos.capitalSeleccionado || datos.monto || 0);
  const ingresos = Number(datos.ingresosMensuales || datos.ingresos_mensuales || datos.ingresos || 0);
  const cuota = Number(lead.valorCuota || datos.valorCuota || datos.valor_cuota || 0);
  const gastosSostenimiento = Math.round(ingresos > 0 ? ingresos * 0.35 : 0);
  const cuotaTotalMasGastos = (cuota > 0 ? cuota : Math.round(montoSolicitado * 0.4)) + gastosSostenimiento;

  // 1. Datos básicos del cliente (Filas 4 a 6)
  if (analisisSheet["C4"]) {
    delete analisisSheet["C4"].f;
    analisisSheet["C4"].v = nombre;
    analisisSheet["C4"].t = "s";
  }
  if (analisisSheet["E4"]) {
    delete analisisSheet["E4"].f;
    analisisSheet["E4"].v = empresa;
    analisisSheet["E4"].t = "s";
  }
  if (analisisSheet["C5"]) {
    delete analisisSheet["C5"].f;
    analisisSheet["C5"].v = cedula;
    analisisSheet["C5"].t = "s";
  }
  if (analisisSheet["E5"]) {
    delete analisisSheet["E5"].f;
    analisisSheet["E5"].v = cargo;
    analisisSheet["E5"].t = "s";
  }
  if (analisisSheet["C6"]) {
    delete analisisSheet["C6"].f;
    analisisSheet["C6"].v = destino;
    analisisSheet["C6"].t = "s";
  }
  if (analisisSheet["E6"]) {
    delete analisisSheet["E6"].f;
    analisisSheet["E6"].v = linea;
    analisisSheet["E6"].t = "s";
  }

  // 2. Parámetros de aprobación / rechazo (Filas 10 a 15)
  // C10: Puntaje Begini
  if (analisisSheet["C10"]) {
    analisisSheet["C10"].v = Number(datos.puntajeBegini || 0);
    analisisSheet["C10"].t = "n";
  }
  if (analisisSheet["D10"]) {
    analisisSheet["D10"].f =
      'IF(C10=0,"No contesto",IF(C10=1,"Riesgo más alto",IF(C10=2,"Riesgo muy alto",IF(C10=3,"Riesgo alto",IF(C10=4,"Riesgo medio",IF(C10=5,"Riesgo bajo",IF(C10=6,"Riesgo muy bajo",IF(C10=7,"Riesgo más bajo",IF(C10=8,"No terminó","")))))))))';
  }

  // C11: Puntaje centrales
  if (analisisSheet["D11"]) {
    analisisSheet["D11"].f =
      '+IF(C11="","",IF(C11<500,"Rechazar",IF(C11<700,"Estudio",IF(C11>=700,"Prestar",0))))';
  }

  // C12: Ingreso / Quanto medio
  if (analisisSheet["C12"]) {
    delete analisisSheet["C12"].f;
    analisisSheet["C12"].v = ingresos;
    analisisSheet["C12"].t = "n";
  }
  if (analisisSheet["D12"]) {
    analisisSheet["D12"].f = '+IF(C12>=1000000,"Prestar","Rechazado")';
  }

  // C13: Cuota nueva + total gastos
  if (analisisSheet["C13"]) {
    delete analisisSheet["C13"].f;
    analisisSheet["C13"].v = cuotaTotalMasGastos;
    analisisSheet["C13"].t = "n";
  }
  if (analisisSheet["D13"]) {
    analisisSheet["D13"].f = '+IF(C13<=C12,"Prestar","Rechazado")';
  }

  // C14: Capacidad de pago (Fórmula local =+C12-C13)
  if (analisisSheet["C14"]) {
    analisisSheet["C14"].f = "+C12-C13";
    analisisSheet["C14"].v = ingresos - cuotaTotalMasGastos;
    analisisSheet["C14"].t = "n";
  }
  if (analisisSheet["D14"]) {
    analisisSheet["D14"].f = '+IF(C14<=0,"Rechazado","Prestar")';
  }

  // C15: Marcación si es cotizante (Adres)
  const esCotizante = datos.esCotizante !== undefined ? (datos.esCotizante ? "SI" : "NO") : "SI";
  if (analisisSheet["C15"]) {
    delete analisisSheet["C15"].f;
    analisisSheet["C15"].v = esCotizante;
    analisisSheet["C15"].t = "s";
  }
  if (analisisSheet["D15"]) {
    analisisSheet["D15"].f = '+IF(C15="SI","Prestar","Rechazado")';
  }

  // Limpiar posibles referencias de error en fórmulas externas
  delete analisisSheet["G16"];
  delete analisisSheet["H16"];
  delete analisisSheet["H17"];
  delete analisisSheet["H18"];

  // 3. Montos y Valores (Filas 19 a 23)
  if (analisisSheet["C19"]) {
    delete analisisSheet["C19"].f;
    analisisSheet["C19"].v = montoSolicitado;
    analisisSheet["C19"].t = "n";
  }
  if (analisisSheet["C20"]) {
    delete analisisSheet["C20"].f;
    analisisSheet["C20"].v = montoSolicitado; // Sugerido igual al solicitado
    analisisSheet["C20"].t = "n";
  }
  if (analisisSheet["C21"]) {
    delete analisisSheet["C21"].f;
    analisisSheet["C21"].v = 0;
    analisisSheet["C21"].t = "n";
  }
  if (analisisSheet["C22"]) {
    delete analisisSheet["C22"].f;
    analisisSheet["C22"].v = 0;
    analisisSheet["C22"].t = "n";
  }
  if (analisisSheet["C23"]) {
    analisisSheet["C23"].f = "+C20-C21-C22";
    analisisSheet["C23"].v = montoSolicitado;
    analisisSheet["C23"].t = "n";
  }

  // 4. Concepto Ejecutivo de Cuenta (D19:G23 combinado)
  const direccionParts = [
    datos.direccion,
    datos.barrio ? `Br. ${datos.barrio}` : null,
    datos.municipio,
    datos.departamento,
  ].filter(Boolean);
  const direccion = direccionParts.length > 0 ? direccionParts.join(", ") : "No reportada";

  const banco = datos.entidadBancaria || datos.banco || "No reportado";
  const tipoCuenta = datos.tipoCuenta || "Ahorros";
  const numCuenta = datos.numeroCuenta || "No reportado";
  const cuentaStr = `${banco} - ${tipoCuenta} ${numCuenta}`;

  const moraStr =
    datos.moraVigente === "si"
      ? `Sí (${datos.moraEntidad || "Entidad"} - $${datos.moraValor || 0})`
      : "No registra";

  const refFamiliar =
    datos.referenciaFamiliarNombre && datos.referenciaFamiliarTelefono
      ? `${datos.referenciaFamiliarNombre} (${datos.referenciaFamiliarTelefono})`
      : "No reportada";

  const conceptoLineas = [
    `Tipo crédito:  ${linea}`,
    `Adres:  ${esCotizante === "SI" ? "Cotizante" : "No cotizante"}`,
    `Validación de identidad:  Aprobada`,
    `Email:  ${lead.email || "No reportado"}`,
    `Dirección:  ${direccion}`,
    `Tel Cel:  ${lead.telefono || "No reportado"}`,
    `Cuenta:  ${cuentaStr}`,
    `Mora reportada:  ${moraStr}`,
    `Ref. Familiar:  ${refFamiliar}`,
    `Nota:  Solicitud web completada el ${new Date(lead.fechaCreacion).toLocaleString("es-CO")}`,
  ];

  if (analisisSheet["D19"]) {
    delete analisisSheet["D19"].f;
    analisisSheet["D19"].v = conceptoLineas.join("\n");
    analisisSheet["D19"].t = "s";
  }

  // 5. Fecha en C32
  const fechaObj = new Date(lead.fechaCreacion);
  const fechaFormat = isNaN(fechaObj.getTime())
    ? new Date().toLocaleDateString("es-CO")
    : fechaObj.toLocaleDateString("es-CO");
  if (analisisSheet["C32"]) {
    delete analisisSheet["C32"].f;
    analisisSheet["C32"].v = `Fecha:  ${fechaFormat}`;
    analisisSheet["C32"].t = "s";
  }

  // Escribir a buffer binario
  const buffer = XLSX.write(newWb, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });

  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
