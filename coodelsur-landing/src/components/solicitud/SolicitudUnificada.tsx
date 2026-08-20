"use client";

/**
 * Orquestador del flujo unificado:
 * 1) Usuario elige monto (y producto si hay ambigüedad)
 * 2) Si hay formulario disponible → se muestra (hoy: Microcrédito Small)
 * 3) Si no → mensaje + contacto
 */

import { FormularioCredito } from "@/components/forms/FormularioCredito";
import { MontoSelector } from "@/components/solicitud/MontoSelector";
import { Button } from "@/components/ui/Button";
import { getCreditoConfig } from "@/config/creditos";
import type { ResolucionMonto } from "@/config/creditos/montos";
import { whatsappUrl } from "@/config/site";
import { formatCOP } from "@/lib/utils";
import { useMemo, useState } from "react";

type Fase = "monto" | "formulario" | "no_disponible";

type ResolucionConfirmada = Extract<ResolucionMonto, { ok: true }> & {
  rango: NonNullable<Extract<ResolucionMonto, { ok: true }>["rango"]>;
};

interface SolicitudUnificadaProps {
  /** Permite precargar monto (p. ej. ?monto=500000 desde campañas). */
  initialMonto?: number;
}

export function SolicitudUnificada({ initialMonto }: SolicitudUnificadaProps) {
  const [fase, setFase] = useState<Fase>("monto");
  const [resolucion, setResolucion] = useState<ResolucionConfirmada | null>(null);

  const config = useMemo(() => {
    if (!resolucion) return null;
    return getCreditoConfig(resolucion.rango.tipo) ?? null;
  }, [resolucion]);

  const handleConfirmMonto = (result: Extract<ResolucionMonto, { ok: true }>) => {
    if (!result.rango) return;
    const confirmed = result as ResolucionConfirmada;
    setResolucion(confirmed);
    if (confirmed.rango.formularioDisponible) {
      setFase("formulario");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setFase("no_disponible");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const volverAMonto = () => {
    setFase("monto");
    setResolucion(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (fase === "monto") {
    return <MontoSelector initialMonto={initialMonto} onConfirm={handleConfirmMonto} />;
  }

  if (fase === "no_disponible" && resolucion) {
    return (
      <section className="bg-coodel-surface py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <div className="border border-amber-200 bg-white p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">
              Próximamente
            </p>
            <h1 className="mt-2 text-2xl font-bold text-coodel-dark">
              {resolucion.rango.nombre}
            </h1>
            <p className="mt-3 text-coodel-body">
              Detectamos un monto de {formatCOP(resolucion.monto)}, correspondiente a{" "}
              {resolucion.rango.nombre}. El formulario de este producto aún no está publicado.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Mientras tanto, un asesor puede orientarte por WhatsApp.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button type="button">Escribir por WhatsApp</Button>
              </a>
              <Button type="button" variant="outline" onClick={volverAMonto}>
                Cambiar monto
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (fase === "formulario" && resolucion && config) {
    return (
      <section className="bg-coodel-surface py-8 md:py-12">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <div className="mb-6 border border-coodel-primary/10 bg-coodel-primary px-5 py-5 text-white">
            <button
              type="button"
              onClick={volverAMonto}
              className="mb-3 text-xs text-white/70 underline-offset-2 hover:text-white hover:underline"
            >
              ← Cambiar monto
            </button>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-coodel-gold">
              {resolucion.rango.nombre}
            </p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Completa tu solicitud</h1>
            <p className="mt-2 text-sm text-white/75">
              Monto seleccionado: {formatCOP(resolucion.monto)}. Sigue los pasos del formulario.
            </p>
          </div>

          <FormularioCredito config={config} initialMonto={resolucion.monto} />
        </div>
      </section>
    );
  }

  return <MontoSelector initialMonto={initialMonto} onConfirm={handleConfirmMonto} />;
}
