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
];

export const DESTINOS_CREDITO = [
  { label: "Capital de trabajo", value: "capital_trabajo" },
  { label: "Compra de mercancía", value: "mercancia" },
  { label: "Gastos personales", value: "gastos_personales" },
  { label: "Educación", value: "educacion" },
  { label: "Salud", value: "salud" },
  { label: "Mejoras de vivienda", value: "vivienda" },
  { label: "Consolidación de deudas", value: "deudas" },
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

/**
 * @deprecated Preferir rangos por producto en `config/creditos/montos.ts`.
 * Se mantienen aliases para no romper imports legacy del nanocrédito.
 */
export {
  MONTO_SELECTOR_MIN as CAPITAL_MIN,
  MONTO_SELECTOR_MAX as CAPITAL_MAX,
  MONTO_SELECTOR_STEP as CAPITAL_STEP,
} from "./montos";

