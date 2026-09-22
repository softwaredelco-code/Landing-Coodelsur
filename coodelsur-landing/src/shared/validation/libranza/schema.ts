/**
 * Schema Zod, pasos y validaciones cruzadas del Crédito Libranza.
 *
 * 11 pasos: Datos personales, Info crédito, Fecha pago, Centrales riesgo,
 * Info laboral, Info financiera, Vivienda, Vehículo, Referencia, Bancaria,
 * Autorizaciones.
 */
import { z } from "zod";
import { isCelularColombia } from "@/shared/utils";
import { validateLocalIdentity } from "@/domain/identity/cedula-local";
import type { GeoCoords } from "@/shared/types/credito";

/* ─── helpers ──────────────────────────────────────────────── */

const requiredText = (label: string, min = 1) =>
  z.preprocess(
    (val) => (val == null ? "" : String(val)),
    z
      .string({ required_error: `${label} es requerido` })
      .trim()
      .min(min, `${label} es requerido`),
  );

const optionalText = z.preprocess(
  (val) => (val == null ? "" : String(val)),
  z.string().trim().optional(),
);

const optionalNumber = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
  z
    .number({ invalid_type_error: "Debe ser un número" })
    .min(0, "No puede ser negativo")
    .optional(),
);

const requiredMoney = (label: string) =>
  z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z
      .number({
        required_error: `${label} es requerido`,
        invalid_type_error: "Ingresa un valor numérico",
      })
      .positive("Debe ser mayor a 0"),
  );

const requiredInt = (label: string, min = 0) =>
  z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z
      .number({
        required_error: `${label} es requerido`,
        invalid_type_error: "Ingresa un número",
      })
      .int("Debe ser un número entero")
      .min(min, min === 0 ? "No puede ser negativo" : `Debe ser al menos ${min}`),
  );

function requiredFile(message: string) {
  return z.object(
    {
      fileName: z.string().min(1),
      mimeType: z.string(),
      size: z.number().nonnegative(),
      preview: z.string().min(1),
    },
    { required_error: message, invalid_type_error: message },
  );
}

const geoCoordsSchema: z.ZodType<GeoCoords> = z.object({
  lat: z.number(),
  lng: z.number(),
});

/* ─── Rangos libranza ──────────────────────────────────────── */
const LIBRANZA_MIN = 700_000;
const LIBRANZA_MAX = 20_000_000;
const LIBRANZA_MIN_CUOTAS = 6;
const LIBRANZA_MAX_CUOTAS = 36;

/* ─── Schema base ──────────────────────────────────────────── */

