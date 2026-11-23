"use client";

import type {
  AdminLeadActivosPropios,
  AdminLeadDetail,
} from "@/application/lead/admin-lead-detail";
import { Button } from "@/presentation/components/ui/Button";
import { SI_NO } from "@/shared/config/creditos/opciones";
import React, { useEffect, useState } from "react";

interface ConfirmacionActivosSectionProps {
  leadId: string;
  activosPropios?: AdminLeadActivosPropios;
  onUpdated: (updatedLead: AdminLeadDetail) => void;
}

const SI_NO_LABEL_MAP: Record<string, string> = {
  si: "Sí",
  no: "No",
};

export function ConfirmacionActivosSection({
  leadId,
  activosPropios,
  onUpdated,
}: ConfirmacionActivosSectionProps) {
  const viviendaCliente = activosPropios?.tieneViviendaCliente ?? "";
  const vehiculoCliente = activosPropios?.tieneVehiculoCliente ?? "";

  const isConfirmada = Boolean(activosPropios?.activosConfirmados);

  const [tieneVivienda, setTieneVivienda] = useState<string>(
    activosPropios?.tieneViviendaConfirmada || viviendaCliente || "no",
  );
  const [tieneVehiculo, setTieneVehiculo] = useState<string>(
    activosPropios?.tieneVehiculoConfirmado || vehiculoCliente || "no",
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setTieneVivienda(
      activosPropios?.tieneViviendaConfirmada ||
        activosPropios?.tieneViviendaCliente ||
        "no",
    );
    setTieneVehiculo(
      activosPropios?.tieneVehiculoConfirmado ||
        activosPropios?.tieneVehiculoCliente ||
        "no",
    );
  }, [
    activosPropios?.activosConfirmados,
    activosPropios?.tieneViviendaConfirmada,
    activosPropios?.tieneVehiculoConfirmado,
    activosPropios?.tieneViviendaCliente,
    activosPropios?.tieneVehiculoCliente,
  ]);

  const changedFromClient =
    isConfirmada &&
    ((viviendaCliente &&
      (activosPropios?.tieneViviendaConfirmada ?? "") !== viviendaCliente) ||
      (vehiculoCliente &&
        (activosPropios?.tieneVehiculoConfirmado ?? "") !== vehiculoCliente));

  const saveConfirmation = async (payload: {
    activosConfirmados: boolean;
    tieneViviendaConfirmada?: string | null;
    tieneVehiculoConfirmado?: string | null;
  }) => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activosPropiosConfirmados: payload,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        lead?: AdminLeadDetail;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(
          data.error || "No se pudo guardar la confirmación de activos propios",
        );
      }

      if (data.lead) {
        onUpdated(data.lead);
      }

      setSuccessMsg(
        payload.activosConfirmados
          ? "Activos propios confirmados correctamente."
          : "Se restableció la confirmación de activos propios.",
      );
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al guardar la confirmación de activos propios",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmarMismosDelCliente = () => {
    const viv = viviendaCliente || tieneVivienda || "no";
    const veh = vehiculoCliente || tieneVehiculo || "no";

    setTieneVivienda(viv);
    setTieneVehiculo(veh);

    void saveConfirmation({
      activosConfirmados: true,
      tieneViviendaConfirmada: viv,
      tieneVehiculoConfirmado: veh,
    });
  };

  const handleSaveEdited = (e: React.FormEvent) => {
    e.preventDefault();
    const viv = tieneVivienda.trim().toLowerCase();
    const veh = tieneVehiculo.trim().toLowerCase();

    if ((viv !== "si" && viv !== "no") || (veh !== "si" && veh !== "no")) {
      setError("Debes seleccionar Sí o No tanto para Vivienda como para Vehículo.");
      return;
    }

    void saveConfirmation({
      activosConfirmados: true,
      tieneViviendaConfirmada: viv,
      tieneVehiculoConfirmado: veh,
    });
  };

  return (
    <div className="mt-5 border-t border-gray-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-coodel-dark">
              Confirmación de activos propios
            </h3>
            {isConfirmada ? (
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
                Activos confirmados
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                Pendiente confirmar
              </span>
            )}
            {changedFromClient && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800 border border-blue-200">
                Activos actualizados
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Verifica y confirma aquí si el solicitante realmente cuenta con vivienda o vehículo propio.
          </p>
        </div>

        {(viviendaCliente || vehiculoCliente) && (
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirmarMismosDelCliente}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            <svg
              className="h-3.5 w-3.5 text-emerald-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Confirmar mismos del formulario
          </button>
        )}
      </div>

      {/* Resumen destacado cuando ya está confirmado */}
      {isConfirmada && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/70 pb-2 mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
              Activos propios verificados
            </span>
            {activosPropios?.fechaConfirmacionActivos && (
              <span className="text-[11px] text-emerald-700 font-medium">
                Confirmado:{" "}
                {new Date(activosPropios.fechaConfirmacionActivos).toLocaleString(
                  "es-CO",
                )}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                Vivienda (Confirmado)
              </dt>
              <dd className="text-sm font-bold text-emerald-950">
                {SI_NO_LABEL_MAP[activosPropios?.tieneViviendaConfirmada ?? ""] ??
                  activosPropios?.tieneViviendaConfirmada ??
                  "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                Vehículo (Confirmado)
              </dt>
              <dd className="text-sm font-bold text-emerald-950">
                {SI_NO_LABEL_MAP[activosPropios?.tieneVehiculoConfirmado ?? ""] ??
                  activosPropios?.tieneVehiculoConfirmado ??
                  "—"}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Campos desplegables editables para el panel admin */}
      <form
        onSubmit={handleSaveEdited}
        className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3.5"
      >
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`tiene-vivienda-confirmada-${leadId}`}
              className="block text-xs font-medium uppercase tracking-wide text-gray-600 mb-1"
            >
              Vivienda (Sí / No)
            </label>
            <select
              id={`tiene-vivienda-confirmada-${leadId}`}
              value={tieneVivienda}
              disabled={saving}
              onChange={(e) => setTieneVivienda(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-coodel-dark shadow-xs focus:border-coodel-primary focus:outline-none focus:ring-1 focus:ring-coodel-primary"
            >
              {SI_NO.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`tiene-vehiculo-confirmado-${leadId}`}
              className="block text-xs font-medium uppercase tracking-wide text-gray-600 mb-1"
            >
              Vehículo (Sí / No)
            </label>
            <select
              id={`tiene-vehiculo-confirmado-${leadId}`}
              value={tieneVehiculo}
              disabled={saving}
              onChange={(e) => setTieneVehiculo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-coodel-dark shadow-xs focus:border-coodel-primary focus:outline-none focus:ring-1 focus:ring-coodel-primary"
            >
              {SI_NO.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
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
            {isConfirmada && (
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void saveConfirmation({ activosConfirmados: false })
                }
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline disabled:opacity-50"
              >
                Quitar confirmación
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
              {isConfirmada
                ? "Actualizar activos confirmados"
                : "Guardar activos confirmados"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
