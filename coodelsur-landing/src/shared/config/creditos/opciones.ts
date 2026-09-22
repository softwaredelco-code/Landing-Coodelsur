export const TIPOS_IDENTIFICACION = [
  { label: "Cédula de ciudadanía (CC)", value: "CC" },
  { label: "Cédula de extranjería (CE)", value: "CE" },
  { label: "Tarjeta de identidad (TI)", value: "TI" },
  { label: "NIT", value: "NIT" },
  { label: "Pasaporte", value: "PAS" },
  { label: "Permiso por Protección Temporal (PPT)", value: "PPT" },
];

export const GENEROS = [
  { label: "Masculino", value: "masculino" },
  { label: "Femenino", value: "femenino" },
  { label: "Otro", value: "otro" },
  { label: "Prefiero no decir", value: "no_decir" },
];

export const ESTADOS_CIVILES = [
  { label: "Soltero/a", value: "soltero" },
  { label: "Casado/a", value: "casado" },
  { label: "Unión libre", value: "union_libre" },
  { label: "Separado/a", value: "separado" },
  { label: "Viudo/a", value: "viudo" },
];

export const SI_NO = [
  { label: "Sí", value: "si" },
  { label: "No", value: "no" },
];

export const SECTORES_DOMICILIO = [
  { label: "Urbano", value: "urbano" },
  { label: "Rural", value: "rural" },
];

export const TIPOS_REFERENCIA = [
  { label: "Familiar", value: "familiar" },
  { label: "Personal", value: "personal" },
];

export const PARENTESCOS_REFERENCIA_FAMILIAR = [
  { label: "Padre", value: "padre" },
  { label: "Madre", value: "madre" },
  { label: "Hijo/a", value: "hijo" },
  { label: "Hermano/a", value: "hermano" },
  { label: "Cónyuge o pareja", value: "conyuge" },
  { label: "Tío/a", value: "tio" },
  { label: "Primo/a", value: "primo" },
  { label: "Abuelo/a", value: "abuelo" },
  { label: "Suegro/a", value: "suegro" },
  { label: "Cuñado/a", value: "cunado" },
  { label: "Otro", value: "otro" },
];

export const PARENTESCOS_REFERENCIA_PERSONAL = [
  { label: "Amigo/a", value: "amigo" },
  { label: "Compañero/a de trabajo", value: "companero_trabajo" },
  { label: "Vecino/a", value: "vecino" },
  { label: "Conocido/a", value: "conocido" },
  { label: "Otro", value: "otro" },
];

export function opcionesParentescoReferencia(tipoReferencia: string) {
  return tipoReferencia === "personal"
    ? PARENTESCOS_REFERENCIA_PERSONAL
    : PARENTESCOS_REFERENCIA_FAMILIAR;
}

export const ESTRATOS = [
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
];

export const TIPOS_CUENTA = [
  { label: "Ahorros", value: "ahorros" },
  { label: "Corriente", value: "corriente" },
  { label: "Llave bancaria (Bre-B)", value: "llave" },
];

/** Destinos del crédito para Microcrédito Small ($200.000 – $600.000). */
export const DESTINOS_CREDITO = [
  { label: "Capital de trabajo", value: "capital_trabajo" },
  { label: "Compra de mercancía o insumos", value: "mercancia" },
  { label: "Compra de equipos o herramientas", value: "equipos_herramientas" },
  { label: "Gastos operativos del negocio", value: "gastos_negocio" },
  { label: "Gastos personales o familiares", value: "gastos_personales" },
  { label: "Salud o medicamentos", value: "salud" },
  { label: "Educación o capacitación", value: "educacion" },
  { label: "Transporte o movilidad", value: "transporte" },
  { label: "Otro", value: "otro" },
];

export const ORIGENES_OTROS_INGRESOS = [
  { label: "Arriendos", value: "arriendos" },
  { label: "Negocio propio o ventas informales", value: "negocio_propio" },
  { label: "Pensión o mesada pensional", value: "pension" },
  { label: "Apoyo económico familiar", value: "apoyo_familiar" },
  { label: "Remesas del exterior", value: "remesas" },
  { label: "Trabajo freelance u honorarios", value: "freelance" },
  { label: "Dividendos o intereses", value: "dividendos_intereses" },
  { label: "Otro", value: "otro" },
];

export const CANTIDAD_CUOTAS = [4, 6, 8, 10, 12, 18, 24, 36].map((n) => ({
  label: `${n} cuotas`,
  value: String(n),
}));

export const DIAS_PAGO = Array.from({ length: 28 }, (_, i) => ({
  label: String(i + 1),
  value: String(i + 1),
}));

export const MESES = [
  { label: "Enero", value: "1" },
  { label: "Febrero", value: "2" },
  { label: "Marzo", value: "3" },
  { label: "Abril", value: "4" },
  { label: "Mayo", value: "5" },
  { label: "Junio", value: "6" },
  { label: "Julio", value: "7" },
  { label: "Agosto", value: "8" },
  { label: "Septiembre", value: "9" },
  { label: "Octubre", value: "10" },
  { label: "Noviembre", value: "11" },
  { label: "Diciembre", value: "12" },
];

export const ANOS_PAGO = Array.from({ length: 10 }, (_, i) => {
  const year = new Date().getFullYear() + i;
  return { label: String(year), value: String(year) };
});

/* ─── Opciones específicas Libranza ────────────────────────── */

export const TIPOS_IDENTIFICACION_LIBRANZA = [
  { label: "Cédula de ciudadanía (CC)", value: "CC" },
  { label: "Cédula de extranjería (CE)", value: "CE" },
];

export const NIVELES_EDUCACION = [
  { label: "Primaria", value: "primaria" },
  { label: "Secundaria", value: "secundaria" },
  { label: "Técnico", value: "tecnico" },
  { label: "Tecnólogo", value: "tecnologo" },
  { label: "Profesional", value: "profesional" },
  { label: "Especialización", value: "especializacion" },
  { label: "Maestría", value: "maestria" },
  { label: "Doctorado", value: "doctorado" },
  { label: "Ninguno", value: "ninguno" },
];

export const TIPOS_CONTRATO = [
  { label: "Término indefinido", value: "indefinido" },
  { label: "Término fijo", value: "fijo" },
  { label: "Prestación de servicios", value: "prestacion_servicios" },
  { label: "Obra o labor", value: "obra_labor" },
  { label: "Contrato de aprendizaje", value: "aprendizaje" },
  { label: "Otro", value: "otro" },
];

export const DIAS_PAGO_LIBRANZA = [
  { label: "5", value: "5" },
  { label: "15", value: "15" },
  { label: "30", value: "30" },
];

export const SI_NO_NOSE = [
  { label: "Sí", value: "si" },
  { label: "No", value: "no" },
  { label: "No sé", value: "no_se" },
];

export const CUOTAS_LIBRANZA = Array.from({ length: 31 }, (_, i) => ({
  label: `${i + 6} cuotas`,
  value: String(i + 6),
}));

/**
 * @deprecated Preferir rangos por producto en `config/creditos/montos.ts`.
 * Se mantienen aliases para no romper imports legacy del nanocrédito.
 */
export {
  MONTO_SELECTOR_MIN as CAPITAL_MIN,
  MONTO_SELECTOR_MAX as CAPITAL_MAX,
  MONTO_SELECTOR_STEP as CAPITAL_STEP,
} from "./montos";

