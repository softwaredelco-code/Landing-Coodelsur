"use client";

/**
 * Selector unificado de monto.
 * Clasifica el producto según `config/creditos/montos.ts`.
 * Entre $1M y $5M puede haber ambigüedad rural/urbano: el usuario elige.
 */

import { Button } from "@/components/ui/Button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import {
  ajustarMontoAlRangoMasCercano,
  conRangoElegido,
  descripcionRangosParaUi,
  MONTO_SELECTOR_DEFAULT,
  MONTO_SELECTOR_MAX,
  MONTO_SELECTOR_MIN,
  MONTO_SELECTOR_STEP,
  resolverTipoPorMonto,
  type ResolucionMonto,
} from "@/config/creditos/montos";
import { formatCOP } from "@/lib/utils";
import { trackEvent } from "@/lib/tracking/analytics";
import type { TipoCredito } from "@/types/credito";
import { useMemo, useState } from "react";

export interface MontoSelectorProps {
  /** Monto inicial (p. ej. desde query string). */
  initialMonto?: number;
  /** Callback al confirmar un monto con producto ya elegido. */
  onConfirm: (resolucion: Extract<ResolucionMonto, { ok: true }>) => void;
}

export function MontoSelector({ initialMonto, onConfirm }: MontoSelectorProps) {
  const [monto, setMonto] = useState(() =>
    clamp(
      initialMonto && Number.isFinite(initialMonto) ? initialMonto : MONTO_SELECTOR_DEFAULT,
      MONTO_SELECTOR_MIN,
      MONTO_SELECTOR_MAX,
    ),
  );
  const [tipoElegido, setTipoElegido] = useState<TipoCredito | null>(null);

  const resolucionBase = useMemo(() => resolverTipoPorMonto(monto), [monto]);

  const resolucion = useMemo(() => {
    if (!resolucionBase.ok) return resolucionBase;
    if (resolucionBase.rango) return resolucionBase;
    if (!tipoElegido) return resolucionBase;
    return conRangoElegido(resolucionBase, tipoElegido) ?? resolucionBase;
  }, [resolucionBase, tipoElegido]);

  const necesitaEleccion =
    resolucionBase.ok && !resolucionBase.rango && resolucionBase.candidatos.length > 1;

  const puedeContinuar = resolucion.ok && Boolean(resolucion.rango);

  const handleMontoChange = (next: number) => {
    setTipoElegido(null);
    setMonto(next);
  };

  const handleConfirm = () => {
    if (!resolucion.ok || !resolucion.rango) return;
    trackEvent("select_monto", {
      monto,
      tipo_credito: resolucion.rango.tipo,
      producto: resolucion.rango.nombre,
    });
    onConfirm(resolucion);
  };

  return (
    <section id="solicitar" className="bg-coodel-surface py-12 md:py-16">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <header className="mb-8 text-center md:text-left">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-coodel-accent">
            Solicitud en línea
          </p>
          <h2 className="text-3xl font-bold text-coodel-dark md:text-4xl">¿Cuánto necesitas?</h2>
          <p className="mt-3 text-coodel-body">
            Indica el monto y te guiamos al formulario correspondiente.
          </p>
          <p className="mt-2 text-xs text-gray-500">{descripcionRangosParaUi()}</p>
        </header>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-8">
          <p className="text-sm font-medium text-coodel-dark">Monto solicitado</p>
          <p className="mt-1 text-2xl font-bold text-coodel-primary">{formatCOP(monto)}</p>

          <input
            type="range"
            min={MONTO_SELECTOR_MIN}
            max={MONTO_SELECTOR_MAX}
            step={MONTO_SELECTOR_STEP}
            value={monto}
            onChange={(event) => {
              const raw = Number(event.target.value);
              handleMontoChange(ajustarMontoAlRangoMasCercano(raw));
            }}
            className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-coodel-accent"
            aria-label="Selector de monto"
          />

          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>{formatCOP(MONTO_SELECTOR_MIN)}</span>
            <span>{formatCOP(MONTO_SELECTOR_MAX)}</span>
          </div>

          <div className="mt-4">
            <CurrencyInput
              label="O escribe el monto exacto"
              value={monto}
              onValueChange={(next) => {
                if (!next) return;
                handleMontoChange(clamp(next, MONTO_SELECTOR_MIN, MONTO_SELECTOR_MAX));
              }}
            />
          </div>

          {necesitaEleccion && (
            <div className="mt-5 border border-coodel-primary/20 bg-coodel-primary/5 px-4 py-4">
              <p className="text-sm font-semibold text-coodel-dark">
                Este monto aplica a más de un producto. ¿Cuál necesitas?
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {resolucionBase.ok &&
                  resolucionBase.candidatos.map((c) => (
                    <button
                      key={c.tipo}
                      type="button"
                      onClick={() => setTipoElegido(c.tipo)}
                      className={`flex-1 border px-4 py-3 text-left text-sm transition ${
                        tipoElegido === c.tipo
                          ? "border-coodel-accent bg-coodel-accent/10 text-coodel-dark"
                          : "border-gray-200 bg-white text-coodel-body hover:border-coodel-primary/30"
                      }`}
                    >
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="mt-1 block text-xs opacity-70">
                        {formatCOP(c.min)} – {formatCOP(c.max)}
                        {!c.formularioDisponible && " · Próximamente"}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div
            className={`mt-5 border px-4 py-3 text-sm ${
              !resolucion.ok
                ? "border-red-200 bg-red-50 text-red-700"
                : !resolucion.rango
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : resolucion.rango.formularioDisponible
                    ? "border-coodel-accent/40 bg-coodel-accent/5 text-coodel-dark"
                    : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
            role="status"
          >
            {!resolucion.ok ? (
              <p>{resolucion.motivo}</p>
            ) : !resolucion.rango ? (
              <p>Selecciona el tipo de microcrédito para continuar.</p>
            ) : (
              <>
                <p className="font-semibold">Producto: {resolucion.rango.nombre}</p>
                <p className="mt-1 text-xs opacity-80">
                  Rango {formatCOP(resolucion.rango.min)} – {formatCOP(resolucion.rango.max)}
                  {!resolucion.rango.formularioDisponible &&
                    " · Formulario en preparación; puedes escribirnos por WhatsApp."}
                </p>
              </>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            className="mt-6 w-full"
            disabled={!puedeContinuar}
            onClick={handleConfirm}
          >
            Continuar con la solicitud
          </Button>
        </div>
      </div>
    </section>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
