/**
 * Schema Zod, pasos y validaciones cruzadas del Microcrédito Small.
 *
 * `nanocreditoSchema` valida el envío final; `collectCrossFieldErrors` aplica
 * reglas condicionales (placa si hay vehículo, parentesco, identidad local, etc.).
 *
 * @see docs/FORMULARIO.md — descripción funcional de cada paso
 */
import { z } from "zod";
import { getParametrosAmortizacion } from "@/shared/config/creditos/amortizacion";
import { getRangoPorTipo } from "@/shared/config/creditos/montos";
import { calcularDesgloseCuota } from "@/domain/credito/amortizacion";
import { validateLocalIdentity } from "@/domain/identity/cedula-local";
import { isCelularColombia } from "@/shared/utils";
import type { GeoCoords } from "@/shared/types/credito";

const smallRango = getRangoPorTipo("microcredito_small")!;

const requiredText = (label: string, min = 1) =>
  z.preprocess(
    (val) => (val == null ? "" : String(val)),
    z
      .string({ required_error: `${label} es requerido` })
      .trim()
      .min(min, `${label} es requerido`),
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

const nanocreditoBaseSchema = z.object({
  tipoCredito: z.literal("microcredito_small"),

  nombre: requiredText("Nombre y apellido", 3),
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
  fechaNacimiento: requiredText("Fecha de nacimiento"),
  fechaExpedicion: requiredText("Fecha de expedición del documento"),
  personasACargo: requiredInt("Número de personas a cargo", 0),
  estrato: requiredText("Estrato"),

  capitalSeleccionado: requiredMoney("Capital seleccionado").refine(
    (value) => value >= smallRango.min && value <= smallRango.max,
    {
      message: `El Microcrédito Small admite montos entre $${smallRango.min.toLocaleString("es-CO")} y $${smallRango.max.toLocaleString("es-CO")}`,
    },
  ),
  cantidadCuotas: requiredInt("Cantidad de cuotas", 1),
  valorCuota: requiredMoney("Valor de cuota"),
  valorCreditoFinanciado: optionalNumber,
  estudioCredito: optionalNumber,
  cuotaCapitalInteres: optionalNumber,
  cuotaFianzaMensual: optionalNumber,
  cuotaVidaDeudoresMensual: optionalNumber,
  destinoCredito: requiredText("Destino del crédito"),
  /** Microcrédito Small: pago oportuno 30 días después del desembolso (no lo elige el cliente). */
  fechaPagoOportunoModo: z.literal("30_dias_despues_desembolso").default("30_dias_despues_desembolso"),
  moraVigente: requiredText("Indica si tienes mora vigente"),
  ingresosMensuales: requiredMoney("Ingresos mensuales"),
  origenOtrosIngresos: z.preprocess(
    (val) => (val == null ? "" : String(val)),
    z.string().trim().optional(),
  ),
  origenOtrosIngresosOtro: z.preprocess(
    (val) => (val == null ? "" : String(val)),
    z.string().trim().optional(),
  ),
  otrosIngresos: optionalNumber,

  departamento: requiredText("Departamento"),
  municipio: requiredText("Municipio"),
  sectorDomicilio: requiredText("Sector del domicilio"),
  direccion: requiredText("Dirección", 5),
  barrio: requiredText("Barrio"),

  tieneVivienda: requiredText("Indica si tienes vivienda"),
  tieneVehiculo: requiredText("Indica si tienes vehículo"),
  placaVehiculo: z.preprocess(
    (val) => (val == null ? "" : String(val)),
    z.string().trim().optional(),
  ),

  ocupacion: requiredText("Ocupación u oficio"),
  empresa: requiredText("Empresa donde trabaja"),
  cargo: requiredText("Cargo que desempeña"),
  fechaIngreso: requiredText("Fecha de ingreso"),

  referenciaTipo: requiredText("Indica si la referencia es familiar o personal"),
  referenciaParentesco: requiredText("Indica el parentesco o relación"),
  referenciaParentescoOtro: z.preprocess(
    (val) => (val == null ? "" : String(val)),
    z.string().trim().optional(),
  ),
  referenciaFamiliarNombre: requiredText("Nombre de la referencia", 3),
  referenciaFamiliarTelefono: z
    .string({ required_error: "El teléfono de la referencia es requerido" })
    .min(1, "El teléfono de la referencia es requerido")
    .refine(isCelularColombia, "Ingresa un celular colombiano válido (10 dígitos, inicia en 3)"),

  tipoCuenta: requiredText("Tipo de cuenta"),
  entidadBancaria: requiredText("Entidad bancaria"),
  numeroCuenta: requiredText("Número de cuenta o llave bancaria", 1),

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

export type NanocreditoFormValues = z.infer<typeof nanocreditoBaseSchema>;

export type StepFieldError = {
  path: keyof NanocreditoFormValues;
  message: string;
};

/** Reglas condicionales (placa, parentesco, llave bancaria, etc.). */
export function collectCrossFieldErrors(data: NanocreditoFormValues): StepFieldError[] {
  const errors: StepFieldError[] = [];

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

  const origenOtros = data.origenOtrosIngresos?.trim() ?? "";
  const origenOtrosOtro = data.origenOtrosIngresosOtro?.trim() ?? "";
  const montoOtros = data.otrosIngresos ?? 0;
  const tieneOrigenOtros = origenOtros.length > 0;
  const tieneMontoOtros = montoOtros > 0;

  if (tieneOrigenOtros || tieneMontoOtros) {
    if (!tieneOrigenOtros) {
      errors.push({
        path: "origenOtrosIngresos",
        message: "Indica de dónde provienen tus otros ingresos",
      });
    }

    if (!tieneMontoOtros) {
      errors.push({
        path: "otrosIngresos",
        message: "Ingresa el valor de tus otros ingresos",
      });
    }

    if (origenOtros === "otro" && !origenOtrosOtro) {
      errors.push({
        path: "origenOtrosIngresosOtro",
        message: "Describe de dónde provienen tus otros ingresos",
      });
    }
  }

  const params = getParametrosAmortizacion(data.tipoCredito);
  const cantidadCuotas = Number(data.cantidadCuotas);
  if (
    !Number.isFinite(cantidadCuotas) ||
    !(params.plazosPermitidos as readonly number[]).includes(cantidadCuotas)
  ) {
    errors.push({
      path: "cantidadCuotas",
      message: "Selecciona un plazo válido para este tipo de crédito",
    });
  }

  const capital = Number(data.capitalSeleccionado);
  if (Number.isFinite(capital) && Number.isFinite(cantidadCuotas) && cantidadCuotas > 0) {
    const desglose = calcularDesgloseCuota(data.tipoCredito, capital, cantidadCuotas);

    if (Math.abs(Number(data.valorCuota) - desglose.valorCuotaTotal) > 1) {
      errors.push({
        path: "valorCuota",
        message:
          "El valor de la cuota no coincide con el cálculo del crédito. Actualiza capital o plazo.",
      });
    }
  }

  if (data.tieneVehiculo === "si") {
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

  const parentescoOtro = data.referenciaParentescoOtro?.trim() ?? "";
  if (data.referenciaParentesco === "otro" && !parentescoOtro) {
    errors.push({
      path: "referenciaParentescoOtro",
      message: "Describe el parentesco o relación con la referencia",
    });
  }

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

export const nanocreditoSchema = nanocreditoBaseSchema.superRefine((data, ctx) => {
  for (const error of collectCrossFieldErrors(data)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error.message,
      path: [error.path],
    });
  }
});

export const NANOCREDITO_STEPS = [
  {
    id: "general",
    title: "Datos generales",
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
      "personasACargo",
      "estrato",
    ],
  },
  {
    id: "credito",
    title: "Datos del crédito",
    description: "Define el monto, las cuotas y el destino del Nanocrédito.",
    fields: [
      "capitalSeleccionado",
      "cantidadCuotas",
      "valorCuota",
      "destinoCredito",
      "moraVigente",
      "ingresosMensuales",
      "origenOtrosIngresos",
      "origenOtrosIngresosOtro",
      "otrosIngresos",
    ],
  },
  {
    id: "domicilio",
    title: "Domicilio",
    description: "¿Dónde vives actualmente?",
    fields: ["departamento", "municipio", "sectorDomicilio", "direccion", "barrio"],
  },
  {
    id: "activos",
    title: "Activos propios",
    description: "Información sobre vivienda y vehículo.",
    fields: ["tieneVivienda", "tieneVehiculo", "placaVehiculo"],
  },
  {
    id: "laboral",
    title: "Información laboral",
    description: "Datos de tu ocupación actual.",
    fields: ["ocupacion", "empresa", "cargo", "fechaIngreso"],
  },
  {
    id: "referencia",
    title: "Referencia personal o familiar",
    description: "Una persona a quien podamos contactar.",
    fields: [
      "referenciaTipo",
      "referenciaParentesco",
      "referenciaParentescoOtro",
      "referenciaFamiliarNombre",
      "referenciaFamiliarTelefono",
    ],
  },
  {
    id: "bancarios",
    title: "Datos bancarios",
    description: "Cuenta donde se desembolsaría el crédito.",
    fields: ["tipoCuenta", "entidadBancaria", "numeroCuenta"],
  },
  {
    id: "verificacion",
    title: "Verificación y autorización",
    description: "Documentos, aceptación de hábeas data y firma de tu solicitud.",
    fields: [
      "cedulaFrontal",
      "cedulaReverso",
      "videoVerificacion",
      "aceptaTerminos",
      "firma",
    ],
  },
] as const;

export type NanocreditoStepId = (typeof NANOCREDITO_STEPS)[number]["id"];

export function collectStepCrossFieldErrors(
  stepId: NanocreditoStepId,
  data: NanocreditoFormValues,
): StepFieldError[] {
  const step = NANOCREDITO_STEPS.find((section) => section.id === stepId);
  if (!step) return [];

  const fields = new Set<string>(step.fields);
  return collectCrossFieldErrors(data).filter((error) => fields.has(error.path));
}

const defaultDesglose = calcularDesgloseCuota("microcredito_small", 400_000, 2);

export const nanocreditoDefaultValues: Partial<NanocreditoFormValues> = {
  tipoCredito: "microcredito_small",
  nombre: "",
  email: "",
  tipoIdentificacion: "",
  cedula: "",
  telefono: "",
  genero: "",
  estadoCivil: "",
  fechaNacimiento: "",
  fechaExpedicion: "",
  estrato: "",
  capitalSeleccionado: 400_000,
  cantidadCuotas: 2,
  valorCuota: defaultDesglose.valorCuotaTotal,
  valorCreditoFinanciado: defaultDesglose.valorCreditoFinanciado,
  estudioCredito: defaultDesglose.estudioCredito,
  cuotaCapitalInteres: defaultDesglose.cuotaCapitalInteres,
  cuotaFianzaMensual: defaultDesglose.fianzaMensual,
  cuotaVidaDeudoresMensual: defaultDesglose.vidaDeudoresMensual,
  destinoCredito: "",
  fechaPagoOportunoModo: "30_dias_despues_desembolso",
  moraVigente: "",
  origenOtrosIngresos: "",
  origenOtrosIngresosOtro: "",
  departamento: "",
  municipio: "",
  sectorDomicilio: "",
  direccion: "",
  barrio: "",
  tieneVivienda: "",
  tieneVehiculo: "",
  placaVehiculo: "",
  ocupacion: "",
  empresa: "",
  cargo: "",
  fechaIngreso: "",
  referenciaTipo: "",
  referenciaParentesco: "",
  referenciaParentescoOtro: "",
  referenciaFamiliarNombre: "",
  referenciaFamiliarTelefono: "",
  tipoCuenta: "",
  entidadBancaria: "",
  numeroCuenta: "",
  aceptaTerminos: false,
  fechaAceptacionTerminos: "",
  firma: "",
};

export function sanitizeNanocreditoForLog(data: NanocreditoFormValues) {
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