const libranzaBaseSchema = z.object({
  tipoCredito: z.literal("libranza"),

  /* ── 1. Datos personales ─────────────────────────────────── */
  nombre: requiredText("Nombres y apellidos", 3),
  email: z
    .string({ required_error: "El e-mail es requerido" })
    .trim()
    .min(1, "El e-mail es requerido")
    .email("Ingresa un correo electrónico válido"),
  tipoIdentificacion: requiredText("Tipo de identificación"),
  cedula: z.preprocess(
    (val) => String(val ?? "").trim(),
    z
      .string({ required_error: "El número de identificación es requerido" })
      .min(1, "El número de identificación es requerido"),
  ),
  telefono: z
    .string({ required_error: "El teléfono celular es requerido" })
    .min(1, "El teléfono celular es requerido")
    .refine(isCelularColombia, "Ingresa un celular colombiano válido (10 dígitos, inicia en 3)"),
  genero: requiredText("Género"),
  estadoCivil: requiredText("Estado civil"),
  fechaNacimiento: requiredText("Fecha de nacimiento").refine(
    (val) => {
      if (!val) return true;
      const todayStr = new Date().toISOString().split("T")[0];
      if (val > todayStr) return false;

      const parts = val.split("-");
      if (parts.length !== 3) return false;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);

      const today = new Date();
      let age = today.getFullYear() - year;
      const m = today.getMonth() - month;
      if (m < 0 || (m === 0 && today.getDate() < day)) {
        age--;
      }
      return age >= 18;
    },
    "Debes ser mayor de edad (mínimo 18 años)",
  ),
  fechaExpedicion: requiredText("Fecha de expedición del documento").refine(
    (val) => {
      if (!val) return true;
      const todayStr = new Date().toISOString().split("T")[0];
      return val <= todayStr;
    },
    "La fecha no puede estar en el futuro",
  ),
  departamento: requiredText("Departamento"),
  municipio: requiredText("Municipio"),
  direccion: requiredText("Dirección", 5),
  barrio: requiredText("Barrio"),
  ciudad: requiredText("Ciudad"),
  estrato: requiredText("Estrato"),
  nivelEducacion: requiredText("Nivel de educación"),
  profesion: requiredText("Profesión"),
  nombreConyuge: optionalText,

  /* ── 2. Información del crédito ──────────────────────────── */
  capitalSeleccionado: requiredMoney("Capital seleccionado").refine(
    (value) => value >= LIBRANZA_MIN && value <= LIBRANZA_MAX,
    {
      message: `El Crédito Libranza admite montos entre $${LIBRANZA_MIN.toLocaleString("es-CO")} y $${LIBRANZA_MAX.toLocaleString("es-CO")}`,
    },
  ),
  cantidadCuotas: requiredInt("Cantidad de cuotas", LIBRANZA_MIN_CUOTAS).refine(
    (value) => value >= LIBRANZA_MIN_CUOTAS && value <= LIBRANZA_MAX_CUOTAS,
    {
      message: `Las cuotas deben estar entre ${LIBRANZA_MIN_CUOTAS} y ${LIBRANZA_MAX_CUOTAS}`,
    },
  ),
  /** Placeholder — cálculo de amortización pendiente de definir para Libranza. */
  valorCuota: optionalNumber,
  destinoCredito: requiredText("Destino del crédito"),

  /* ── 3. Fecha de pago oportuno ───────────────────────────── */
  diaPagoOportuno: requiredText("Día de pago oportuno"),
  mesPagoOportuno: requiredText("Mes de pago oportuno"),
  anoPagoOportuno: requiredText("Año de pago oportuno"),

  /* ── 4. Centrales de riesgo ──────────────────────────────── */
  moraVigente: requiredText("Indica si tienes mora vigente"),

  /* ── 5. Información laboral ──────────────────────────────── */
  actividadEconomica: requiredText("Actividad económica"),
  empresaLaboral: requiredText("Nombre de la empresa"),
  tieneConvenioVigente: requiredText("Indica si tiene convenio vigente"),
  cargoLaboral: requiredText("Cargo"),
  tipoContrato: requiredText("Tipo de contrato"),
  fechaIngresoLaboral: requiredText("Fecha de ingreso"),
  direccionLaboral: requiredText("Dirección laboral", 5),
  barrioLaboral: requiredText("Barrio laboral"),
  ciudadLaboral: requiredText("Ciudad laboral"),
  telefonoLaboral: z
    .string({ required_error: "El teléfono laboral es requerido" })
    .min(1, "El teléfono laboral es requerido"),

  /* ── 6. Información financiera ───────────────────────────── */
  ingresosMensuales: requiredMoney("Ingresos mensuales"),
  otrosIngresos: optionalNumber,
  egresosMensuales: requiredMoney("Egresos mensuales"),
  activosTotales: requiredMoney("Activos totales"),
  pasivosTotales: optionalNumber,
  personasACargo: requiredInt("Número de personas a cargo", 0),

  /* ── 7. Vivienda ─────────────────────────────────────────── */
  tieneVivienda: requiredText("Indica si tienes vivienda"),
  viviendaANombreCliente: optionalText,
  direccionVivienda: optionalText,

  /* ── 8. Vehículo ─────────────────────────────────────────── */
  tieneVehiculo: requiredText("Indica si tienes vehículo"),
  vehiculoANombreCliente: optionalText,
  placaVehiculo: optionalText,

  /* ── 9. Referencia familiar ──────────────────────────────── */
  referenciaFamiliarNombre: requiredText("Nombre de la referencia", 3),
  referenciaFamiliarTelefono: z
    .string({ required_error: "El teléfono de la referencia es requerido" })
    .min(1, "El teléfono de la referencia es requerido")
    .refine(isCelularColombia, "Ingresa un celular colombiano válido (10 dígitos, inicia en 3)"),

  /* ── 10. Información bancaria ────────────────────────────── */
  tipoCuenta: requiredText("Tipo de cuenta"),
  entidadBancaria: requiredText("Entidad bancaria"),
  numeroCuenta: requiredText("Número de cuenta", 1),

  /* ── 11. Autorizaciones ──────────────────────────────────── */
  geolocalizacion: geoCoordsSchema.optional(),
  cedulaFrontal: requiredFile("La foto frontal de la cédula es requerida"),
  cedulaReverso: requiredFile("La foto del reverso de la cédula es requerida"),
  videoVerificacion: requiredFile("El video de verificación es requerido"),
  aceptaTerminos: z
    .boolean({
      required_error: "Debes aceptar la autorización de hábeas data",
      invalid_type_error: "Debes aceptar la autorización de hábeas data",
    })
    .refine((value) => value === true, {
      message: "Debes leer y aceptar la autorización de hábeas data para continuar",
    }),
  fechaAceptacionTerminos: z.string().optional(),
  firma: z.string().min(1, "La firma es requerida para confirmar tu aceptación"),
});

