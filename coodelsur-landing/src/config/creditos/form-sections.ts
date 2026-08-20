import type { FormSectionConfig } from "@/types/credito";
import { opcionesBancos } from "@/data/bancos";
import { opcionesDepartamento } from "@/data/colombia";
import {
  ANOS_PAGO,
  CANTIDAD_CUOTAS,
  DESTINOS_CREDITO,
  DIAS_PAGO,
  ESTADOS_CIVILES,
  ESTRATOS,
  GENEROS,
  MESES,
  SI_NO,
  TIPOS_CUENTA,
  TIPOS_IDENTIFICACION,
} from "./opciones";

/**
 * Catálogo de secciones del Microcrédito Small.
 * El formulario visible usa componentes por sección; esta config
 * documenta campos y sirve de base para Consumo, Microcrédito, Comercial y Libranza.
 */
export const formSectionsNanocredito: FormSectionConfig[] = [
  {
    id: "general",
    title: "Datos generales",
    description: "Cuéntanos quién eres para iniciar tu solicitud.",
    defaultOpen: true,
    fields: [
      { name: "nombre", label: "Nombre y apellido", type: "text", required: true, colSpan: 2 },
      { name: "email", label: "E-mail", type: "email", required: true },
      {
        name: "tipoIdentificacion",
        label: "Tipo de identificación",
        type: "select",
        options: TIPOS_IDENTIFICACION,
        required: true,
      },
      { name: "cedula", label: "Número de identificación", type: "text", required: true },
      { name: "telefono", label: "Teléfono celular", type: "tel", required: true },
      { name: "genero", label: "Género", type: "select", options: GENEROS, required: true },
      { name: "estadoCivil", label: "Estado civil", type: "select", options: ESTADOS_CIVILES, required: true },
      { name: "fechaNacimiento", label: "Fecha de nacimiento", type: "date", required: true },
      { name: "fechaExpedicion", label: "Fecha de expedición del documento", type: "date", required: true },
      { name: "personasACargo", label: "Número de personas a cargo", type: "number", required: true },
      { name: "estrato", label: "Estrato", type: "select", options: ESTRATOS, required: true },
    ],
  },
  {
    id: "credito",
    title: "Datos del crédito",
    description: "Define el monto, las cuotas y el destino del Microcrédito Small.",
    fields: [
      { name: "capitalSeleccionado", label: "Capital seleccionado", type: "number", required: true, colSpan: 2 },
      {
        name: "cantidadCuotas",
        label: "Cantidad de cuotas",
        type: "select",
        options: CANTIDAD_CUOTAS,
        required: true,
      },
      { name: "valorCuota", label: "Valor de cuota", type: "number", required: true },
      {
        name: "destinoCredito",
        label: "Destino del crédito",
        type: "select",
        options: DESTINOS_CREDITO,
        required: true,
        colSpan: 2,
      },
      { name: "diaPago", label: "Fecha de pago oportuno — Día", type: "select", options: DIAS_PAGO, required: true },
      { name: "mesPago", label: "Fecha de pago oportuno — Mes", type: "select", options: MESES, required: true },
      { name: "anoPago", label: "Fecha de pago oportuno — Año", type: "select", options: ANOS_PAGO, required: true },
      {
        name: "moraVigente",
        label: "¿Tiene mora vigente en centrales de riesgo (Datacrédito / TransUnion-Cifin)?",
        type: "select",
        options: SI_NO,
        required: true,
        colSpan: 2,
      },
      { name: "ingresosMensuales", label: "Ingresos mensuales", type: "number", required: true },
      { name: "otrosIngresos", label: "Otros ingresos", type: "number" },
    ],
  },
  {
    id: "domicilio",
    title: "Domicilio",
    fields: [
      {
        name: "departamento",
        label: "Departamento",
        type: "select",
        options: opcionesDepartamento,
        required: true,
      },
      { name: "municipio", label: "Municipio", type: "select", required: true },
      { name: "direccion", label: "Dirección", type: "text", required: true, colSpan: 2 },
      { name: "barrio", label: "Barrio", type: "text", required: true },
    ],
  },
  {
    id: "activos",
    title: "Activos propios",
    fields: [
      { name: "tieneVivienda", label: "¿Tiene vivienda?", type: "radio", options: SI_NO, required: true },
      { name: "tieneVehiculo", label: "¿Tiene vehículo?", type: "radio", options: SI_NO, required: true },
    ],
  },
  {
    id: "laboral",
    title: "Información laboral",
    fields: [
      { name: "ocupacion", label: "Ocupación u oficio", type: "text", required: true },
      { name: "empresa", label: "Empresa donde trabaja", type: "text", required: true },
      { name: "cargo", label: "Cargo que desempeña", type: "text", required: true },
      { name: "fechaIngreso", label: "Fecha de ingreso", type: "date", required: true },
    ],
  },
  {
    id: "referencia",
    title: "Referencia familiar",
    fields: [
      {
        name: "referenciaFamiliarNombre",
        label: "Nombre y apellido",
        type: "text",
        required: true,
        colSpan: 2,
      },
      { name: "referenciaFamiliarTelefono", label: "Teléfono", type: "tel", required: true },
    ],
  },
  {
    id: "bancarios",
    title: "Datos bancarios",
    fields: [
      { name: "tipoCuenta", label: "Tipo de cuenta", type: "select", options: TIPOS_CUENTA, required: true },
      {
        name: "entidadBancaria",
        label: "Entidad bancaria",
        type: "select",
        options: opcionesBancos,
        required: true,
      },
      { name: "numeroCuenta", label: "Número de cuenta", type: "text", required: true, colSpan: 2 },
    ],
  },
  {
    id: "verificacion",
    title: "Verificación",
    description: "Ubicación, documentos, video y firma para validar tu identidad.",
    fields: [
      {
        name: "geolocalizacion",
        label: "Georreferenciación",
        type: "geolocation",
        helperText: "Captura tu ubicación aproximada. Aún no se envía a ningún servidor.",
        colSpan: 2,
      },
      {
        name: "cedulaFrontal",
        label: "Foto cédula — frontal",
        type: "file",
        accept: "image/*",
        required: true,
      },
      {
        name: "cedulaReverso",
        label: "Foto cédula — reverso",
        type: "file",
        accept: "image/*",
        required: true,
      },
      {
        name: "videoVerificacion",
        label: "Video de verificación (3 segundos)",
        type: "video",
        accept: "video/*",
        required: true,
        colSpan: 2,
      },
      { name: "firma", label: "Firma", type: "signature", required: true, colSpan: 2 },
    ],
  },
];
