"use client";

import {
  buildResumenExcelBuffer,
  buildResumenFilename,
  PRODUCTOS_INFORME,
  type ResumenInformeData,
} from "@/application/lead/export-resumen-excel";
import { LEAD_ORIGEN_FILTER_OPTIONS } from "@/domain/lead/lead-origin";
import { Button } from "@/presentation/components/ui/Button";
import { useCallback, useEffect, useState } from "react";

interface ResumenInformeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTipoCredito?: string;
  initialOrigen?: string;
  initialMes?: string;
  monthOptions: Array<{ value: string; label: string }>;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

export function ResumenInformeModal({
  isOpen,
  onClose,
  initialTipoCredito = "microcredito_small",
  initialOrigen = "",
  initialMes = "",
  monthOptions,
}: ResumenInformeModalProps) {
  const [tipoCredito, setTipoCredito] = useState(initialTipoCredito);
  const [origen, setOrigen] = useState(initialOrigen);
  const [mes, setMes] = useState(initialMes);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [informeData, setInformeData] = useState<ResumenInformeData | null>(null);

  // Sincronizar estado cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setTipoCredito(initialTipoCredito || "microcredito_small");
      setOrigen(initialOrigen || "");
      setMes(initialMes || "");
    }
  }, [isOpen, initialTipoCredito, initialOrigen, initialMes]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("format", "json");
      if (tipoCredito) params.set("tipoCredito", tipoCredito);
      if (origen) params.set("origen", origen);
      if (mes) params.set("mes", mes);

      const res = await fetch(`/api/admin/leads/export-resumen?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("No se pudo cargar el resumen");
      }

      const data = (await res.json()) as ResumenInformeData;
      setInformeData(data);
    } catch {
      setError("Error al cargar datos del informe.");
    } finally {
      setLoading(false);
    }
  }, [tipoCredito, origen, mes]);

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);

    const fallbackFilename = buildResumenFilename(tipoCredito, mes);

    try {
      // 1. Si ya tenemos informeData en memoria, generamos el Excel directamente en el cliente
      if (informeData) {
        const excelBuffer = buildResumenExcelBuffer(informeData);
        const blob = new Blob([excelBuffer as unknown as BlobPart], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        triggerBlobDownload(blob, fallbackFilename);
        setDownloading(false);
        return;
      }

      // 2. Fallback descargando binario del servidor
      const params = new URLSearchParams();
      if (tipoCredito) params.set("tipoCredito", tipoCredito);
      if (origen) params.set("origen", origen);
      if (mes) params.set("mes", mes);

      const res = await fetch(`/api/admin/leads/export-resumen?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Error al descargar archivo desde el servidor");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? fallbackFilename;

      triggerBlobDownload(blob, filename);
    } catch {
      setError("No se pudo generar la descarga de Excel. Inténtalo de nuevo.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-resumen-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coodel-primary/10 text-coodel-primary">
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
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h2
                id="modal-resumen-title"
                className="text-lg font-bold text-coodel-primary"
              >
                Informe por Estado y Producto
              </h2>
              <p className="text-xs text-gray-500">
                Estructura oficial consolidada con porcentajes y cantidades
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Cerrar modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filtros de selección */}
        <div className="border-b border-gray-100 bg-gray-50/70 px-6 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Selector de Producto */}
            <div>
              <label
                htmlFor="resumen-producto"
                className="mb-1 block text-xs font-semibold text-gray-600"
              >
                Producto / Crédito
              </label>
              <select
                id="resumen-producto"
                value={tipoCredito}
                onChange={(e) => setTipoCredito(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-coodel-primary focus:outline-none"
              >
                <option value="">(Todos los productos)</option>
                {PRODUCTOS_INFORME.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Origen / Canal */}
            <div>
              <label
                htmlFor="resumen-origen"
                className="mb-1 block text-xs font-semibold text-gray-600"
              >
                Origen / Canal
              </label>
              <select
                id="resumen-origen"
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-coodel-primary focus:outline-none"
              >
                {LEAD_ORIGEN_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value === "" ? "(Varios elementos / Todos)" : opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Mes / Período */}
            <div>
              <label
                htmlFor="resumen-mes"
                className="mb-1 block text-xs font-semibold text-gray-600"
              >
                Período / Mes
              </label>
              <select
                id="resumen-mes"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-coodel-primary focus:outline-none"
              >
                <option value="">Histórico total (Todos)</option>
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Vista previa en tiempo real */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-coodel-primary border-t-transparent" />
              <p className="text-xs text-gray-500">Cargando vista previa del informe...</p>
            </div>
          ) : informeData ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm font-sans">
              {/* Información superior estilo Excel */}
              <div className="mb-4 space-y-1.5 text-sm">
                <div className="flex items-center gap-4">
                  <span className="w-32 font-medium text-gray-600">Origen / Canal</span>
                  <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {informeData.origenLabel}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-32 font-medium text-gray-600">Producto</span>
                  <span className="rounded border border-[#849E5D] bg-[#A9D18E] px-2 py-0.5 text-xs font-bold text-gray-900">
                    {informeData.productoLabel}
                  </span>
                </div>
                {informeData.periodoLabel && (
                  <div className="flex items-center gap-4">
                    <span className="w-32 font-medium text-gray-600">Período</span>
                    <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
                      {informeData.periodoLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Tabla de Estados */}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-[#708238] text-white font-semibold">
                      <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">
                        ESTADO
                      </th>
                      <th className="px-3 py-2 text-right text-xs uppercase tracking-wider">
                        CANTIDAD
                      </th>
                      <th className="px-3 py-2 text-right text-xs uppercase tracking-wider">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {informeData.filas.map((fila) => (
                      <tr
                        key={fila.estadoKey}
                        className={
                          fila.highlight
                            ? "bg-[#E2EFDA] font-medium text-gray-900"
                            : "hover:bg-gray-50 text-gray-700"
                        }
                      >
                        <td className="px-3 py-1.5">{fila.estadoLabel}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs">
                          {fila.cantidad.toLocaleString("es-CO")}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs">
                          {fila.porcentajeDisplay}
                        </td>
                      </tr>
                    ))}
                    {/* Fila Total General */}
                    <tr className="border-t-2 border-b-4 border-t-gray-800 border-b-gray-800 font-bold text-gray-900 bg-gray-50">
                      <td className="px-3 py-2">Total general</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {informeData.totalGeneral.toLocaleString("es-CO")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-gray-500">
              No hay datos disponibles para los filtros seleccionados
            </div>
          )}
        </div>

        {/* Barra de Acciones */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4">
          <p className="text-xs text-gray-500">
            {informeData ? `${informeData.totalGeneral} solicitudes consolidadas` : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              type="button"
              size="sm"
              loading={downloading}
              disabled={loading || downloading || !informeData}
              onClick={() => void handleDownload()}
              className="flex items-center gap-1.5 bg-[#708238] hover:bg-[#5f6e30] text-white"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>Descargar Excel (.xlsx)</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
