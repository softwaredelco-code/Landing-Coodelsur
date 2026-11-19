"use client";

import type {
  AdminLeadDetail,
  AdminLeadValidacionAdres,
} from "@/application/lead/admin-lead-detail";
import { Button } from "@/presentation/components/ui/Button";
import {
  OPCIONES_VALIDACION_ADRES,
  VALIDACION_ADRES_LABELS,
} from "@/shared/config/creditos/opciones";
import React, { useEffect, useState } from "react";

interface ValidacionAdresSectionProps {
  leadId: string;
  validacionAdres?: AdminLeadValidacionAdres;
  onUpdated: (updatedLead: AdminLeadDetail) => void;
}

export function ValidacionAdresSection({
  leadId,
  validacionAdres,
  onUpdated,
}: ValidacionAdresSectionProps) {
  const currentAdres = validacionAdres?.estadoAdres ?? "";
  const isValidado = Boolean(currentAdres);

  const [estadoAdres, setEstadoAdres] = useState<string>(
    currentAdres || "cotizante",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setEstadoAdres(validacionAdres?.estadoAdres || "cotizante");
  }, [validacionAdres?.estadoAdres]);

  const saveValidacionAdres = async (nuevoEstado: string | null) => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validacionAdres: {
            estadoAdres: nuevoEstado,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        lead?: AdminLeadDetail;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(
          data.error || "No se pudo guardar la validación ADRES",
        );
      }

      if (data.lead) {
        onUpdated(data.lead);
      }

      setSuccessMsg(
        nuevoEstado
          ? `Validación ADRES guardada correctamente (${VALIDACION_ADRES_LABELS[nuevoEstado] ?? nuevoEstado}).`
          : "Se restableció la validación ADRES.",
      );
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al guardar la validación ADRES",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = estadoAdres.trim().toLowerCase();
    if (!clean) {
      setError("Selecciona una opción de validación ADRES.");
      return;
    }
    void saveValidacionAdres(clean);
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-coodel-dark">
              Validación ADRES
            </h2>
            {isValidado ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300">
                <svg
                  className="h-3.5 w-3.5 text-emerald-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {VALIDACION_ADRES_LABELS[currentAdres] ?? currentAdres}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                Pendiente validar
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Selecciona el tipo de afiliación verificado en ADRES para este solicitante.
          </p>
        </div>
      </div>

      {isValidado && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/70 pb-2 mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
              Afiliación ADRES verificada
            </span>
            {validacionAdres?.fechaValidacionAdres && (
              <span className="text-[11px] text-emerald-700 font-medium">
                Validado:{" "}
                {new Date(validacionAdres.fechaValidacionAdres).toLocaleString(
                  "es-CO",
                )}
              </span>
            )}
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
              Estado de afiliación ADRES
            </dt>
            <dd className="text-sm font-bold text-emerald-950">
              {VALIDACION_ADRES_LABELS[currentAdres] ?? currentAdres}
            </dd>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3.5"
      >
        <div>
          <label
            htmlFor={`validacion-adres-${leadId}`}
            className="block text-xs font-medium uppercase tracking-wide text-gray-600 mb-1"
          >
            Validación ADRES (Cotizante / Beneficiario / Subsidiado)
          </label>
          <select
            id={`validacion-adres-${leadId}`}
            value={estadoAdres}
            disabled={saving}
            onChange={(e) => setEstadoAdres(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-coodel-dark shadow-xs focus:border-coodel-primary focus:outline-none focus:ring-1 focus:ring-coodel-primary"
          >
            {OPCIONES_VALIDACION_ADRES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            {successMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
            {isValidado && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveValidacionAdres(null)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline disabled:opacity-50"
              >
                Quitar validación
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={saving}
              className="bg-coodel-primary hover:bg-coodel-primary-light text-white text-xs font-semibold px-4 py-2"
            >
              {isValidado
                ? "Actualizar validación ADRES"
                : "Guardar validación ADRES"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
