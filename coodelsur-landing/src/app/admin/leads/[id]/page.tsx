"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface LeadDetail {
  id: string;
  tipoCredito: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string | null;
  origen: string;
  estado: string;
  aceptaTerminos: boolean;
  fechaAceptacionTerminos: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  ciudad: string | null;
  pais: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaCreacion: string;
  datosFormulario: Record<string, unknown>;
}

function attachmentUrl(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("http")) return value;
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

export default function AdminLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/admin/leads/${params.id}`);
      if (res.status === 401) {
        router.replace("/admin");
        return;
      }
      if (!res.ok) {
        setError("No se encontró la solicitud");
        return;
      }
      const data = (await res.json()) as { lead: LeadDetail };
      setLead(data.lead);
    };
    void load();
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

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-red-600">{error}</p>
        <Link href="/admin/leads" className="mt-4 inline-block text-coodel-primary-light underline">
          Volver
        </Link>
      </div>
    );
  }

  if (!lead) {
    return <p className="px-4 py-16 text-center text-gray-500">Cargando…</p>;
  }

  const datos = lead.datosFormulario ?? {};
  const files = ["cedulaFrontal", "cedulaReverso", "videoVerificacion", "firma"] as const;

  return (
    <div className="min-h-screen bg-coodel-surface">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 md:px-6">
          <div>
            <Link href="/admin/leads" className="text-xs text-coodel-primary-light hover:underline">
              ← Leads
            </Link>
            <h1 className="text-xl font-bold text-coodel-dark">{lead.nombre}</h1>
            <p className="font-mono text-xs text-gray-500">{lead.id}</p>
          </div>
          <select
            value={lead.estado}
            disabled={saving}
            onChange={(e) => void updateEstado(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm capitalize"
          >
            <option value="recibido">recibido</option>
            <option value="revisado">revisado</option>
            <option value="contactado">contactado</option>
            <option value="descartado">descartado</option>
          </select>
        </div>
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-6 md:px-6">
        <section className="border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-coodel-dark">Datos principales</h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">Crédito</dt>
              <dd>{lead.tipoCredito}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Cédula</dt>
              <dd>{lead.cedula}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Teléfono</dt>
              <dd>{lead.telefono}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd>{lead.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Origen</dt>
              <dd>{lead.origen}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Hábeas data</dt>
              <dd>{lead.aceptaTerminos ? "Aceptado" : "No"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Ciudad</dt>
              <dd>{lead.ciudad || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Fecha</dt>
              <dd>{new Date(lead.fechaCreacion).toLocaleString("es-CO")}</dd>
            </div>
          </dl>
        </section>

        <section className="border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-coodel-dark">Adjuntos</h2>
          <ul className="space-y-2 text-sm">
            {files.map((field) => {
              const url = attachmentUrl(datos[field]);
              return (
                <li key={field} className="flex items-center justify-between gap-3 border-b border-gray-100 py-2">
                  <span className="text-gray-600">{field}</span>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-coodel-primary-light hover:underline"
                    >
                      Abrir
                    </a>
                  ) : (
                    <span className="text-gray-400">Sin URL</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-coodel-dark">Formulario completo (JSON)</h2>
          <pre className="max-h-96 overflow-auto bg-coodel-surface p-3 text-xs text-coodel-body">
            {JSON.stringify(datos, null, 2)}
          </pre>
        </section>

        <Button variant="outline" type="button" onClick={() => router.push("/admin/leads")}>
          Volver al listado
        </Button>
      </div>
    </div>
  );
}
