"use client";

import { AdminShell } from "@/presentation/components/admin/AdminShell";
import { StatusBadge } from "@/presentation/components/admin/StatusBadge";
import { Button } from "@/presentation/components/ui/Button";
import { formatLeadOrigen, LEAD_ORIGEN_FILTER_OPTIONS } from "@/domain/lead/lead-origin";
import { formatCOP } from "@/shared/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

interface LeadRow {
  id: string;
  tipoCredito: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string | null;
  origen: string;
  estado: string;
  aceptaTerminos: boolean;
  ciudad: string | null;
  fechaCreacion: string;
  fechaActualizacion?: string;
  capitalSolicitado: number | null;
  progresoFormulario: number | null;
  pasoActualFormulario: string | null;
}

const TIPO_CREDITO_LABELS: Record<string, string> = {
  microcredito_small: "Microcrédito Small",
};

function ProgressCell({ value, paso }: { value: number | null; paso: string | null }) {
  if (value === null) return <span className="text-gray-400">—</span>;

  return (
    <div className="min-w-[110px]">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-coodel-primary">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-coodel-accent transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      {paso && <p className="mt-1 truncate text-[11px] text-gray-400">{paso}</p>}
    </div>
  );
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

async function downloadExcelExport(url: string, fallbackFilename: string) {
  // 1. Intentar exportación rápida vía JSON + construcción en cliente
  // Esto previene al 100% el error 503 por timeout de LiteSpeed en cPanel
  try {
    const jsonUrl = url.includes("?") ? `${url}&format=json` : `${url}?format=json`;
    const res = await fetch(jsonUrl, { cache: "no-store" });

    if (res.status === 401) {
      return "unauthorized" as const;
    }

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.leads) && data.leads.length > 0) {
        const { buildLeadsExcelBuffer } = await import("@/application/lead/export-leads-excel");
        const filename = typeof data.filename === "string" && data.filename ? data.filename : fallbackFilename;
        const excelBuffer = buildLeadsExcelBuffer(data.leads);
        const blob = new Blob([excelBuffer as unknown as BlobPart], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        triggerBlobDownload(blob, filename);
        return null;
      }
    }
  } catch (clientErr) {
    console.warn("[downloadExcelExport] Fallback a descarga binaria directa:", clientErr);
  }

  // 2. Fallback a descarga binaria directa con reintento ante 503
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 401) {
        return "unauthorized" as const;
      }

      if (res.status === 503 && attempt === 1) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errorMsg = "No se pudo generar el Excel";
        try {
          const data = JSON.parse(text) as { error?: string };
          if (data?.error) errorMsg = data.error;
        } catch {
          if (text && text.length < 150 && !text.includes("<html")) errorMsg = text;
        }
        return errorMsg;
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? fallbackFilename;
      const blob = await res.blob();
      triggerBlobDownload(blob, filename);
      return null;
    } catch {
      if (attempt === 2) {
        return "Error de red al descargar el archivo Excel. Inténtalo de nuevo.";
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return "No se pudo descargar el archivo Excel. Inténtalo de nuevo.";
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function getRecentMonths(count = 14): Array<{ value: string; label: string }> {
  const result: Array<{ value: string; label: string }> = [];
  const now = new Date();
  const colDate = new Date(now.getTime() - 5 * 3600 * 1000);
  let year = colDate.getUTCFullYear();
  let month = colDate.getUTCMonth(); // 0-11

  for (let i = 0; i < count; i++) {
    const val = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = `${MONTH_NAMES[month]} ${year}`;
    result.push({ value: val, label });
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return result;
}

const PAGE_SIZE = 50;

export default function AdminLeadsPage() {
  const router = useRouter();
  const monthOptions = useMemo(() => getRecentMonths(14), []);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [estado, setEstado] = useState("");
  const [origen, setOrigen] = useState("");
  const [appliedOrigen, setAppliedOrigen] = useState("");
  const [mes, setMes] = useState("");
  const [appliedMes, setAppliedMes] = useState("");
  const [estadoCounts, setEstadoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedAllInScope, setSelectedAllInScope] = useState(false);
  const [exporting, setExporting] = useState<"selected" | "report" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const activeMonthLabel = useMemo(() => {
    if (!appliedMes) return null;
    const found = monthOptions.find((m) => m.value === appliedMes);
    return found ? found.label : appliedMes;
  }, [appliedMes, monthOptions]);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("take", String(PAGE_SIZE));
    params.set("skip", String((page - 1) * PAGE_SIZE));
    if (appliedQ) params.set("q", appliedQ);
    if (estado) params.set("estado", estado);
    if (appliedOrigen) params.set("origen", appliedOrigen);
    if (appliedMes) params.set("mes", appliedMes);
    try {
      const res = await fetch(`/api/admin/leads?${params.toString()}`, { cache: "no-store" });
      if (res.status === 401) {
        setLoading(false);
        setRefreshing(false);
        router.replace("/admin");
        return;
      }
      if (!res.ok) {
        setError("No se pudieron cargar las solicitudes");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const data = (await res.json()) as {
        leads: LeadRow[];
        total: number;
        estadoCounts?: Record<string, number>;
      };
      setLeads(data.leads);
      setTotal(data.total);
      setEstadoCounts(data.estadoCounts ?? {});
      setLastRefreshedAt(new Date());
    } catch {
      setError("Error de conexión al cargar solicitudes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedQ, appliedOrigen, estado, appliedMes, page, router]);

  useEffect(() => {
    void load(true);
    // Polling en tiempo real cada 12 segundos para mostrar solicitudes de inmediato sin recargar
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(false);
      }
    }, 12_000);
    return () => clearInterval(interval);
  }, [load]);

  const applyFilters = () => {
    setPage(1);
    setAppliedQ(q.trim());
    setAppliedOrigen(origen);
    setAppliedMes(mes);
    setSelectedIds(new Set());
    setSelectedAllInScope(false);
  };

  const clearFilters = () => {
    setQ("");
    setAppliedQ("");
    setEstado("");
    setOrigen("");
    setAppliedOrigen("");
    setMes("");
    setAppliedMes("");
    setPage(1);
    setSelectedIds(new Set());
    setSelectedAllInScope(false);
  };

  const hasActiveFilters = Boolean(appliedQ || estado || appliedOrigen || appliedMes);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const completasTotal = estadoCounts.completo ?? 0;
  const porContactarTotal =
    (estadoCounts.por_contactar ?? 0) +
    (estadoCounts.recibido ?? 0) +
    (estadoCounts.revisado ?? 0) +
    (estadoCounts.contactado ?? 0);
  const aprobadosTotal = estadoCounts.aprobado ?? 0;
  const desembolsadosTotal = estadoCounts.desembolsado ?? 0;
  const noInteresadoTotal = estadoCounts.no_interesado ?? 0;
  const rechazadosTotal =
    (estadoCounts.rechazado_reportado ?? 0) +
    (estadoCounts.rechazado_no_cumple ?? 0) +
    (estadoCounts.descartado ?? 0);
  const incompletasTotal = estadoCounts.incompleto ?? 0;
  const allVisibleSelected = useMemo(
    () => leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id)),
    [leads, selectedIds],
  );

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected || selectedAllInScope) {
      setSelectedIds(new Set());
      setSelectedAllInScope(false);
      return;
    }
    setSelectedIds(new Set(leads.map((lead) => lead.id)));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedAllInScope(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildExportUrl = (scope: "selected" | "report") => {
    const params = new URLSearchParams();
    if (scope === "selected" && !selectedAllInScope) {
      params.set("ids", Array.from(selectedIds).join(","));
    } else {
      if (appliedQ) params.set("q", appliedQ);
      if (estado) params.set("estado", estado);
      if (appliedOrigen) params.set("origen", appliedOrigen);
      if (appliedMes) params.set("mes", appliedMes);
    }
    return `/api/admin/leads/export?${params.toString()}`;
  };

  const handleExport = async (scope: "selected" | "report") => {
    setExportError(null);
    setExporting(scope);
    const isFullScope = scope === "report" || selectedAllInScope;
    const fallback =
      !isFullScope
        ? "solicitudes-coodelsur-seleccionadas.xlsx"
        : appliedMes
          ? `solicitudes-coodelsur-mes-${appliedMes}.xlsx`
          : "solicitudes-coodelsur-informe-completo.xlsx";
    const result = await downloadExcelExport(buildExportUrl(scope), fallback);
    setExporting(null);

    if (result === "unauthorized") {
      router.replace("/admin");
      return;
    }
    if (result) {
      setExportError(result);
    }
  };

  return (
    <AdminShell
      title="Solicitudes de crédito"
      subtitle="Gestiona, revisa y exporta las solicitudes recibidas."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
        <StatCard
          label={activeMonthLabel ? `Total (${activeMonthLabel})` : "Total (filtro)"}
          value={String(total)}
        />
        <StatCard label="Completas" value={String(completasTotal)} tone="green" />
        <StatCard
          label="Por Contactar"
          value={String(porContactarTotal)}
          tone="blue"
        />
        <StatCard label="Aprobados" value={String(aprobadosTotal)} tone="green" />
        <StatCard label="Desembolsados" value={String(desembolsadosTotal)} tone="purple" />
        <StatCard label="No interesado" value={String(noInteresadoTotal)} tone="zinc" />
        <StatCard
          label="Rechazados"
          value={String(rechazadosTotal)}
          tone="rose"
        />
        <StatCard label="Incompletas" value={String(incompletasTotal)} tone="amber" />
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="admin-search" className="mb-1 block text-xs font-medium text-gray-500">
              Buscar
            </label>
            <input
              id="admin-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
              placeholder="Nombre, cédula o teléfono…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-coodel-primary focus:outline-none focus:ring-1 focus:ring-coodel-primary"
            />
          </div>
          <div className="w-full lg:w-48">
            <label htmlFor="admin-mes" className="mb-1 block text-xs font-medium text-gray-500">
              Mes / Período
            </label>
            <select
              id="admin-mes"
              value={mes}
              onChange={(e) => {
                setPage(1);
                setMes(e.target.value);
                setAppliedMes(e.target.value);
                setSelectedIds(new Set());
                setSelectedAllInScope(false);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm"
            >
              <option value="">Todos los meses</option>
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full lg:w-44">
            <label htmlFor="admin-estado" className="mb-1 block text-xs font-medium text-gray-500">
              Estado
            </label>
            <select
              id="admin-estado"
              value={estado}
              onChange={(e) => {
                setPage(1);
                setEstado(e.target.value);
                setSelectedIds(new Set());
                setSelectedAllInScope(false);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm"
            >
              <option value="">Todos los estados</option>
              <option value="completo">Completa</option>
              <option value="por_contactar">Por Contactar</option>
              <option value="aprobado">Aprobado</option>
              <option value="desembolsado">Desembolsado</option>
              <option value="no_interesado">No interesado</option>
              <option value="rechazado_reportado">Rechazado: Reportado</option>
              <option value="rechazado_no_cumple">Rechazado: No cumple requisitos</option>
              <option value="incompleto">Incompleta</option>
            </select>
          </div>
          <div className="w-full lg:w-44">
            <label htmlFor="admin-origen" className="mb-1 block text-xs font-medium text-gray-500">
              Origen
            </label>
            <select
              id="admin-origen"
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm"
            >
              {LEAD_ORIGEN_FILTER_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={applyFilters}>
              Aplicar filtros
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                title="Limpiar todos los filtros aplicados"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          {total} solicitud(es) {activeMonthLabel ? `en ${activeMonthLabel}` : "en total"}
          {(selectedAllInScope || selectedIds.size > 0) && (
            <span className="ml-2 font-medium text-coodel-primary">
              · {selectedAllInScope ? `${total} seleccionada(s)` : `${selectedIds.size} seleccionada(s)`}
            </span>
          )}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            loading={refreshing}
            onClick={() => void load(false)}
            title="Actualizar lista de solicitudes en tiempo real"
            className="flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>Actualizar</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={exporting === "selected"}
            disabled={(!selectedAllInScope && selectedIds.size === 0) || exporting !== null}
            onClick={() => void handleExport("selected")}
            title="Descargar en Excel solo las solicitudes marcadas"
          >
            {selectedAllInScope
              ? `Exportar seleccionadas (${total})`
              : `Exportar seleccionadas (${selectedIds.size})`}
          </Button>
          <Button
            type="button"
            loading={exporting === "report"}
            disabled={exporting !== null || total === 0}
            onClick={() => void handleExport("report")}
            title="Descargar todas las solicitudes del listado o del mes filtrado"
          >
            {activeMonthLabel
              ? `Exportar mes ${activeMonthLabel} (${total})`
              : `Exportar todas (${total} solicitudes)`}
          </Button>
        </div>
      </div>

      {exportError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {exportError}
        </p>
      )}

      {loading && <p className="text-sm text-gray-500">Cargando solicitudes…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {allVisibleSelected && total > leads.length && !selectedAllInScope && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs text-amber-900 flex flex-wrap items-center justify-center gap-2">
              <span>
                Has seleccionado las <strong>{leads.length}</strong> solicitudes de esta página.
              </span>
              <button
                type="button"
                onClick={() => setSelectedAllInScope(true)}
                className="font-bold underline text-coodel-primary hover:text-coodel-primary-light"
              >
                Seleccionar todas las {total} solicitudes en total {activeMonthLabel ? `de ${activeMonthLabel}` : ""}
              </button>
            </div>
          )}
          {selectedAllInScope && (
            <div className="border-b border-green-200 bg-green-50 px-4 py-2.5 text-center text-xs text-green-900 flex flex-wrap items-center justify-center gap-2">
              <span>
                ✓ Están seleccionadas <strong>todas las {total} solicitudes</strong> {activeMonthLabel ? `de ${activeMonthLabel}` : "en total"}.
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedAllInScope(false);
                  setSelectedIds(new Set());
                }}
                className="font-bold underline text-red-600 hover:text-red-800 ml-2"
              >
                Desmarcar todas
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-coodel-surface text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas las solicitudes visibles"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      disabled={leads.length === 0}
                    />
                  </th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Solicitante</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Progreso</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="transition hover:bg-coodel-surface/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar solicitud de ${lead.nombre}`}
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelectOne(lead.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {new Date(lead.fechaActualizacion ?? lead.fechaCreacion).toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      <span className="mt-0.5 block text-xs text-gray-400">
                        {new Date(lead.fechaActualizacion ?? lead.fechaCreacion).toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-coodel-dark">{lead.nombre}</p>
                      <p className="text-xs text-gray-500">{lead.cedula}</p>
                      <p className="text-xs text-gray-400">{lead.telefono}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {TIPO_CREDITO_LABELS[lead.tipoCredito] ?? lead.tipoCredito}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-coodel-primary">
                      {lead.capitalSolicitado ? formatCOP(lead.capitalSolicitado) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          lead.origen === "witme"
                            ? "bg-violet-100 text-violet-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatLeadOrigen(lead.origen)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.estado === "incompleto" ? (
                        <ProgressCell
                          value={lead.progresoFormulario}
                          paso={lead.pasoActualFormulario}
                        />
                      ) : (
                        <span className="text-xs font-medium text-emerald-700">Completa</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge estado={lead.estado} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="inline-flex rounded-lg bg-coodel-primary/5 px-3 py-1.5 text-xs font-semibold text-coodel-primary hover:bg-coodel-primary hover:text-white"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      No hay solicitudes con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginación de a 50 solicitudes */}
      {!loading && !error && total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:flex-row">
          <p className="text-xs text-gray-500">
            Mostrando{" "}
            <span className="font-semibold text-gray-800">
              {(page - 1) * PAGE_SIZE + 1}
            </span>{" "}
            a{" "}
            <span className="font-semibold text-gray-800">
              {Math.min(page * PAGE_SIZE, total)}
            </span>{" "}
            de <span className="font-semibold text-gray-800">{total}</span> solicitudes
            {totalPages > 1 && (
              <span className="text-gray-400"> (Página {page} de {totalPages})</span>
            )}
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Anterior</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<number[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) {
                      acc.push(-1);
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === -1 ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`min-w-[2rem] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                          page === p
                            ? "bg-coodel-primary text-white shadow-sm"
                            : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
              </div>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>Siguiente</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "blue" | "amber" | "violet" | "purple" | "green" | "rose" | "zinc";
}) {
  const tones = {
    default: "border-gray-200",
    blue: "border-blue-100 bg-blue-50/40",
    amber: "border-amber-100 bg-amber-50/40",
    violet: "border-violet-100 bg-violet-50/40",
    purple: "border-purple-100 bg-purple-50/40",
    green: "border-emerald-100 bg-emerald-50/40",
    rose: "border-red-100 bg-red-50/40",
    zinc: "border-slate-200 bg-slate-50/40",
  };

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-coodel-dark">{value}</p>
    </div>
  );
}
