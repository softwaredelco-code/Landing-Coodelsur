"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
}

export default function AdminLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (estado) params.set("estado", estado);
    const res = await fetch(`/api/admin/leads?${params.toString()}`);
    if (res.status === 401) {
      router.replace("/admin");
      return;
    }
    if (!res.ok) {
      setError("No se pudieron cargar los leads");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { leads: LeadRow[]; total: number };
    setLeads(data.leads);
    setTotal(data.total);
    setLoading(false);
  }, [q, estado, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const logout = async () => {
    await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.replace("/admin");
  };

  return (
    <div className="min-h-screen bg-coodel-surface">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-coodel-accent">Admin</p>
            <h1 className="text-xl font-bold text-coodel-dark">Leads / Solicitudes</h1>
          </div>
          <Button variant="outline" type="button" onClick={logout}>
            Salir
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre, cédula, teléfono…"
            className="flex-1 border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="recibido">Recibido</option>
            <option value="revisado">Revisado</option>
            <option value="contactado">Contactado</option>
            <option value="descartado">Descartado</option>
          </select>
          <Button type="button" onClick={() => void load()}>
            Filtrar
          </Button>
        </div>

        <p className="mb-3 text-sm text-gray-500">{total} solicitud(es)</p>

        {loading && <p className="text-sm text-gray-500">Cargando…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto border border-gray-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-coodel-surface text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">Crédito</th>
                  <th className="px-3 py-3">Teléfono</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-100">
                    <td className="px-3 py-3 whitespace-nowrap text-gray-500">
                      {new Date(lead.fechaCreacion).toLocaleString("es-CO")}
                    </td>
                    <td className="px-3 py-3 font-medium text-coodel-dark">{lead.nombre}</td>
                    <td className="px-3 py-3">{lead.tipoCredito}</td>
                    <td className="px-3 py-3">{lead.telefono}</td>
                    <td className="px-3 py-3 capitalize">{lead.estado}</td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="font-semibold text-coodel-primary-light hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                      No hay solicitudes aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
