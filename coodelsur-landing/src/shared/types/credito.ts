export type TipoCredito =
  | "microcredito_small"
  | "microcredito_rural"
  | "microcredito_urbano"
  | "consumo"
  | "comercial"
  | "libranza";

/** @deprecated Usar microcredito_small. Alias histórico del Nanocrédito. */
export type TipoCreditoLegacy = TipoCredito | "nanocredito" | "microcredito";


export type OrigenLead = "witme" | "organico" | "directo" | "referido";

export interface UtmParams {
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  utmTerm?: string;
  utmContent?: string;
}

export interface GeoLocation {
  ciudad?: string;
  pais?: string;
  latitud?: number;
  longitud?: number;
}

export interface FileCapture {
  fileName: string;
  mimeType: string;
  size: number;
  preview: string;
}

export interface GeoCoords {
  lat: number;
  lng: number;
}

export interface LeadPayload {
  tipoCredito: TipoCredito;
  nombre: string;
  cedula: string;
  telefono: string;
  email?: string;
  datosFormulario: Record<string, unknown>;
  origen: OrigenLead;
  utm?: UtmParams;
  ip?: string;
  geo?: GeoLocation;
}

export interface FieldOption {
  label: string;
  value: string;
}

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "textarea"
  | "file"
  | "video"
  | "signature"
  | "geolocation"
  | "hidden";

export interface FormFieldConfig {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: FieldOption[];
  colSpan?: 1 | 2;
  accept?: string;
  readOnly?: boolean;
  helperText?: string;
}

export interface FormSectionConfig {
  id: string;
  title: string;
  description?: string;
  fields: FormFieldConfig[];
  defaultOpen?: boolean;
}

export interface CreditoConfig {
  slug: TipoCredito;
  nombre: string;
  descripcion: string;
  descripcionCorta: string;
  sections: FormSectionConfig[];
  /** Si false, el formulario no está disponible aún (solo landing). */
  disponible?: boolean;
}