/* ─── Tipos ────────────────────────────────────────────────── */

export type LibranzaFormValues = z.infer<typeof libranzaBaseSchema>;

export type StepFieldError = {
  path: keyof LibranzaFormValues;
  message: string;
};

/* ─── Reglas cruzadas ──────────────────────────────────────── */

export function collectCrossFieldErrors(data: LibranzaFormValues): StepFieldError[] {
  const errors: StepFieldError[] = [];

  // Validación de identidad local (cédula)
  const validation = validateLocalIdentity({
    documentType: data.tipoIdentificacion,
    documentNumber: data.cedula,
    nombre: data.nombre,
    fechaNacimiento: data.fechaNacimiento,
    fechaExpedicion: data.fechaExpedicion,
  });

  if (!validation.ok) {
    for (const message of validation.messages) {
      errors.push({ path: "cedula", message });
    }
  }

  // Si tiene vivienda a nombre del cliente → dirección obligatoria
  if (data.tieneVivienda === "si" && data.viviendaANombreCliente === "si") {
    const dir = (data.direccionVivienda ?? "").trim();
    if (!dir) {
      errors.push({
        path: "direccionVivienda",
        message: "Ingresa la dirección de la vivienda",
      });
    }
  }

  // Si tiene vehículo a nombre del cliente → placa obligatoria
  if (data.tieneVehiculo === "si" && data.vehiculoANombreCliente === "si") {
    const placa = (data.placaVehiculo ?? "").trim().toUpperCase();
    if (!placa) {
      errors.push({ path: "placaVehiculo", message: "Ingresa la placa del vehículo" });
    } else if (placa.length < 5) {
      errors.push({
        path: "placaVehiculo",
        message: "Ingresa una placa válida (mínimo 5 caracteres)",
      });
    }
  }

  // Número de cuenta mínimo
  const cuentaOLlave = data.numeroCuenta?.trim() ?? "";
  if (data.tipoCuenta === "llave") {
    if (cuentaOLlave.length < 5) {
      errors.push({
        path: "numeroCuenta",
        message: "Ingresa tu llave bancaria (celular, cédula, correo o código)",
      });
    }
  } else if (data.tipoCuenta && cuentaOLlave.length < 6) {
    errors.push({
      path: "numeroCuenta",
      message: "Ingresa un número de cuenta válido (mínimo 6 dígitos)",
    });
  }

  return errors;
}

/* ─── Schema con superRefine ───────────────────────────────── */

export const libranzaSchema = libranzaBaseSchema.superRefine((data, ctx) => {
  for (const error of collectCrossFieldErrors(data)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error.message,
      path: [error.path],
    });
  }
});

/* ─── Pasos ────────────────────────────────────────────────── */

export const LIBRANZA_STEPS = [
  {
    id: "personal",
    title: "Datos personales",
    description: "Cuéntanos quién eres para iniciar tu solicitud.",
    fields: [
      "nombre",
      "email",
      "tipoIdentificacion",
      "cedula",
      "telefono",
      "genero",
      "estadoCivil",
      "fechaNacimiento",
      "fechaExpedicion",
      "departamento",
      "municipio",
      "direccion",
      "barrio",
      "ciudad",
      "estrato",
      "nivelEducacion",
      "profesion",
      "nombreConyuge",
    ],
  },
  {
    id: "credito",
    title: "Información del crédito",
    description: "Define el monto, las cuotas y el destino del crédito Libranza.",
    fields: [
      "capitalSeleccionado",
      "cantidadCuotas",
      "valorCuota",
      "destinoCredito",
    ],
  },
  {
    id: "fechaPago",
    title: "Fecha de pago oportuno",
    description: "Depende del acuerdo con la entidad pagadora.",
    fields: [
      "diaPagoOportuno",
      "mesPagoOportuno",
      "anoPagoOportuno",
    ],
  },
  {
    id: "centralesRiesgo",
    title: "Centrales de riesgo",
    description: "Información sobre tu historial crediticio.",
    fields: ["moraVigente"],
  },
  {
    id: "laboral",
    title: "Información laboral",
    description: "Datos de tu empleo actual.",
    fields: [
      "actividadEconomica",
      "empresaLaboral",
      "tieneConvenioVigente",
      "cargoLaboral",
      "tipoContrato",
      "fechaIngresoLaboral",
      "direccionLaboral",
      "barrioLaboral",
      "ciudadLaboral",
      "telefonoLaboral",
    ],
  },
  {
    id: "financiera",
    title: "Información financiera",
    description: "Detalle de tus ingresos, egresos y patrimonio.",
    fields: [
      "ingresosMensuales",
      "otrosIngresos",
      "egresosMensuales",
      "activosTotales",
      "pasivosTotales",
      "personasACargo",
    ],
  },
  {
    id: "vivienda",
    title: "Vivienda",
    description: "¿Tienes vivienda propia?",
    fields: ["tieneVivienda", "viviendaANombreCliente", "direccionVivienda"],
  },
  {
    id: "vehiculo",
    title: "Vehículo",
    description: "¿Tienes vehículo propio?",
    fields: ["tieneVehiculo", "vehiculoANombreCliente", "placaVehiculo"],
  },
  {
    id: "referencia",
    title: "Referencia familiar",
    description: "Una persona a quien podamos contactar.",
    fields: ["referenciaFamiliarNombre", "referenciaFamiliarTelefono"],
  },
  {
    id: "bancarios",
    title: "Información bancaria",
    description: "Cuenta donde se desembolsaría el crédito.",
    fields: ["tipoCuenta", "entidadBancaria", "numeroCuenta"],
  },
  {
    id: "autorizaciones",
    title: "Autorizaciones y validaciones",
    description: "Documentos, georreferenciación, aceptación de términos y firma.",
    fields: [
      "geolocalizacion",
      "cedulaFrontal",
      "cedulaReverso",
      "videoVerificacion",
      "aceptaTerminos",
      "firma",
    ],
  },
] as const;

