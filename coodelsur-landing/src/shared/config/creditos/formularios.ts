import type { TipoCredito } from "@/shared/types/credito";

/**
 * Registro de formularios por producto.
 * `implementado: true` = componente listo y ruta activa.
 * Al terminar un formulario: poner implementado true + formularioDisponible en montos.ts + disponible en index.ts.
 */
export interface FormularioProductoMeta {
  tipo: TipoCredito;
  /** Ruta pública del formulario */
  ruta: `/credito/${TipoCredito}`;
  /** Carpeta del orquestador en presentation/components/forms/ */
  carpeta: string;
  /** Schema Zod en shared/validation/ */
  validation: string;
  implementado: boolean;
}

export const FORMULARIOS_PRODUCTO: Record<TipoCredito, FormularioProductoMeta> = {
  microcredito_small: {
    tipo: "microcredito_small",
    ruta: "/credito/microcredito_small",
    carpeta: "microcredito-small",
    validation: "shared/validation/nanocredito.ts",
    implementado: true,
  },
  microcredito_urbano: {
    tipo: "microcredito_urbano",
    ruta: "/credito/microcredito_urbano",
    carpeta: "microcredito-urbano",
    validation: "shared/validation/microcredito-urbano/schema.ts",
    implementado: true,
  },
  microcredito_rural: {
    tipo: "microcredito_rural",
    ruta: "/credito/microcredito_rural",
    carpeta: "microcredito-rural",
    validation: "shared/validation/microcredito-rural/schema.ts",
    implementado: false,
  },
  consumo: {
    tipo: "consumo",
    ruta: "/credito/consumo",
    carpeta: "consumo",
    validation: "shared/validation/consumo/schema.ts",
    implementado: false,
  },
  comercial: {
    tipo: "comercial",
    ruta: "/credito/comercial",
    carpeta: "comercial",
    validation: "shared/validation/comercial/schema.ts",
    implementado: false,
  },
  libranza: {
    tipo: "libranza",
    ruta: "/credito/libranza",
    carpeta: "libranza",
    validation: "shared/validation/libranza/schema.ts",
    implementado: false,
  },
};

export const FORMULARIOS_IMPLEMENTADOS = Object.values(FORMULARIOS_PRODUCTO).filter(
  (f) => f.implementado,
);

export function isFormularioImplementado(tipo: TipoCredito): boolean {
  return FORMULARIOS_PRODUCTO[tipo]?.implementado === true;
}

export function getFormularioRuta(tipo: TipoCredito): string {
  return FORMULARIOS_PRODUCTO[tipo]?.ruta ?? `/credito/${tipo}`;
}
