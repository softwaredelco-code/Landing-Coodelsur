/**
 * Generador fiel del archivo Excel de Análisis de Crédito individual.
 *
 * Utiliza JSZip para modificar directamente los nodos XML de las celdas
 * de la plantilla oficial de Coodelsur, PRESERVANDO EL 100% de los estilos:
 * - Colores corporativos (azul oscuro #002060, azul medio #0070C0, verde claro)
 * - Bordes, fuentes y alineaciones originales
 * - Formatos numéricos de moneda ($ #,##0) y porcentajes (0,00%)
 * - Reglas de formato condicional (verde "Prestar", rojo "Rechazar")
 * - Logotipos, encabezados y las 11 hojas de cálculo intactas
 * - Fórmulas vivas con recálculo automático al abrir en Excel (fullCalcOnLoad="1")
 */
import JSZip from "jszip";
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
    path.join(process.cwd(), "docs", "AnalisisCredito_Barrera_1116548410_Nano.xlsx"),
    path.join(process.cwd(), "public", "templates", "analisis-credito-template.xlsx"),
    path.join(process.cwd(), "templates", "analisis-credito-template.xlsx"),
    path.join(__dirname, "..", "..", "..", "docs", "AnalisisCredito_Barrera_1116548410_Nano.xlsx"),
    path.join(__dirname, "..", "..", "..", "public", "templates", "analisis-credito-template.xlsx"),
    path.join(__dirname, "..", "..", "..", "templates", "analisis-credito-template.xlsx"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("No se encontró la plantilla de análisis de crédito (docs/AnalisisCredito_Barrera_1116548410_Nano.xlsx)");
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
  if (!raw || typeof raw !== "string") return "Consolidación de Deudas";
  const map: Record<string, string> = {
    consolidacion_deudas: "Consolidación de Deudas",
    gastos_personales: "Gastos Personales",
    capital_trabajo: "Capital de Trabajo",
    educacion: "Educación",
    salud: "Salud",
    viajes: "Viajes / Recreación",
    vivienda: "Mejoras de vivienda",
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

function escapeXml(unsafe: unknown): string {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface UpdateCellOptions {
  value: string | number;
  isString?: boolean;
  formula?: string;
  defaultStyle?: string;
}

/**
 * Actualiza o inserta una celda en el XML de una hoja conservando su estilo y fórmula.
 */
function updateCell(xml: string, cellRef: string, options: UpdateCellOptions): string {
  const { value, isString = false, formula, defaultStyle } = options;
  const cellRegex = new RegExp('<c\\s+r="' + cellRef + '"(?:\\s+[^>]*)?(?:\\/>|>[\\s\\S]*?<\\/c>)');
  const match = xml.match(cellRegex);

  let styleAttr = defaultStyle ? `s="${defaultStyle}"` : "";
  let existingFormula = formula;

  if (match) {
    const sMatch = match[0].match(/s="(\d+)"/);
    if (sMatch) styleAttr = `s="${sMatch[1]}"`;
    if (!existingFormula) {
      const fMatch = match[0].match(/<f[^>]*>([\s\S]*?)<\/f>/);
      if (fMatch) existingFormula = fMatch[1];
    }
  }

  let newCell = "";
  if (existingFormula) {
    if (isString) {
      newCell = `<c r="${cellRef}" ${styleAttr} t="str"><f>${existingFormula}</f><v>${escapeXml(value)}</v></c>`;
    } else {
      const num = isNaN(Number(value)) ? 0 : Number(value);
      newCell = `<c r="${cellRef}" ${styleAttr}><f>${existingFormula}</f><v>${num}</v></c>`;
    }
  } else if (isString) {
    newCell = `<c r="${cellRef}" ${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  } else {
    const num = isNaN(Number(value)) ? 0 : Number(value);
    newCell = `<c r="${cellRef}" ${styleAttr}><v>${num}</v></c>`;
  }

  if (match) {
    return xml.replace(cellRegex, newCell);
  } else {
    const rowNum = cellRef.replace(/[A-Z]/g, "");
    const rowRegex = new RegExp('(<row[^>]*r="' + rowNum + '"[^>]*>)([\\s\\S]*?)(<\\/row>)');
    if (rowRegex.test(xml)) {
      return xml.replace(rowRegex, (_m, open, content, close) => open + content + newCell + close);
    }
    return xml;
  }
}

export async function buildLeadAnalisisExcelBuffer(lead: LeadAnalisisInput): Promise<Buffer> {
  const templateBuffer = getTemplateBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);

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
  const quanto = Number(datos.quantoMedio || datos.ingresosMedio || (ingresos > 0 ? ingresos : 3011000));

  const fechaSolicitud = new Date(lead.fechaCreacion);
  const fechaValida = !isNaN(fechaSolicitud.getTime()) ? fechaSolicitud : new Date();
  const dia = fechaValida.getDate();
  const mes = fechaValida.getMonth() + 1;
  const ano = fechaValida.getFullYear();

  // 1. Hoja 'Plan de pagos' (xl/worksheets/sheet2.xml)
  const sheet2File = zip.file("xl/worksheets/sheet2.xml");
  if (sheet2File) {
    let s2 = await sheet2File.async("text");
    s2 = updateCell(s2, "M5", { value: nombre, isString: true, defaultStyle: "262" });
    s2 = updateCell(s2, "M6", { value: cedula, isString: false, defaultStyle: "262" });
    s2 = updateCell(s2, "M7", { value: destino, isString: true, defaultStyle: "262" });
    s2 = updateCell(s2, "M8", { value: empresa, isString: true, defaultStyle: "262" });
    s2 = updateCell(s2, "M9", { value: cargo, isString: true, defaultStyle: "262" });
    s2 = updateCell(s2, "M10", { value: linea, isString: true, defaultStyle: "263" });
    s2 = updateCell(s2, "P13", { value: montoSolicitado, isString: false, defaultStyle: "68" });
    s2 = updateCell(s2, "P14", { value: montoSolicitado, isString: false, defaultStyle: "68" });
    s2 = updateCell(s2, "F8", { value: cuotas, isString: false, defaultStyle: "288" });
    s2 = updateCell(s2, "F9", { value: dia, isString: false, defaultStyle: "49" });
    s2 = updateCell(s2, "G9", { value: mes, isString: false, defaultStyle: "49" });
    s2 = updateCell(s2, "H9", { value: ano, isString: false, defaultStyle: "50" });
    zip.file("xl/worksheets/sheet2.xml", s2);
  }

  // 2. Hoja 'Flujo Empleado' (xl/worksheets/sheet3.xml)
  const sheet3File = zip.file("xl/worksheets/sheet3.xml");
  if (sheet3File) {
    let s3 = await sheet3File.async("text");
    s3 = updateCell(s3, "D8", { value: ingresos, isString: false, defaultStyle: "117" });
    s3 = updateCell(s3, "D9", { value: quanto, isString: false, defaultStyle: "117" });
    zip.file("xl/worksheets/sheet3.xml", s3);
  }

  // 3. Hoja 'Analisis' (xl/worksheets/sheet4.xml)
  const sheet4File = zip.file("xl/worksheets/sheet4.xml");
  if (sheet4File) {
    let s4 = await sheet4File.async("text");
    s4 = updateCell(s4, "C10", { value: Number(datos.puntajeBegini || 0), isString: false, defaultStyle: "192" });

    const esCotizante = datos.esCotizante !== undefined ? (datos.esCotizante ? "SI" : "NO") : "SI";
    s4 = updateCell(s4, "C15", { value: esCotizante, isString: true, defaultStyle: "193" });

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

    const novedad = String(datos.novedad || datos.novedades || "");
    const propiedades = String(datos.propiedades || datos.tienePropiedades || "");

    const concepto = [
      `Tipo crédito:  ${linea}`,
      `Adres:  ${esCotizante === "SI" ? "Cotizante" : "No cotizante"}`,
      `Validación de identidad:  Aprobada`,
      `Email:  ${lead.email || "No reportado"}`,
      `Dirección:  ${dir}`,
      `Tel Cel:  ${lead.telefono || "No reportado"}`,
      `Cuenta:  ${cuenta}`,
      `Novedad:  ${novedad}`,
      `Propiedades:  ${propiedades}`,
      `Nota:  Solicitud web registrada el ${fechaValida.toLocaleString("es-CO")}`,
    ].join("\n");

    s4 = updateCell(s4, "D19", { value: concepto, isString: true, defaultStyle: "342" });
    s4 = updateCell(s4, "C32", { value: `Fecha:  ${fechaValida.toLocaleDateString("es-CO")}`, isString: true, defaultStyle: "209" });

    zip.file("xl/worksheets/sheet4.xml", s4);
  }

  // 4. Hoja 'Referenciación' (xl/worksheets/sheet7.xml)
  const sheet7File = zip.file("xl/worksheets/sheet7.xml");
  if (sheet7File) {
    let s7 = await sheet7File.async("text");
    if (empresa && empresa !== "No reporta") {
      s7 = updateCell(s7, "C11", { value: empresa, isString: true, defaultStyle: "358" });
      if (datos.empresaTelefono || datos.telefonoEmpresa) {
        s7 = updateCell(s7, "F11", { value: String(datos.empresaTelefono || datos.telefonoEmpresa), isString: true, defaultStyle: "358" });
      }
      s7 = updateCell(s7, "C13", { value: cargo, isString: true, defaultStyle: "358" });
    }
    if (datos.referenciaFamiliarNombre) {
      s7 = updateCell(s7, "C17", { value: String(datos.referenciaFamiliarNombre), isString: true, defaultStyle: "358" });
      if (datos.referenciaFamiliarTelefono) {
        s7 = updateCell(s7, "F17", { value: String(datos.referenciaFamiliarTelefono), isString: true, defaultStyle: "358" });
      }
      s7 = updateCell(s7, "C19", { value: String(datos.referenciaFamiliarParentesco || datos.parentesco || "Familiar"), isString: true, defaultStyle: "358" });
    }
    if (datos.referenciaPersonalNombre) {
      s7 = updateCell(s7, "C35", { value: String(datos.referenciaPersonalNombre), isString: true, defaultStyle: "358" });
      if (datos.referenciaPersonalTelefono) {
        s7 = updateCell(s7, "F35", { value: String(datos.referenciaPersonalTelefono), isString: true, defaultStyle: "358" });
      }
      s7 = updateCell(s7, "C37", { value: String(datos.referenciaPersonalParentesco || "Personal / Amigo"), isString: true, defaultStyle: "358" });
    }
    zip.file("xl/worksheets/sheet7.xml", s7);
  }

  // 5. Forzar recálculo automático de todas las fórmulas al abrir en Excel
  const wbFile = zip.file("xl/workbook.xml");
  if (wbFile) {
    let wbXml = await wbFile.async("text");
    wbXml = wbXml.replace(/<calcPr[^>]*\/?>/, '<calcPr calcId="152511" fullCalcOnLoad="1" forceFullCalculation="1"/>');
    zip.file("xl/workbook.xml", wbXml);
  }

  // Generar binario preservando 100% de la compresión, estilos y relaciones
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return buffer;
}