export type LibranzaStepId = (typeof LIBRANZA_STEPS)[number]["id"];

/** Reglas cruzadas filtradas al paso actual. */
export function collectStepCrossFieldErrors(
  stepId: LibranzaStepId,
  data: LibranzaFormValues,
): StepFieldError[] {
  const step = LIBRANZA_STEPS.find((s) => s.id === stepId);
  if (!step) return [];

  const fields = new Set<string>(step.fields);
  return collectCrossFieldErrors(data).filter((error) => fields.has(error.path));
}

/* ─── Valores por defecto ──────────────────────────────────── */

export const libranzaDefaultValues: Partial<LibranzaFormValues> = {
  tipoCredito: "libranza",
  nombre: "",
  email: "",
  tipoIdentificacion: "",
  cedula: "",
  telefono: "",
  genero: "",
  estadoCivil: "",
  fechaNacimiento: "",
  fechaExpedicion: "",
  departamento: "",
  municipio: "",
  direccion: "",
  barrio: "",
  ciudad: "",
  estrato: "",
  nivelEducacion: "",
  profesion: "",
  nombreConyuge: "",

  capitalSeleccionado: LIBRANZA_MIN,
  cantidadCuotas: LIBRANZA_MIN_CUOTAS,
  valorCuota: undefined,
  destinoCredito: "",

  diaPagoOportuno: "",
  mesPagoOportuno: "",
  anoPagoOportuno: String(new Date().getFullYear()),

  moraVigente: "",

  actividadEconomica: "",
  empresaLaboral: "",
  tieneConvenioVigente: "",
  cargoLaboral: "",
  tipoContrato: "",
  fechaIngresoLaboral: "",
  direccionLaboral: "",
  barrioLaboral: "",
  ciudadLaboral: "",
  telefonoLaboral: "",

  ingresosMensuales: undefined,
  otrosIngresos: undefined,
  egresosMensuales: undefined,
  activosTotales: undefined,
  pasivosTotales: undefined,
  personasACargo: 0,

  tieneVivienda: "",
  viviendaANombreCliente: "",
  direccionVivienda: "",

  tieneVehiculo: "",
  vehiculoANombreCliente: "",
  placaVehiculo: "",

  referenciaFamiliarNombre: "",
  referenciaFamiliarTelefono: "",

  tipoCuenta: "",
  entidadBancaria: "",
  numeroCuenta: "",

  aceptaTerminos: false,
  fechaAceptacionTerminos: "",
  firma: "",
};

/** Omitir base64 de preview en logs para no contaminar consola. */
export function sanitizeLibranzaForLog(data: LibranzaFormValues) {
  return {
    ...data,
    cedulaFrontal: data.cedulaFrontal
      ? { fileName: data.cedulaFrontal.fileName, mimeType: data.cedulaFrontal.mimeType, size: data.cedulaFrontal.size }
      : null,
    cedulaReverso: data.cedulaReverso
      ? { fileName: data.cedulaReverso.fileName, mimeType: data.cedulaReverso.mimeType, size: data.cedulaReverso.size }
      : null,
    videoVerificacion: data.videoVerificacion
      ? {
          fileName: data.videoVerificacion.fileName,
          mimeType: data.videoVerificacion.mimeType,
          size: data.videoVerificacion.size,
        }
      : null,
    firma: data.firma ? "[firma capturada]" : null,
    aceptaTerminos: data.aceptaTerminos,
    fechaAceptacionTerminos: data.fechaAceptacionTerminos || null,
  };
}
