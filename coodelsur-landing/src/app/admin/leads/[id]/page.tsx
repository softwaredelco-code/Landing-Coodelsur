"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { LeadAttachmentGallery } from "@/components/admin/LeadAttachmentGallery";
import { LeadInfoGrid, LeadSummaryCard } from "@/components/admin/LeadInfoGrid";
import { LeadUbicacionSection } from "@/components/admin/LeadUbicacionSection";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { AdminLeadDetail } from "@/lib/leads/admin-lead-detail";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TIPO_CREDITO_LABELS: Record<string, string> = {
  microcredito_small: "Microcrédito Small",
};

export default function AdminLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<AdminLeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    }
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
        <select
          value={lead.estado}
          disabled={saving}
          onChange={(e) => void updateEstado(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium capitalize shadow-sm"
        >
          <option value="incompleto">Incompleta</option>
          <option value="recibido">Recibida</option>
          <option value="revisado">Revisada</option>
          <option value="contactado">Contactada</option>
          <option value="descartado">Descartada</option>
        </select>
      }
    >
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LeadSummaryCard
          label="Monto solicitado"
          value={lead.capitalSolicitado ? formatCOP(lead.capitalSolicitado) : "—"}
          highlight
        />
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
    </AdminShell>
  );
}
