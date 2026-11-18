"use client";

import type { AdminLeadDatosBancarios, AdminLeadDetail } from "@/application/lead/admin-lead-detail";
import { Button } from "@/presentation/components/ui/Button";
import { TIPOS_CUENTA } from "@/shared/config/creditos/opciones";
import { BANCOS_COLOMBIA } from "@/shared/data/bancos";
import React, { useEffect, useState } from "react";

interface ConfirmacionBancariaSectionProps {
  leadId: string;
  datosBancarios?: AdminLeadDatosBancarios;
  onUpdated: (updatedLead: AdminLeadDetail) => void;
}

const TIPO_CUENTA_LABEL_MAP: Record<string, string> = Object.fromEntries(
  TIPOS_CUENTA.map((t) => [t.value, t.label]),
);

export function ConfirmacionBancariaSection({
  leadId,
  datosBancarios,
  onUpdated,
}: ConfirmacionBancariaSectionProps) {
  const tipoCliente = datosBancarios?.tipoCuentaCliente ?? "";
  const entidadCliente = datosBancarios?.entidadBancariaCliente ?? "";
  const numeroCliente = datosBancarios?.numeroCuentaCliente ?? "";

  const isConfirmada = Boolean(datosBancarios?.cuentaConfirmada);

  const [tipoCuenta, setTipoCuenta] = useState<string>(
    datosBancarios?.tipoCuentaConfirmada || tipoCliente || "ahorros",
  );
  const [entidadBancaria, setEntidadBancaria] = useState<string>(
    datosBancarios?.entidadBancariaConfirmada || entidadCliente || "Bancolombia",
  );
  const [numeroCuenta, setNumeroCuenta] = useState<string>(
    datosBancarios?.numeroCuentaConfirmada || numeroCliente || "",
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setTipoCuenta(
      datosBancarios?.tipoCuentaConfirmada ||
        datosBancarios?.tipoCuentaCliente ||
        "ahorros",
    );
    setEntidadBancaria(
      datosBancarios?.entidadBancariaConfirmada ||
        datosBancarios?.entidadBancariaCliente ||
        "Bancolombia",
    );
    setNumeroCuenta(
      datosBancarios?.numeroCuentaConfirmada ||
        datosBancarios?.numeroCuentaCliente ||
        "",
    );
  }, [
    datosBancarios?.cuentaConfirmada,
    datosBancarios?.tipoCuentaConfirmada,
    datosBancarios?.entidadBancariaConfirmada,
    datosBancarios?.numeroCuentaConfirmada,
    datosBancarios?.tipoCuentaCliente,
    datosBancarios?.entidadBancariaCliente,
    datosBancarios?.numeroCuentaCliente,
  ]);

  const bancosDisponibles = React.useMemo(() => {
    const base: string[] = [...BANCOS_COLOMBIA];
    if (entidadCliente && !base.includes(entidadCliente)) {
      base.unshift(entidadCliente);
    }
    if (
      datosBancarios?.entidadBancariaConfirmada &&
      !base.includes(datosBancarios.entidadBancariaConfirmada)
    ) {
      base.unshift(datosBancarios.entidadBancariaConfirmada);
    }
    return base;
  }, [entidadCliente, datosBancarios?.entidadBancariaConfirmada]);

  const changedFromClient =
    isConfirmada &&
    ((datosBancarios?.tipoCuentaConfirmada ?? "") !== tipoCliente ||
      (datosBancarios?.entidadBancariaConfirmada ?? "") !== entidadCliente ||
      (datosBancarios?.numeroCuentaConfirmada ?? "") !== numeroCliente);

  const saveConfirmation = async (payload: {
    cuentaConfirmada: boolean;
    tipoCuentaConfirmada?: string | null;
    entidadBancariaConfirmada?: string | null;
    numeroCuentaConfirmada?: string | null;
  }) => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datosBancariosConfirmados: payload,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        lead?: AdminLeadDetail;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar la confirmación bancaria");
      }

      if (data.lead) {
        onUpdated(data.lead);
      }

      setSuccessMsg(
        payload.cuentaConfirmada
          ? "Cuenta bancaria confirmada correctamente para desembolso."
          : "Se restableció la confirmación de cuenta bancaria.",
      );
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la cuenta bancaria");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmarMismaDelCliente = () => {
    const t = tipoCliente || tipoCuenta;
    const e = entidadCliente || entidadBancaria;
    const n = numeroCliente.trim() || numeroCuenta.trim();

    if (!t || !e || !n) {
      setError("Completa los 3 campos bancarios antes de confirmar.");
      return;
    }

    setTipoCuenta(t);
    setEntidadBancaria(e);
    setNumeroCuenta(n);

    void saveConfirmation({
      cuentaConfirmada: true,
      tipoCuentaConfirmada: t,
      entidadBancariaConfirmada: e,
      numeroCuentaConfirmada: n,
    });
  };

  const handleSaveEdited = (e: React.FormEvent) => {
    e.preventDefault();
    const t = tipoCuenta.trim();
    const ent = entidadBancaria.trim();
    const num = numeroCuenta.trim();

    if (!t || !ent || !num) {
      setError("Debes ingresar el tipo de cuenta, la entidad bancaria y el número de cuenta o llave.");
      return;
    }

    void saveConfirmation({
      cuentaConfirmada: true,
      tipoCuentaConfirmada: t,
      entidadBancariaConfirmada: ent,
      numeroCuentaConfirmada: num,
    });
  };

  return (
    <div className="mt-5 border-t border-gray-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-coodel-dark">
              Confirmación de cuenta para desembolso
            </h3>
            {isConfirmada ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300">
                <svg className="h-3.5 w-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Cuenta confirmada
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                Pendiente confirmar
              </span>
            )}
            {changedFromClient && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800 border border-blue-200">
                Cuenta actualizada
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Registra o confirma aquí los datos reales de la cuenta para el desembolso.
          </p>
        </div>

        {numeroCliente && (
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirmarMismaDelCliente}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Confirmar misma cuenta del formulario
          </button>
        )}
      </div>

      {/* Resumen destacado cuando ya está confirmada */}
      {isConfirmada && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/70 pb-2 mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
              Cuenta verificada para desembolso
            </span>
            {datosBancarios?.fechaConfirmacionCuenta && (
              <span className="text-[11px] text-emerald-700 font-medium">
                Confirmada: {new Date(datosBancarios.fechaConfirmacionCuenta).toLocaleString("es-CO")}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                Tipo de cuenta
              </dt>
              <dd className="text-sm font-bold text-emerald-950">
                {TIPO_CUENTA_LABEL_MAP[datosBancarios?.tipoCuentaConfirmada ?? ""] ??
                  datosBancarios?.tipoCuentaConfirmada ??
                  "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                Entidad bancaria
              </dt>
              <dd className="text-sm font-bold text-emerald-950">
                {datosBancarios?.entidadBancariaConfirmada ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                Número de cuenta o llave
              </dt>
              <dd className="font-mono text-sm font-bold text-emerald-950">
                {datosBancarios?.numeroCuentaConfirmada ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Campos editables para Cartera */}
      <form onSubmit={handleSaveEdited} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3.5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`tipo-cuenta-confirmada-${leadId}`}
              className="block text-xs font-medium uppercase tracking-wide text-gray-600 mb-1"
            >
              Tipo de cuenta (Confirmado)
            </label>
            <select
              id={`tipo-cuenta-confirmada-${leadId}`}
              value={tipoCuenta}
              disabled={saving}
              onChange={(e) => setTipoCuenta(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-coodel-dark shadow-xs focus:border-coodel-primary focus:outline-none focus:ring-1 focus:ring-coodel-primary"
            >
              {TIPOS_CUENTA.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`entidad-bancaria-confirmada-${leadId}`}
              className="block text-xs font-medium uppercase tracking-wide text-gray-600 mb-1"
            >
              Entidad bancaria (Confirmada)
            </label>
            <select
              id={`entidad-bancaria-confirmada-${leadId}`}
              value={entidadBancaria}
              disabled={saving}
              onChange={(e) => setEntidadBancaria(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-coodel-dark shadow-xs focus:border-coodel-primary focus:outline-none focus:ring-1 focus:ring-coodel-primary"
            >
              {bancosDisponibles.map((banco) => (
                <option key={banco} value={banco}>
                  {banco}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor={`numero-cuenta-confirmada-${leadId}`}
              className="block text-xs font-medium uppercase tracking-wide text-gray-600 mb-1"
            >
              Número de cuenta o llave bancaria (Confirmado)
            </label>
            <input
              id={`numero-cuenta-confirmada-${leadId}`}
              type="text"
              value={numeroCuenta}
              disabled={saving}
              onChange={(e) => setNumeroCuenta(e.target.value)}
              placeholder="Ingresa el número de cuenta o llave bancaria"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-coodel-dark shadow-xs placeholder:text-gray-400 focus:border-coodel-primary focus:outline-none focus:ring-1 focus:ring-coodel-primary"
            />
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
                onClick={() => void saveConfirmation({ cuentaConfirmada: false })}
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
              {isConfirmada ? "Actualizar cuenta confirmada" : "Guardar cuenta confirmada"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

