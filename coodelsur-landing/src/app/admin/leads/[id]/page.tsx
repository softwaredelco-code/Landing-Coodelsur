"use client";

import { AdminShell } from "@/presentation/components/admin/AdminShell";
import { AprobarMontoModal } from "@/presentation/components/admin/AprobarMontoModal";
import { LeadAttachmentGallery } from "@/presentation/components/admin/LeadAttachmentGallery";
import { LeadInfoGrid, LeadSummaryCard } from "@/presentation/components/admin/LeadInfoGrid";
import { LeadUbicacionSection } from "@/presentation/components/admin/LeadUbicacionSection";
import { StatusBadge, ESTADO_LABELS } from "@/presentation/components/admin/StatusBadge";
import { Button } from "@/presentation/components/ui/Button";
import type { AdminLeadDetail } from "@/application/lead/admin-lead-detail";
import { formatCOP } from "@/shared/utils";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TIPO_CREDITO_LABELS: Record<string, string> = {
  microcredito_small: "Microcrédito Small",
  libranza: "Crédito Libranza",
  microcredito_urbano: "Microcrédito Urbano",
};

export default function AdminLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<AdminLeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [triggeringPostback, setTriggeringPostback] = useState(false);
  const [isMontoModalOpen, setIsMontoModalOpen] = useState(false);
  const [montoNotice, setMontoNotice] = useState<string | null>(null);
  const [postbackNotice, setPostbackNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/admin/leads/${params.id}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (cancelled) return;

        if (res.status === 401) {
          router.replace("/admin");
          return;
        }
        if (!res.ok) {
          setError("No se encontró la solicitud");
          return;
        }
        const data = (await res.json()) as { lead: AdminLeadDetail };
        setLead(data.lead);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!cancelled) {
          setError("No se pudo cargar la solicitud");
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [params.id, router]);

  const updateEstado = async (estado: string) => {
    if (!lead) return;
    setSaving(true);
    const res = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, estado }),
    });
    setSaving(false);
    if (res.ok) {
      setLead({ ...lead, estado });
      if (estado === "desembolsado") {
        setTimeout(() => {
          fetch(`/api/admin/leads/${lead.id}`, { cache: "no-store" })
            .then((r) => r.json())
            .then((d) => {
              if (d?.lead) setLead(d.lead);
            })
            .catch(() => {});
        }, 2000);
      }
    }
  };

  const handleTriggerPostback = async () => {
    if (!lead) return;
    setTriggeringPostback(true);
    setPostbackNotice(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/postback-witme`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al disparar postback");
      }
      setLead((prev) => (prev ? { ...prev, witmePostback: data.result } : prev));
      if (data.result?.status === "success") {
        setPostbackNotice({
          type: "success",
          text: `Postback enviado con éxito a Witme (HTTP ${data.result.httpStatus}).`,
        });
      } else if (data.result?.status === "pending_url") {
        setPostbackNotice({
          type: "info",
          text: "Falta configurar la URL del postback en las variables de entorno del servidor.",
        });
      } else {
        setPostbackNotice({
          type: "error",
          text: `Error de Witme: ${data.result?.error || data.result?.httpStatus || "Desconocido"}`,
        });
      }
    } catch (err) {
      setPostbackNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Error al conectar con el servidor.",
      });
    } finally {
      setTriggeringPostback(false);
    }
  };

  const handleMontoAprobadoSaved = (result: {
    montoAprobado: number | null;
    fechaAprobacionMonto: string | null;
    estado?: string;
  }) => {
    setLead((prev) =>
      prev
        ? {
            ...prev,
            montoAprobado: result.montoAprobado,
            fechaAprobacionMonto: result.fechaAprobacionMonto,
            ...(result.estado ? { estado: result.estado } : {}),
          }
        : prev,
    );
    setMontoNotice(
      result.montoAprobado != null
        ? `Monto aprobado guardado correctamente: ${formatCOP(result.montoAprobado)} COP`
        : "Se restableció el monto aprobado de la solicitud",
    );
    setTimeout(() => setMontoNotice(null), 6000);
  };

  const deleteSolicitud = async () => {
    if (!lead) return;

    const confirmed = window.confirm(
      `¿Eliminar la solicitud de ${lead.nombre}? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    const res = await fetch(`/api/admin/leads/${lead.id}`, { method: "DELETE" });
    setDeleting(false);

    if (res.ok) {
      router.push("/admin/leads");
      router.refresh();
      return;
    }

    window.alert("No se pudo eliminar la solicitud. Intenta de nuevo.");
  };

  const handleDownloadAnalisisExcel = async () => {
    if (!lead) return;
    setDownloadingExcel(true);
    try {
      let res = await fetch(`/api/admin/leads/${lead.id}/analisis-excel`);
      if (res.status === 503) {
        // En cPanel/Passenger, si el worker está reiniciando, reintentamos automáticamente tras 1.5s
        await new Promise((resolve) => setTimeout(resolve, 1500));
        res = await fetch(`/api/admin/leads/${lead.id}/analisis-excel`);
      }
      if (res.status === 401) {
        router.replace("/admin");
        return;
      }
      if (!res.ok) {
        let msg = "No se pudo generar el análisis en Excel";
        try {
          const errorJson = (await res.json()) as { error?: string };
          if (errorJson?.error) msg = errorJson.error;
        } catch {
          msg = `El servidor respondió con estado ${res.status}. Intenta de nuevo en unos segundos.`;
        }
        throw new Error(msg);
      }

      let filename = `AnalisisCredito_${lead.cedula}_Nano.xlsx`;
      const disposition = res.headers.get("Content-Disposition");
      if (disposition) {
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match && utf8Match[1]) {
          filename = decodeURIComponent(utf8Match[1]);
        } else {
          const match = disposition.match(/filename="?([^";]+)"?/i);
          if (match && match[1]) filename = match[1];
        }
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[downloadAnalisisExcel]", err);
      window.alert(err instanceof Error ? err.message : "Error al descargar el análisis en Excel");
    } finally {
      setDownloadingExcel(false);
    }
  };

  if (error) {
    return (
      <AdminShell title="Solicitud no encontrada" backHref="/admin/leads" backLabel="Solicitudes">
        <p className="text-red-600">{error}</p>
        <Link href="/admin/leads" className="mt-4 inline-block text-coodel-primary-light underline">
          Volver al listado
        </Link>
      </AdminShell>
    );
  }

  if (!lead) {
    return (
      <AdminShell title="Cargando solicitud…" backHref="/admin/leads" backLabel="Solicitudes">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-white" />
        </div>
      </AdminShell>
    );
  }

  const adjuntos = lead.adjuntos ?? [];

  return (
    <AdminShell
      title={lead.nombre}
      subtitle={`${TIPO_CREDITO_LABELS[lead.tipoCredito] ?? lead.tipoCredito} · ${lead.cedula}`}
      backHref="/admin/leads"
      backLabel="Solicitudes"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsMontoModalOpen(true)}
            className="inline-flex items-center gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs sm:text-sm font-semibold"
          >
            <svg
              className="h-4 w-4 shrink-0 text-emerald-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {lead.montoAprobado != null ? "Editar Monto Aprobado" : "Aprobar Monto"}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={downloadingExcel}
            disabled={downloadingExcel}
            onClick={() => void handleDownloadAnalisisExcel()}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm px-3.5 py-2 shadow-sm"
          >
            <svg
              className="h-4 w-4 shrink-0 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Descargar Análisis
          </Button>
          <select
            value={lead.estado}
            disabled={saving}
            onChange={(e) => void updateEstado(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-coodel-primary focus:outline-none focus:ring-1 focus:ring-coodel-primary"
          >
            <option value="incompleto">Incompleta</option>
            <option value="completo">Completa</option>
            <option value="por_contactar">Por Contactar</option>
            <option value="no_interesado">No interesado</option>
            <option value="aprobado">Aprobado</option>
            <option value="desembolsado">Desembolsado</option>
            <option value="rechazado_reportado">Rechazado: Reportado</option>
            <option value="rechazado_no_cumple">Rechazado: No cumple requisitos</option>
            {["recibido", "revisado", "contactado", "descartado"].includes(lead.estado) && (
              <option value={lead.estado} disabled>
                {ESTADO_LABELS[lead.estado] ?? lead.estado} (Anterior)
              </option>
            )}
          </select>
        </div>
      }
    >
      {montoNotice && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-xs">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{montoNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setMontoNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge estado={lead.estado} />
        <span className="text-xs text-gray-400">
          ID {lead.id.slice(0, 8)}… · {new Date(lead.fechaCreacion).toLocaleString("es-CO")}
        </span>
      </div>

      {lead.estado === "incompleto" && (
        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-amber-900">Solicitud incompleta</h2>
              <p className="mt-1 text-sm text-amber-800">
                El usuario abandonó el formulario antes de enviarlo. Puedes contactarlo para
                retomar el crédito.
              </p>
            </div>
            {lead.pasoActualFormulario && (
              <p className="text-sm font-medium text-amber-900">
                Último paso: {lead.pasoActualFormulario}
              </p>
            )}
          </div>
          {lead.progresoFormulario !== null && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-amber-900">Progreso</span>
                <span className="font-semibold text-amber-900">{lead.progresoFormulario}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${lead.progresoFormulario}%` }}
                />
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <LeadSummaryCard
          label="Monto solicitado"
          value={lead.capitalSolicitado ? formatCOP(lead.capitalSolicitado) : "—"}
          highlight
        />

        {/* Tarjeta interactiva Monto Aprobado */}
        <div className="relative rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Monto aprobado
              </p>
              {lead.montoAprobado != null ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                  Aprobado
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                  Sin asignar
                </span>
              )}
            </div>
            {lead.montoAprobado != null ? (
              <div className="mt-1">
                <p className="text-lg font-bold text-emerald-700">
                  {formatCOP(lead.montoAprobado)}
                </p>
                {lead.capitalSolicitado && (
                  <p className="mt-0.5 text-xs font-medium">
                    {lead.montoAprobado === lead.capitalSolicitado ? (
                      <span className="text-emerald-700">100% del solicitado</span>
                    ) : lead.montoAprobado < lead.capitalSolicitado ? (
                      <span className="text-amber-800">
                        -{formatCOP(lead.capitalSolicitado - lead.montoAprobado)} vs solicitado
                      </span>
                    ) : (
                      <span className="text-blue-700">
                        +{formatCOP(lead.montoAprobado - lead.capitalSolicitado)} vs solicitado
                      </span>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm font-semibold text-gray-400">
                Pendiente de definir
              </p>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsMontoModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    lead.montoAprobado != null
                      ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      : "M12 4v16m8-8H4"
                  }
                />
              </svg>
              {lead.montoAprobado != null ? "Modificar" : "Asignar monto"}
            </button>
          </div>
        </div>

        <LeadSummaryCard
          label="Cuotas"
          value={lead.cantidadCuotas ? String(lead.cantidadCuotas) : "—"}
        />
        <LeadSummaryCard
          label="Valor cuota"
          value={lead.valorCuota ? formatCOP(lead.valorCuota) : "—"}
        />
        <LeadSummaryCard label="Teléfono" value={lead.telefono} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="mb-4 text-lg font-semibold text-coodel-dark">Contacto y origen</h2>
            <LeadInfoGrid
              fields={[
                { label: "Nombre", value: lead.nombre },
                { label: "Cédula", value: lead.cedula },
                { label: "Teléfono", value: lead.telefono },
                { label: "Email", value: lead.email ?? "—" },
                { label: "Origen", value: lead.origen },
                {
                  label: "Hábeas data",
                  value: lead.aceptaTerminos ? "Aceptado" : "No aceptado",
                },
                {
                  label: "Fecha solicitud",
                  value: new Date(lead.fechaCreacion).toLocaleString("es-CO"),
                },
              ]}
            />
          </section>

          {Boolean(
            lead.witmeLeadId ||
              lead.origen === "witme" ||
              lead.utmSource?.toLowerCase().includes("witme"),
          ) && (
            <section className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-sm">
                    W
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-indigo-950">Seguimiento Witme & Postback</h2>
                    <p className="text-xs text-indigo-700">Monitoreo de conversiones por payout fijo</p>
                  </div>
                </div>
                {lead.estado === "desembolsado" && lead.witmeLeadId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={triggeringPostback}
                    disabled={triggeringPostback}
                    onClick={() => void handleTriggerPostback()}
                    className="border-indigo-300 text-indigo-800 hover:bg-indigo-100/60 text-xs font-medium"
                  >
                    {lead.witmePostback?.status === "success" ? "Reenviar Postback" : "Disparar Postback"}
                  </Button>
                )}
              </div>

              {postbackNotice && (
                <div
                  className={`mt-3 rounded-lg p-3 text-xs font-medium ${
                    postbackNotice.type === "success"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : postbackNotice.type === "info"
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-rose-100 text-rose-800 border border-rose-200"
                  }`}
                >
                  {postbackNotice.text}
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-white/90 p-3 border border-indigo-100 shadow-xs">
                  <span className="block text-xs font-medium text-gray-500">ID Witme (witme_id)</span>
                  <span className="mt-1 block font-mono text-xs font-semibold text-gray-900 break-all">
                    {lead.witmeLeadId ?? "No disponible en payload"}
                  </span>
                </div>

                <div className="rounded-lg bg-white/90 p-3 border border-indigo-100 shadow-xs">
                  <span className="block text-xs font-medium text-gray-500">Producto postback</span>
                  <span className="mt-1 block text-xs font-semibold text-indigo-900">
                    {lead.tipoCredito.includes("small") || lead.tipoCredito.includes("nano")
                      ? "Nanocrédito (microcredito_small)"
                      : "Microcrédito (libranza / urbano)"}
                  </span>
                </div>

                <div className="sm:col-span-2 rounded-lg bg-white/90 p-3 border border-indigo-100 shadow-xs">
                  <span className="block text-xs font-medium text-gray-500">Comisión Witme (Payout acordado)</span>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-800">
                      {lead.witmePostback?.payout
                        ? `$${lead.witmePostback.payout} USD · ${lead.witmePostback.tierLabel ?? ""}`
                        : (lead.tipoCredito.includes("small") || lead.tipoCredito.includes("nano"))
                          ? "Inicial: $1.5 USD · 1ra reincidencia: $1.0 USD · 2da: $0.5 USD"
                          : "Inicial: $2.5 USD · 1ra reincidencia: $1.5 USD · 2da: $1.0 USD"}
                    </span>
                    <span className="text-[11px] text-gray-400">Calculado automáticamente por cédula</span>
                  </div>
                </div>

                <div className="sm:col-span-2 rounded-lg bg-white/90 p-3 border border-indigo-100 shadow-xs">
                  <span className="block text-xs font-medium text-gray-500">Estado del postback</span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {lead.witmePostback?.status === "success" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                        Enviado con éxito (HTTP {lead.witmePostback.httpStatus})
                      </span>
                    ) : lead.witmePostback?.status === "pending_url" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                        <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                        Pendiente configurar URL en servidor (.env)
                      </span>
                    ) : lead.witmePostback?.status === "error" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
                        <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                        Error: {lead.witmePostback.error}
                      </span>
                    ) : lead.estado === "desembolsado" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                        Listo para enviar postback
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                        Se enviará automáticamente cuando el estado sea &quot;Desembolsado&quot;
                      </span>
                    )}
                    {lead.witmePostback?.triggeredAt && (
                      <span className="text-[11px] text-gray-400">
                        {new Date(lead.witmePostback.triggeredAt).toLocaleString("es-CO")} · {lead.witmePostback.attempts} intento/s
                      </span>
                    )}
                  </div>
                  {lead.witmePostback?.url && (
                    <p className="mt-2 text-[11px] text-gray-500 break-all font-mono">
                      URL llamada: {lead.witmePostback.url}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {lead.secciones.map((section) => (
            <section
              key={section.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6"
            >
              <h2 className="mb-4 text-lg font-semibold text-coodel-dark">{section.title}</h2>
              <LeadInfoGrid fields={section.fields} />
            </section>
          ))}
        </div>

        <div className="space-y-6">
          <LeadAttachmentGallery attachments={adjuntos} />
          <LeadUbicacionSection lead={lead} />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" type="button" onClick={() => router.push("/admin/leads")}>
          Volver al listado
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            loading={downloadingExcel}
            disabled={downloadingExcel}
            onClick={() => void handleDownloadAnalisisExcel()}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <svg
              className="h-4 w-4 shrink-0 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Descargar Análisis Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={deleting}
            disabled={deleting || saving}
            onClick={() => void deleteSolicitud()}
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            Eliminar solicitud
          </Button>
        </div>
      </div>

      <AprobarMontoModal
        isOpen={isMontoModalOpen}
        onClose={() => setIsMontoModalOpen(false)}
        leadId={lead.id}
        nombreCliente={lead.nombre}
        cedulaCliente={lead.cedula}
        capitalSolicitado={lead.capitalSolicitado}
        currentMontoAprobado={lead.montoAprobado}
        currentEstado={lead.estado}
        onSaved={handleMontoAprobadoSaved}
      />
    </AdminShell>
  );
}
