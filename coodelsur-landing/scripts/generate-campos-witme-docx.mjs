/**
 * Genera el catálogo de campos del formulario Microcrédito Small para Witme.
 * Solo especificación de formulario (sin API — fase posterior).
 * Ejecutar: npm run docs:campos-witme
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "docs", "formulario-microcredito-small-campos-witme.docx");

const STEPS = [
  { n: 1, id: "general", title: "Datos generales" },
  { n: 2, id: "credito", title: "Datos del crédito" },
  { n: 3, id: "domicilio", title: "Domicilio" },
  { n: 4, id: "activos", title: "Activos propios" },
  { n: 5, id: "laboral", title: "Información laboral" },
  { n: 6, id: "referencia", title: "Referencia personal o familiar" },
  { n: 7, id: "bancarios", title: "Datos bancarios" },
  { n: 8, id: "verificacion", title: "Verificación y autorización" },
];

const FIELDS = [
  {
    step: "api",
    key: "tipoCredito",
    label: "Tipo de crédito",
    type: "string",
    required: "Sí",
    apiLocation: "raiz+datos",
    validation: 'Valor fijo: "microcredito_small".',
    options: "microcredito_small",
  },
  {
    step: "general",
    key: "nombre",
    label: "Nombre y apellido",
    type: "string",
    required: "Sí",
    apiLocation: "raiz+datos",
    validation: "Mín. 3 caracteres en pantalla. Al enviar: 2 palabras, sin números, mín. 5 caracteres.",
  },
  {
    step: "general",
    key: "email",
    label: "Correo electrónico",
    type: "string (email)",
    required: "Sí",
    validation: "Formato email válido.",
  },
  {
    step: "general",
    key: "tipoIdentificacion",
    label: "Tipo de identificación",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options: "CC, CE, TI, NIT, PAS, PPT",
  },
  {
    step: "general",
    key: "cedula",
    label: "Número de identificación",
    type: "string",
    required: "Sí",
    apiLocation: "raiz+datos",
    validation: "CC: 6, 7 o 10 dígitos numéricos. Otros tipos: ver validación por tipo de documento.",
  },
  {
    step: "general",
    key: "telefono",
    label: "Teléfono celular",
    type: "string",
    required: "Sí",
    apiLocation: "raiz+datos",
    validation: "10 dígitos, inicia en 3 (celular Colombia).",
  },
  {
    step: "general",
    key: "genero",
    label: "Género",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options: "masculino, femenino, otro, no_decir",
  },
  {
    step: "general",
    key: "estadoCivil",
    label: "Estado civil",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options: "soltero, casado, union_libre, separado, viudo",
  },
  {
    step: "general",
    key: "fechaNacimiento",
    label: "Fecha de nacimiento",
    type: "string (fecha)",
    required: "Sí",
    apiLocation: "datos",
    validation: "YYYY-MM-DD. Edad mínima 18.",
  },
  {
    step: "general",
    key: "fechaExpedicion",
    label: "Fecha expedición documento",
    type: "string (fecha)",
    required: "Sí",
    apiLocation: "datos",
    validation: "YYYY-MM-DD. No futura.",
  },
  {
    step: "general",
    key: "personasACargo",
    label: "Personas a cargo",
    type: "number (entero)",
    required: "Sí",
    apiLocation: "datos",
    validation: "Entero ≥ 0.",
  },
  {
    step: "general",
    key: "estrato",
    label: "Estrato",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options: "1, 2, 3, 4, 5, 6",
  },
  {
    step: "credito",
    key: "capitalSeleccionado",
    label: "Capital solicitado (COP)",
    type: "number",
    required: "Sí",
    apiLocation: "datos",
    validation: "$200.000 – $600.000",
  },
  {
    step: "credito",
    key: "cantidadCuotas",
    label: "Cantidad de cuotas",
    type: "number (entero)",
    required: "Sí",
    apiLocation: "datos",
    options: "1, 2, 3",
  },
  {
    step: "credito",
    key: "valorCuota",
    label: "Valor de la cuota (COP)",
    type: "number",
    required: "Sí",
    apiLocation: "datos",
    validation: "Según tabla amortización Coodelsur (tasa 2,1%, estudio $30.000, fianza 12,5%).",
  },
  {
    step: "credito",
    key: "valorCreditoFinanciado",
    label: "Valor crédito financiado",
    type: "number",
    required: "No",
    apiLocation: "datos",
    validation: "Calculado: capital + estudio crédito.",
  },
  {
    step: "credito",
    key: "estudioCredito",
    label: "Estudio de crédito",
    type: "number",
    required: "No",
    apiLocation: "datos",
    validation: "$30.000 fijo (Small).",
  },
  {
    step: "credito",
    key: "cuotaCapitalInteres",
    label: "Cuota capital + interés",
    type: "number",
    required: "No",
    apiLocation: "datos",
    validation: "Desglose calculado.",
  },
  {
    step: "credito",
    key: "cuotaFianzaMensual",
    label: "Cuota fianza mensual",
    type: "number",
    required: "No",
    apiLocation: "datos",
    validation: "Desglose calculado.",
  },
  {
    step: "credito",
    key: "cuotaVidaDeudoresMensual",
    label: "Cuota vida deudores",
    type: "number",
    required: "No",
    apiLocation: "datos",
    validation: "Desglose calculado.",
  },
  {
    step: "credito",
    key: "destinoCredito",
    label: "Destino del crédito",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options:
      "capital_trabajo, mercancia, equipos_herramientas, gastos_negocio, gastos_personales, salud, educacion, transporte, otro",
  },
  {
    step: "credito",
    key: "fechaPagoOportunoModo",
    label: "Modo fecha pago oportuno",
    type: "string (fijo)",
    required: "Sí",
    apiLocation: "datos",
    options: "30_dias_despues_desembolso",
    validation: "Valor fijo. No lo elige el usuario.",
  },
  {
    step: "credito",
    key: "moraVigente",
    label: "¿Tiene mora vigente?",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options: "si, no",
  },
  {
    step: "credito",
    key: "ingresosMensuales",
    label: "Ingresos mensuales (COP)",
    type: "number",
    required: "Sí",
    apiLocation: "datos",
    validation: "> 0",
  },
  {
    step: "credito",
    key: "origenOtrosIngresos",
    label: "Origen otros ingresos",
    type: "string (enum)",
    required: "Condicional",
    apiLocation: "datos",
    options:
      "arriendos, negocio_propio, pension, apoyo_familiar, remesas, freelance, dividendos_intereses, otro",
    validation: "Obligatorio si otrosIngresos > 0.",
  },
  {
    step: "credito",
    key: "origenOtrosIngresosOtro",
    label: "Origen otros ingresos (otro)",
    type: "string",
    required: "Condicional",
    apiLocation: "datos",
    validation: 'Si origenOtrosIngresos = "otro".',
  },
  {
    step: "credito",
    key: "otrosIngresos",
    label: "Valor otros ingresos (COP)",
    type: "number",
    required: "Condicional",
    apiLocation: "datos",
    validation: "Obligatorio si origenOtrosIngresos tiene valor.",
  },
  {
    step: "domicilio",
    key: "departamento",
    label: "Departamento",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
    validation: "Código o nombre DIVIPOLA Colombia.",
  },
  {
    step: "domicilio",
    key: "municipio",
    label: "Municipio",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
    validation: "Según departamento.",
  },
  {
    step: "domicilio",
    key: "sectorDomicilio",
    label: "Sector del domicilio",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options: "urbano, rural",
  },
  {
    step: "domicilio",
    key: "direccion",
    label: "Dirección",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
    validation: "Mín. 5 caracteres.",
  },
  {
    step: "domicilio",
    key: "barrio",
    label: "Barrio",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
  },
  {
    step: "activos",
    key: "tieneVivienda",
    label: "¿Tiene vivienda propia?",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options: "si, no",
  },
  {
    step: "activos",
    key: "tieneVehiculo",
    label: "¿Tiene vehículo?",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options: "si, no",
  },
  {
    step: "activos",
    key: "placaVehiculo",
    label: "Placa del vehículo",
    type: "string",
    required: "Condicional",
    apiLocation: "datos",
    validation: 'Obligatorio si tieneVehiculo = "si". Mín. 5 chars, mayúsculas.',
  },
  {
    step: "laboral",
    key: "ocupacion",
    label: "Ocupación u oficio",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
  },
  {
    step: "laboral",
    key: "empresa",
    label: "Empresa donde trabaja",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
  },
  {
    step: "laboral",
    key: "cargo",
    label: "Cargo que desempeña",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
  },
  {
    step: "laboral",
    key: "fechaIngreso",
    label: "Fecha de ingreso laboral",
    type: "string (fecha)",
    required: "Sí",
    apiLocation: "datos",
    validation: "YYYY-MM-DD",
  },
  {
    step: "referencia",
    key: "referenciaTipo",
    label: "Tipo de referencia",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options: "familiar, personal",
  },
  {
    step: "referencia",
    key: "referenciaParentesco",
    label: "Parentesco o relación",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    validation: "Opciones distintas si familiar vs personal (ver anexo valores).",
  },
  {
    step: "referencia",
    key: "referenciaParentescoOtro",
    label: "Parentesco (otro)",
    type: "string",
    required: "Condicional",
    apiLocation: "datos",
    validation: 'Si referenciaParentesco = "otro".',
  },
  {
    step: "referencia",
    key: "referenciaFamiliarNombre",
    label: "Nombre de la referencia",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
    validation: "Mín. 3 caracteres.",
  },
  {
    step: "referencia",
    key: "referenciaFamiliarTelefono",
    label: "Teléfono de la referencia",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
    validation: "10 dígitos, inicia en 3.",
  },
  {
    step: "bancarios",
    key: "tipoCuenta",
    label: "Tipo de cuenta",
    type: "string (enum)",
    required: "Sí",
    apiLocation: "datos",
    options: "ahorros, corriente, llave",
  },
  {
    step: "bancarios",
    key: "entidadBancaria",
    label: "Entidad bancaria",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
    validation: "Ej: Bancolombia, Nequi, Daviplata, Davivienda, etc.",
  },
  {
    step: "bancarios",
    key: "numeroCuenta",
    label: "Número de cuenta / llave Bre-B",
    type: "string",
    required: "Sí",
    apiLocation: "datos",
    validation: "Cuenta: mín. 6. Llave: mín. 5 si tipoCuenta=llave.",
  },
  {
    step: "verificacion",
    key: "geolocalizacion",
    label: "Georreferenciación GPS",
    type: "object",
    required: "No",
    apiLocation: "datos",
    validation: '{ "lat": number, "lng": number }',
  },
  {
    step: "verificacion",
    key: "cedulaFrontal",
    label: "Foto cédula frontal",
    type: "object (archivo)",
    required: "Sí",
    apiLocation: "datos",
    validation: "Ver sección adjuntos. Máx. 5 MB.",
  },
  {
    step: "verificacion",
    key: "cedulaReverso",
    label: "Foto cédula reverso",
    type: "object (archivo)",
    required: "Sí",
    apiLocation: "datos",
    validation: "Ver sección adjuntos. Máx. 5 MB.",
  },
  {
    step: "verificacion",
    key: "videoVerificacion",
    label: "Video verificación facial",
    type: "object (archivo)",
    required: "Sí",
    apiLocation: "datos",
    validation: "Ver sección adjuntos. Máx. 15 MB (~3 seg).",
  },
  {
    step: "verificacion",
    key: "aceptaTerminos",
    label: "Acepta hábeas data",
    type: "boolean",
    required: "Sí",
    apiLocation: "raiz+datos",
    validation: "true obligatorio al enviar.",
  },
  {
    step: "verificacion",
    key: "fechaAceptacionTerminos",
    label: "Fecha aceptación términos",
    type: "string (ISO 8601)",
    required: "Recomendado",
    apiLocation: "datos",
    validation: "Ej: 2026-08-28T14:30:00.000Z",
  },
  {
    step: "verificacion",
    key: "firma",
    label: "Firma digital",
    type: "string (base64)",
    required: "Sí",
    apiLocation: "datos",
    validation: "Imagen de la firma. Máx. ~2 MB. Solo tras aceptar términos.",
  },
];

function p(text) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, size: 21 })],
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 200, after: 100 }, children: [new TextRun(text)] });
}

function cell(text, bold = false) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold, size: 17 })] })],
  });
}

function fieldsTable(fields) {
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell("Campo (nombre técnico)", true),
      cell("Etiqueta en pantalla", true),
      cell("Tipo de dato", true),
      cell("Obligatorio", true),
      cell("Validación / notas", true),
      cell("Valores permitidos", true),
    ],
  });
  const rows = fields.map(
    (f) =>
      new TableRow({
        children: [
          cell(f.key),
          cell(f.label),
          cell(f.type),
          cell(f.required),
          cell(f.validation || "—"),
          cell(f.options || "—"),
        ],
      }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] });
}

const children = [
  heading("Formulario Microcrédito Small — Catálogo de campos"),
  heading("Especificación para implementación en Witme", HeadingLevel.HEADING_2),
  p("Coodelsur SAS · Documento de referencia para Witme"),
  p(`Fecha: ${new Date().toLocaleDateString("es-CO", { dateStyle: "long" })}`),

  heading("1. Objetivo de este documento", HeadingLevel.HEADING_2),
  p(
    "Witme implementará en su plataforma el mismo formulario de solicitud de Microcrédito Small que usa Coodelsur. Este documento describe todos los campos, cuáles son obligatorios u opcionales, validaciones y valores de listas desplegables.",
  ),
  p(
    "Nota: la conexión técnica (API) para enviar las solicitudes al panel de administración de Coodelsur se definirá en una fase posterior, una vez desplegada la aplicación. Por ahora Witme solo necesita replicar el formulario según esta especificación.",
  ),
  p("Convención de nombres técnicos: camelCase (ej. capitalSeleccionado, fechaNacimiento)."),

  heading("2. Resumen del producto", HeadingLevel.HEADING_2),
  p("Producto: Microcrédito Small (tipoCredito = microcredito_small)"),
  p("Monto solicitado: $200.000 – $600.000 COP"),
  p("Plazos: 1, 2 o 3 cuotas"),
  p("Formulario dividido en 8 pasos (secciones)"),
  p("Tasa mensual: 2,1% · Estudio de crédito: $30.000 · Fianza: 12,5% mensual sobre el capital"),
  p("Fecha de pago oportuno: 30 días después del desembolso (el usuario no la elige)"),

  heading("3. Campos por paso del formulario", HeadingLevel.HEADING_2),
  p("Obligatorio: Sí = requerido para enviar · No = opcional · Condicional = depende de otra respuesta."),
];

for (const step of STEPS) {
  const stepFields = FIELDS.filter((f) => f.step === step.id);
  children.push(heading(`Paso ${step.n} — ${step.title}`, HeadingLevel.HEADING_3));
  children.push(fieldsTable(stepFields));
}

const apiFields = FIELDS.filter((f) => f.step === "api");
children.push(heading("Campo de producto", HeadingLevel.HEADING_3));
children.push(fieldsTable(apiFields));

children.push(
  heading("4. Reglas condicionales", HeadingLevel.HEADING_2),
  p('• Si tieneVehiculo = "si" → placaVehiculo es obligatorio (mín. 5 caracteres, mayúsculas).'),
  p('• Si referenciaParentesco = "otro" → referenciaParentescoOtro es obligatorio.'),
  p("• Si el usuario declara otros ingresos (origen o monto), deben completarse origenOtrosIngresos y otrosIngresos."),
  p('• Si origenOtrosIngresos = "otro" → origenOtrosIngresosOtro es obligatorio.'),
  p('• Si tipoCuenta = "llave" (Bre-B) → numeroCuenta mín. 5 caracteres; si es cuenta bancaria → mín. 6.'),
  p("• La firma solo se habilita después de aceptar términos y hábeas data (aceptaTerminos = true)."),

  heading("5. Adjuntos y capturas", HeadingLevel.HEADING_2),
  p("Paso 8 — Verificación. Todos obligatorios para enviar la solicitud:"),
  p("• cedulaFrontal: foto frontal de la cédula (imagen, máx. 5 MB)"),
  p("• cedulaReverso: foto reverso de la cédula (imagen, máx. 5 MB)"),
  p("• videoVerificacion: video corto del rostro (~3 segundos, máx. 15 MB)"),
  p("• firma: firma digital del solicitante (imagen, máx. ~2 MB)"),
  p("• geolocalizacion: opcional — coordenadas GPS { lat, lng } si el dispositivo lo permite"),

  heading("6. Campos calculados (no los diligencia el usuario)", HeadingLevel.HEADING_2),
  p("El sistema calcula automáticamente según capital y cuotas:"),
  p("valorCuota, valorCreditoFinanciado, estudioCredito, cuotaCapitalInteres, cuotaFianzaMensual, cuotaVidaDeudoresMensual"),
  p("Witme puede calcularlos con la misma lógica o mostrarlos como solo lectura tras elegir monto y plazo."),

  heading("7. Anexo — valores de listas desplegables", HeadingLevel.HEADING_2),
  p("tipoIdentificacion: CC, CE, TI, NIT, PAS, PPT"),
  p("genero: masculino, femenino, otro, no_decir"),
  p("estadoCivil: soltero, casado, union_libre, separado, viudo"),
  p("estrato: 1, 2, 3, 4, 5, 6"),
  p("sectorDomicilio: urbano, rural"),
  p("tieneVivienda / tieneVehiculo / moraVigente: si, no"),
  p("cantidadCuotas: 1, 2, 3"),
  p("referenciaTipo: familiar, personal"),
  p("referenciaParentesco (si familiar): padre, madre, hijo, hermano, conyuge, tio, primo, abuelo, suegro, cunado, otro"),
  p("referenciaParentesco (si personal): amigo, companero_trabajo, vecino, conocido, otro"),
  p("tipoCuenta: ahorros, corriente, llave"),
  p("destinoCredito: capital_trabajo, mercancia, equipos_herramientas, gastos_negocio, gastos_personales, salud, educacion, transporte, otro"),
  p("origenOtrosIngresos: arriendos, negocio_propio, pension, apoyo_familiar, remesas, freelance, dividendos_intereses, otro"),
  p("entidadBancaria: Bancolombia, Nequi, Daviplata, Davivienda, Banco de Bogotá, BBVA, y otras entidades colombianas."),

  heading("8. Próximos pasos (fase API — pendiente)", HeadingLevel.HEADING_2),
  p("Cuando Coodelsur despliegue la aplicación, se compartirá con Witme:"),
  p("• URL del endpoint para recibir solicitudes"),
  p("• Credenciales de autenticación"),
  p("• Formato exacto del JSON de envío"),
  p("Por ahora, Witme debe enfocarse en implementar el formulario según las tablas de este documento."),
);

const doc = new Document({
  creator: "Coodelsur",
  title: "Formulario Microcrédito Small — Campos para Witme",
  description: "Catálogo de campos obligatorios y opcionales del formulario Small",
  sections: [{ properties: {}, children }],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log("Generado:", OUT);
