import { z } from "zod";
import type { FormSectionConfig, TipoCredito } from "@/shared/types/credito";
import { creditosConfig } from "@/shared/config/creditos";

function fieldToZod(field: FormSectionConfig["fields"][number]): z.ZodTypeAny {
  if (field.type === "hidden") {
    return z.string().optional();
  }

  let schema: z.ZodTypeAny;

  switch (field.type) {
    case "email":
      schema = z.string().email("Correo electrónico inválido");
      break;
    case "tel":
      schema = z
        .string()
        .min(7, "Teléfono inválido")
        .regex(/^[\d\s+\-()]+$/, "Teléfono inválido");
      break;
    case "number":
      if (field.required) {
        schema = z.coerce.number({ invalid_type_error: "Debe ser un número" });
      } else {
        schema = z.preprocess(
          (val) => (val === "" || val === undefined || val === null ? undefined : val),
          z.coerce.number({ invalid_type_error: "Debe ser un número" }).optional(),
        );
      }
      break;
    case "date":
      schema = z.string().min(1, "Fecha requerida");
      break;
    case "file":
    case "video":
      schema = z.object({
        fileName: z.string(),
        mimeType: z.string(),
        size: z.number(),
        preview: z.string(),
      });
      break;
    case "signature":
      schema = z.string().min(1, "Archivo requerido");
      break;
    case "geolocation":
      schema = z
        .object({
          lat: z.number(),
          lng: z.number(),
        })
        .optional();
      break;
    default:
      schema = z.string();
  }

  if (!field.required) {
    return schema.optional().or(z.literal(""));
  }

  if (field.type === "text" || field.type === "textarea" || field.type === "select" || field.type === "radio") {
    return (schema as z.ZodString).min(1, `${field.label} es requerido`);
  }

  return schema;
}

export function buildFormSchema(tipoCredito: TipoCredito) {
  const config = creditosConfig[tipoCredito];
  const shape: Record<string, z.ZodTypeAny> = {
    tipoCredito: z.literal(tipoCredito),
  };

  for (const section of config.sections) {
    for (const field of section.fields) {
      shape[field.name] = fieldToZod(field);
    }
  }

  return z.object(shape);
}

export type FormValues = z.infer<ReturnType<typeof buildFormSchema>>;

export const leadApiSchema = z.object({
  tipoCredito: z.enum([
    "microcredito_small",
    "microcredito_rural",
    "microcredito_urbano",
    "consumo",
    "comercial",
    "libranza",
  ]),
  nombre: z.string().min(2),
  cedula: z.string().min(5),
  telefono: z.string().min(7),
  email: z.string().email().optional().or(z.literal("")),
  datosFormulario: z.record(z.unknown()),
  utm: z
    .object({
      utmSource: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmMedium: z.string().optional(),
      utmTerm: z.string().optional(),
      utmContent: z.string().optional(),
    })
    .optional(),
  geoCliente: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});
