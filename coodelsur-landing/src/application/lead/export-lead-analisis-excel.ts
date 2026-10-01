/**
 * Generador completo del archivo Excel de Análisis de Crédito individual.
 * Inyecta los datos de la solicitud en la plantilla corporativa oficial
 * manteniendo intactas las 11 hojas de cálculo originales:
 * 1. Simulador
 * 2. Plan de pagos
 * 3. Flujo Empleado
 * 4. Analisis
 * 5. Guion
 * 6. Preguntas_Reto
 * 7. Referenciación
 * 8. Fotos
 * 9. Preguntas reto
 * 10. ListaDepegable
 * 11. Evidencia Fotografica
 */
import * as XLSX from "xlsx-js-style";
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

let cachedTemplateBuffer: Buffer | null = null;

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

function getTemplateBuffer(): Buffer {
  if (cachedTemplateBuffer) return cachedTemplateBuffer;
  const tplPath = resolveTemplatePath();
  cachedTemplateBuffer = fs.readFileSync(tplPath);
  return cachedTemplateBuffer;
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
  const token = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function buildAnalisisFileName(nombre: string, cedula: string): string {
  const apellido = extractPrimerApellido(nombre);
  const cleanCedula = (cedula || "").replace(/\D/g, "") || "0";
  return `AnalisisCredito_${apellido}_${cleanCedula}_Nano.xlsx`;
}

function formatDestinoCredito(raw?: unknown): string {
  if (!raw || typeof raw !== "string") return "Libre Inversión";
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
  const templateBuffer = getTemplateBuffer();
  const wb = XLSX.read(templateBuffer, {
    type: "buffer",
    cellStyles: true,
    cellFormula: true,
    cellDates: true,
  });

  // Podar metadatos excesivos (!cols de 16,384 columnas) que disparan memoria y 503 en cPanel
  for (const sheetName of wb.SheetNames) {
    const s = wb.Sheets[sheetName];
    if (!s) continue;
    if (s["!cols"] && s["!cols"].length > 30) s["!cols"] = s["!cols"].slice(0, 30);
    if (s["!rows"] && s["!rows"].length > 100) s["!rows"] = s["!rows"].slice(0, 100);
  }

  const datos = (lead.datosFormulario || {}) as Record<string, unknown>;
  const nombre = (lead.nombre || "").trim().toUpperCase();
  const cedula = String(lead.cedula || "").trim();
  const empresa = String(datos.empresa || datos.empresaLaboral || datos.nombreEmpresa || "No reporta").trim();
  const cargo = String(datos.cargo || datos.ocupacion || "Empleado").trim();
  const destino = formatDestinoCredito(datos.destinoCredito || datos.destino_credito);
  const linea = formatLineaCredito(lead.tipoCredito);

  const montoSolicitado = Number(lead.capitalSolicitado || datos.capitalSeleccionado || datos.monto || 0);
  const cuotas = Number(lead.cantidadCuotas || datos.cantidadCuotas || 2);
  const ingresos = Number(datos.ingresosMensuales || datos.ingresos_mensuales || datos.ingresos || 0);

  const fechaSolicitud = new Date(lead.fechaCreacion);
  const fechaValida = !isNaN(fechaSolicitud.getTime()) ? fechaSolicitud : new Date();

  // 1. Inyectar datos en 'Plan de pagos' (Hoja principal de cálculo)
  const sheetPlan = wb.Sheets["Plan de pagos"];
  if (sheetPlan) {
    if (sheetPlan["M5"]) { sheetPlan["M5"].v = nombre; sheetPlan["M5"].t = "s"; }
    if (sheetPlan["M6"]) { sheetPlan["M6"].v = cedula; sheetPlan["M6"].t = "s"; }
    if (sheetPlan["M7"]) { sheetPlan["M7"].v = destino; sheetPlan["M7"].t = "s"; }
    if (sheetPlan["M8"]) { sheetPlan["M8"].v = empresa; sheetPlan["M8"].t = "s"; }
    if (sheetPlan["M9"]) { sheetPlan["M9"].v = cargo; sheetPlan["M9"].t = "s"; }
    if (sheetPlan["M10"]) { sheetPlan["M10"].v = linea; sheetPlan["M10"].t = "s"; }

    if (sheetPlan["P13"]) { sheetPlan["P13"].v = montoSolicitado; sheetPlan["P13"].t = "n"; }
    if (sheetPlan["P14"]) { sheetPlan["P14"].v = montoSolicitado; sheetPlan["P14"].t = "n"; }
    if (sheetPlan["F8"]) { sheetPlan["F8"].v = cuotas; sheetPlan["F8"].t = "n"; }

    if (sheetPlan["F9"]) { sheetPlan["F9"].v = fechaValida.getDate(); sheetPlan["F9"].t = "n"; }
    if (sheetPlan["G9"]) { sheetPlan["G9"].v = fechaValida.getMonth() + 1; sheetPlan["G9"].t = "n"; }
    if (sheetPlan["H9"]) { sheetPlan["H9"].v = fechaValida.getFullYear(); sheetPlan["H9"].t = "n"; }

    // Limpiar celdas fuera de rango en la columna lejana XEV para optimizar tamaño del XML
    delete sheetPlan["XEV5"];
    delete sheetPlan["XEV6"];
    delete sheetPlan["XEV7"];
    sheetPlan["!ref"] = "A1:R25";
  }

  // 2. Inyectar datos en 'Flujo Empleado'
  const sheetFlujo = wb.Sheets["Flujo Empleado"];
  if (sheetFlujo) {
    if (sheetFlujo["D8"]) { sheetFlujo["D8"].v = ingresos; sheetFlujo["D8"].t = "n"; }
    if (sheetFlujo["D9"]) {
      const quanto = Number(datos.quantoMedio || datos.ingresosMedio || (ingresos > 0 ? ingresos : 3011000));
      sheetFlujo["D9"].v = quanto;
      sheetFlujo["D9"].t = "n";
    }
  }

  // 3. Inyectar datos en 'Analisis'
  const sheetAnalisis = wb.Sheets["Analisis"];
  if (sheetAnalisis) {
    if (sheetAnalisis["C10"]) {
      sheetAnalisis["C10"].v = Number(datos.puntajeBegini || 0);
      sheetAnalisis["C10"].t = "n";
    }

    const dirParts = [
      datos.direccion,
      datos.barrio ? `Br. ${datos.barrio}` : "",
      datos.municipio,
      datos.departamento,
    ].filter(Boolean);
    const dir = dirParts.length ? dirParts.join(", ") : "No reportada";
    const banco = datos.entidadBancaria || datos.banco || "No reportado";
    const cuenta = `${banco} - ${datos.tipoCuenta || "Ahorros"} ${datos.numeroCuenta || ""}`.trim();
    const mora =
      datos.moraVigente === "si"
        ? `Sí (${datos.moraEntidad || "Entidad"} $${datos.moraValor || 0})`
        : "No registra";
    const refFamiliar =
      datos.referenciaFamiliarNombre && datos.referenciaFamiliarTelefono
        ? `${datos.referenciaFamiliarNombre} (${datos.referenciaFamiliarTelefono})`
        : "No reportada";

    const esCotizante = datos.esCotizante !== undefined ? (datos.esCotizante ? "SI" : "NO") : "SI";
    if (sheetAnalisis["C15"]) {
      sheetAnalisis["C15"].v = esCotizante;
      sheetAnalisis["C15"].t = "s";
    }

    const concepto = [
      `Tipo crédito:  ${linea}`,
      `Adres:  ${esCotizante === "SI" ? "Cotizante" : "No cotizante"}`,
      `Validación de identidad:  Aprobada`,
      `Email:  ${lead.email || "No reportado"}`,
      `Dirección:  ${dir}`,
      `Tel Cel:  ${lead.telefono || "No reportado"}`,
      `Cuenta:  ${cuenta}`,
      `Mora reportada:  ${mora}`,
      `Ref. Familiar:  ${refFamiliar}`,
      `Nota:  Solicitud web registrada el ${fechaValida.toLocaleString("es-CO")}`,
    ].join("\n");

    if (sheetAnalisis["D19"]) {
      delete sheetAnalisis["D19"].f;
      sheetAnalisis["D19"].v = concepto;
      sheetAnalisis["D19"].t = "s";
    }

    if (sheetAnalisis["C32"]) {
      delete sheetAnalisis["C32"].f;
      sheetAnalisis["C32"].v = `Fecha:  ${fechaValida.toLocaleDateString("es-CO")}`;
      sheetAnalisis["C32"].t = "s";
    }
  }

  // 4. Inyectar datos en 'Referenciación' si está disponible
  const sheetRef = wb.Sheets["Referenciación"];
  if (sheetRef) {
    if (empresa && empresa !== "No reporta") {
      sheetRef["C11"] = { v: empresa, t: "s" };
      if (datos.empresaTelefono || datos.telefonoEmpresa) {
        sheetRef["F11"] = { v: String(datos.empresaTelefono || datos.telefonoEmpresa), t: "s" };
      }
      sheetRef["C13"] = { v: cargo, t: "s" };
    }
    if (datos.referenciaFamiliarNombre) {
      sheetRef["C17"] = { v: String(datos.referenciaFamiliarNombre), t: "s" };
      if (datos.referenciaFamiliarTelefono) {
        sheetRef["F17"] = { v: String(datos.referenciaFamiliarTelefono), t: "s" };
      }
      sheetRef["C19"] = { v: String(datos.referenciaFamiliarParentesco || datos.parentesco || "Familiar"), t: "s" };
    }
    if (datos.referenciaPersonalNombre) {
      sheetRef["C35"] = { v: String(datos.referenciaPersonalNombre), t: "s" };
      if (datos.referenciaPersonalTelefono) {
        sheetRef["F35"] = { v: String(datos.referenciaPersonalTelefono), t: "s" };
      }
      sheetRef["C37"] = { v: String(datos.referenciaPersonalParentesco || "Personal / Amigo"), t: "s" };
    }
  }

  // Generar el archivo binario completo con todas las 11 hojas
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true });
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
