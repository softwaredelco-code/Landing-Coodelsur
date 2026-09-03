"use client";

import { Button } from "@/presentation/components/ui/Button";
import { getFormularioRuta } from "@/shared/config/creditos/formularios";
import { whatsappUrl } from "@/shared/config/site";
import type { CreditoFormProps } from "@/presentation/components/forms/types";
import Link from "next/link";

interface FormularioEnDesarrolloProps extends CreditoFormProps {
  /** Notas para el equipo de desarrollo (solo visible en dev). */
  devHint?: string;
}

/**
 * Placeholder mientras un formulario no está implementado.
 * Se reemplaza por el orquestador real en forms/<producto>/Formulario*.tsx
 */
export function FormularioEnDesarrollo({ config, devHint }: FormularioEnDesarrolloProps) {
  const ruta = getFormularioRuta(config.slug);
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="border border-amber-200 bg-white p-6 shadow-sm md:p-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">
        Formulario en desarrollo
      </p>
      <h2 className="mt-2 text-xl font-bold text-coodel-dark">{config.nombre}</h2>
      <p className="mt-3 text-coodel-body">{config.descripcion}</p>
      <p className="mt-2 text-sm text-gray-500">
        El formulario de este producto aún no está publicado. Un asesor puede orientarte mientras
        tanto.
      </p>

      {isDev && devHint && (
        <p className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600">
          DEV: {devHint}
        </p>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Ruta reservada: <code className="text-coodel-primary">{ruta}</code>
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <Button type="button">Escribir por WhatsApp</Button>
        </a>
        <Link href="/#solicitar">
          <Button type="button" variant="outline">
            Volver al selector
          </Button>
        </Link>
        <Link href="/credito/microcredito_small">
          <Button type="button" variant="ghost">
            Ir a Microcrédito Small
          </Button>
        </Link>
      </div>
    </div>
  );
}
