"use client";

import { StatusBadge } from "@/presentation/components/admin/StatusBadge";
import { Button } from "@/presentation/components/ui/Button";
import { formatCOP } from "@/shared/utils";
import React, { useEffect, useState, useId } from "react";

interface AprobarMontoModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  nombreCliente: string;
  cedulaCliente?: string;
  capitalSolicitado: number | null;
  currentMontoAprobado: number | null;
  currentEstado: string;
  onSaved: (result: {
    montoAprobado: number | null;
    fechaAprobacionMonto: string | null;
    estado?: string;
  }) => void;
}

function formatNumberInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(String(value).replace(/\D/g, ""));
  if (isNaN(num)) return "";
  return num.toLocaleString("es-CO");
}

function parseFormattedNumber(value: string): number | null {
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return null;
  const num = Number(digitsOnly);
  return isNaN(num) ? null : num;
}

export function AprobarMontoModal({
  isOpen,
  onClose,
  leadId,
  nombreCliente,
  cedulaCliente,
  capitalSolicitado,
  currentMontoAprobado,
  currentEstado,
  onSaved,
}: AprobarMontoModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [actualizarEstadoAprobado, setActualizarEstadoAprobado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setInputValue(
        currentMontoAprobado != null
          ? formatNumberInput(currentMontoAprobado)
          : capitalSolicitado != null
            ? formatNumberInput(capitalSolicitado)
            : "",
      );
      setActualizarEstadoAprobado(
        currentEstado !== "aprobado" && currentEstado !== "desembolsado",
      );
    }
  }, [isOpen, currentMontoAprobado, capitalSolicitado, currentEstado]);

  if (!isOpen) return null;

  const numericValue = parseFormattedNumber(inputValue);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setInputValue("");
      return;
    }
    const num = Number(raw);
    setInputValue(num.toLocaleString("es-CO"));
    if (error) setError(null);
  };

  const setPresetPercentage = (pct: number) => {
    if (!capitalSolicitado || capitalSolicitado <= 0) return;
    const computed = Math.round((capitalSolicitado * pct) / 10000) * 10000;
    setInputValue(computed.toLocaleString("es-CO"));
    if (error) setError(null);
  };

  const handleSave = async (montoToSave: number | null) => {
    setSaving(true);
    setError(null);

    const payload: {
      montoAprobado: number | null;
      estado?: string;
    } = {
      montoAprobado: montoToSave,
    };

    if (actualizarEstadoAprobado && currentEstado !== "desembolsado") {
      payload.estado = "aprobado";
    }

    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar el monto aprobado");
      }

      onSaved({
        montoAprobado: montoToSave,
        fechaAprobacionMonto: montoToSave !== null ? new Date().toISOString() : null,
        estado: payload.estado,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const diferencia =
    numericValue != null && capitalSolicitado != null
      ? numericValue - capitalSolicitado
      : null;

  const porcentajeDelSolicitado =
    numericValue != null && capitalSolicitado != null && capitalSolicitado > 0
      ? Math.round((numericValue / capitalSolicitado) * 1000) / 10
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-gray-900">
                Aprobar Monto de Crédito
              </h2>
              <p className="text-xs text-gray-500">
                Define el cupo o valor definitivo aprobado para esta solicitud
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Cerrar ventana"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="space-y-4 px-6 py-5 overflow-y-auto">
          {/* Tarjeta resumen solicitud */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 text-xs text-gray-600 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-500">Titular</span>
              <span className="font-semibold text-gray-900">
                {nombreCliente} {cedulaCliente ? `· CC ${cedulaCliente}` : ""}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-500">Monto solicitado</span>
              <span className="font-bold text-coodel-primary">
                {capitalSolicitado ? formatCOP(capitalSolicitado) : "No especificado"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-500">Estado actual</span>
              <StatusBadge estado={currentEstado} />
            </div>
          </div>

          {/* Campo Monto Aprobado */}
          <div>
            <label
              htmlFor="input-monto-aprobado"
              className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1"
            >
              Monto Aprobado (COP)
            </label>
            <div className="relative rounded-xl shadow-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <span className="text-sm font-bold text-gray-500">$</span>
              </div>
              <input
                id="input-monto-aprobado"
                type="text"
                inputMode="numeric"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="0"
                disabled={saving}
                className="block w-full rounded-xl border border-gray-300 bg-white pl-8 pr-16 py-2.5 text-base font-bold text-gray-900 placeholder:text-gray-300 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                <span className="text-xs font-semibold text-gray-400">COP</span>
              </div>
            </div>
          </div>

          {/* Botones de atajo rápido */}
          {capitalSolicitado && capitalSolicitado > 0 && (
            <div>
              <p className="text-[11px] font-medium text-gray-500 mb-1.5">Atajos rápidos:</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPresetPercentage(100)}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  100% ({formatCOP(capitalSolicitado)})
                </button>
                <button
                  type="button"
                  onClick={() => setPresetPercentage(75)}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  75% ({formatCOP(Math.round((capitalSolicitado * 0.75) / 10000) * 10000)})
                </button>
                <button
                  type="button"
                  onClick={() => setPresetPercentage(50)}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  50% ({formatCOP(Math.round((capitalSolicitado * 0.5) / 10000) * 10000)})
                </button>
              </div>
            </div>
          )}

          {/* Comparativo en tiempo real */}
          {numericValue != null && capitalSolicitado != null && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                diferencia === 0
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                  : diferencia! < 0
                    ? "border-amber-200 bg-amber-50/70 text-amber-900"
                    : "border-blue-200 bg-blue-50/70 text-blue-900"
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span>
                  {diferencia === 0
                    ? "Aprobación total (100%)"
                    : diferencia! < 0
                      ? "Aprobación por menor valor"
                      : "Aprobación por mayor valor"}
                </span>
                <span>{porcentajeDelSolicitado}% del solicitado</span>
              </div>
              <p className="mt-1 text-[11px] opacity-90">
                {diferencia === 0
                  ? "Se aprueba el valor exacto solicitado por el titular."
                  : diferencia! < 0
                    ? `Diferencia de -${formatCOP(Math.abs(diferencia!))} respecto al monto solicitado.`
                    : `Diferencia de +${formatCOP(diferencia!)} por encima del monto solicitado.`}
              </p>
            </div>
          )}

          {/* Opción de actualizar estado */}
          {currentEstado !== "desembolsado" && (
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={actualizarEstadoAprobado}
                onChange={(e) => setActualizarEstadoAprobado(e.target.checked)}
                disabled={saving}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-700">
                <strong className="font-semibold text-gray-900">
                  Actualizar estado de la solicitud a &quot;Aprobado&quot;
                </strong>
                <span className="block text-[11px] text-gray-500">
                  Cambia el estado de &quot;{currentEstado}&quot; a &quot;Aprobado&quot; automáticamente.
                </span>
              </span>
            </label>
          )}

          {/* Mensaje de error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Pie con acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-3.5 rounded-b-2xl">
          <div>
            {currentMontoAprobado != null && (
              <button
                type="button"
                onClick={() => void handleSave(null)}
                disabled={saving}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline disabled:opacity-50"
              >
                Eliminar aprobación
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={onClose}
              className="text-xs font-medium"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={saving || numericValue == null}
              onClick={() => void handleSave(numericValue)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4"
            >
              Guardar monto
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
