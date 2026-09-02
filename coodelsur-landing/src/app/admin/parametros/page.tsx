"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/Button";
import { calcularDesgloseCuota } from "@/lib/credito/amortizacion";
import type { CreditoParametrosRecord, ProductoParametrizable } from "@/lib/credito/parametros-store";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const PLAZOS_SUGERIDOS = [1, 2, 3, 6, 12, 18, 24, 36, 48] as const;

interface FormState {
  tasaMensualPorcentaje: string;
  estudioCreditoModo: "fijo" | "porcentaje";
  estudioCreditoValor: string;
  fianzaMensualPorcentaje: string;
  vidaDeudoresPorcentaje: string;
  plazosPermitidos: number[];
}

function recordToForm(record: CreditoParametrosRecord): FormState {
  return {
    tasaMensualPorcentaje: (record.tasaMensual * 100).toFixed(2).replace(/\.?0+$/, ""),
    estudioCreditoModo: record.estudioCreditoModo,
    estudioCreditoValor: String(record.estudioCreditoValor),
    fianzaMensualPorcentaje: (record.fianzaMensualPorcentaje * 100)
      .toFixed(2)
      .replace(/\.?0+$/, ""),
    vidaDeudoresPorcentaje: (record.vidaDeudoresPorcentaje * 100)
      .toFixed(4)
      .replace(/\.?0+$/, ""),
    plazosPermitidos: [...record.plazosPermitidos],
  };
}

function parseNumber(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export default function AdminParametrosPage() {
  const router = useRouter();
  const [records, setRecords] = useState<CreditoParametrosRecord[]>([]);
  const [selectedTipo, setSelectedTipo] = useState<ProductoParametrizable>("microcredito_small");
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedRecord = useMemo(
    () => records.find((item) => item.tipoCredito === selectedTipo) ?? null,
    [records, selectedTipo],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/creditos/parametros", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/admin");
      return;
    }
    if (!res.ok) {
      setError("No se pudieron cargar los parámetros");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { parametros: CreditoParametrosRecord[] };
    setRecords(data.parametros);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedRecord) return;
    setForm(recordToForm(selectedRecord));
    setSuccess(null);
  }, [selectedRecord]);

  const preview = useMemo(() => {
    if (!form) return null;
    const tasa = parseNumber(form.tasaMensualPorcentaje);
    const fianza = parseNumber(form.fianzaMensualPorcentaje);
    const vida = parseNumber(form.vidaDeudoresPorcentaje);
    const estudioValor = parseNumber(form.estudioCreditoValor);
    if (
      !Number.isFinite(tasa) ||
      !Number.isFinite(fianza) ||
      !Number.isFinite(vida) ||
      !Number.isFinite(estudioValor) ||
      form.plazosPermitidos.length === 0
    ) {
      return null;
    }

    const parametros = {
      tasaMensual: tasa / 100,
      estudioCredito:
        form.estudioCreditoModo === "fijo"
          ? { modo: "fijo" as const, valor: Math.round(estudioValor) }
          : { modo: "porcentaje" as const, porcentaje: estudioValor / 100 },
      fianzaMensualPorcentaje: fianza / 100,
      vidaDeudoresPorcentaje: vida / 100,
      plazosPermitidos: form.plazosPermitidos,
    };

    const cuotas = form.plazosPermitidos.includes(2) ? 2 : form.plazosPermitidos[0];
    return calcularDesgloseCuota("microcredito_small", 400_000, cuotas, parametros);
  }, [form]);

  const togglePlazo = (plazo: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      const exists = prev.plazosPermitidos.includes(plazo);
      return {
        ...prev,
        plazosPermitidos: exists
          ? prev.plazosPermitidos.filter((item) => item !== plazo)
          : [...prev.plazosPermitidos, plazo].sort((a, b) => a - b),
      };
    });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      tasaMensualPorcentaje: parseNumber(form.tasaMensualPorcentaje),
      estudioCreditoModo: form.estudioCreditoModo,
      estudioCreditoValor: parseNumber(form.estudioCreditoValor),
      fianzaMensualPorcentaje: parseNumber(form.fianzaMensualPorcentaje),
      vidaDeudoresPorcentaje: parseNumber(form.vidaDeudoresPorcentaje),
      plazosPermitidos: form.plazosPermitidos,
    };

    const res = await fetch(`/api/admin/creditos/parametros/${selectedTipo}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (res.status === 401) {
      router.replace("/admin");
      return;
    }

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        details?: Record<string, string[]>;
      } | null;
      const detail = data?.details
        ? Object.values(data.details).flat().join(" · ")
        : data?.error;
      setError(detail ?? "No se pudieron guardar los cambios");
      return;
    }

    const data = (await res.json()) as { parametros: CreditoParametrosRecord };
    setRecords((prev) =>
      prev.map((item) =>
        item.tipoCredito === data.parametros.tipoCredito ? data.parametros : item,
      ),
    );
    setSuccess("Parámetros actualizados. El formulario público usará estos valores de inmediato.");
  };

  const resetDefaults = async () => {
    if (!window.confirm("¿Restaurar los valores por defecto del sistema para este producto?")) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const res = await fetch(`/api/admin/creditos/parametros/${selectedTipo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });

    setSaving(false);

    if (!res.ok) {
      setError("No se pudo restaurar");
      return;
    }

    const data = (await res.json()) as { parametros: CreditoParametrosRecord };
    setRecords((prev) =>
      prev.map((item) =>
        item.tipoCredito === data.parametros.tipoCredito ? data.parametros : item,
      ),
    );
    setSuccess("Valores restaurados a los defaults del sistema.");
  };

  return (
    <AdminShell
      title="Parámetros de crédito"
      subtitle="Tasas, fianza, estudio de crédito y plazos — sin editar código."
    >
      {loading && <p className="text-sm text-gray-500">Cargando parámetros…</p>}
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}

      {!loading && records.length > 0 && form && (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <aside className="space-y-2">
            {records.map((record) => (
              <button
                key={record.tipoCredito}
                type="button"
                onClick={() => setSelectedTipo(record.tipoCredito)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selectedTipo === record.tipoCredito
                    ? "border-coodel-primary bg-coodel-primary text-white shadow-sm"
                    : "border-gray-200 bg-white text-coodel-dark hover:border-coodel-primary/30"
                }`}
              >
                <p className="font-semibold">{record.nombreVisible}</p>
                <p
                  className={`mt-0.5 text-xs ${
                    selectedTipo === record.tipoCredito ? "text-white/75" : "text-gray-500"
                  }`}
                >
                  Tasa {(record.tasaMensual * 100).toFixed(2).replace(".", ",")}% mensual
                </p>
              </button>
            ))}
          </aside>

          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-semibold text-coodel-dark">{selectedRecord?.nombreVisible}</h2>
              <p className="mt-1 text-sm text-gray-500">
                Última actualización:{" "}
                {selectedRecord
                  ? new Date(selectedRecord.fechaActualizacion).toLocaleString("es-CO")
                  : "—"}
              </p>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field
                  label="Tasa de interés mensual (%)"
                  hint="Ej. 2,1 equivale al 2,1% mensual usado en la cuota."
                  value={form.tasaMensualPorcentaje}
                  onChange={(value) => setForm({ ...form, tasaMensualPorcentaje: value })}
                />
                <Field
                  label="Fianza mensual (% del monto)"
                  hint="Porcentaje sobre el capital solicitado."
                  value={form.fianzaMensualPorcentaje}
                  onChange={(value) => setForm({ ...form, fianzaMensualPorcentaje: value })}
                />
                <Field
                  label="Vida deudores (% del monto)"
                  hint="Porcentaje mensual sobre el capital solicitado."
                  value={form.vidaDeudoresPorcentaje}
                  onChange={(value) => setForm({ ...form, vidaDeudoresPorcentaje: value })}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-coodel-dark">
                    Estudio de crédito
                  </label>
                  <select
                    value={form.estudioCreditoModo}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        estudioCreditoModo: event.target.value as "fijo" | "porcentaje",
                      })
                    }
                    className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  >
                    <option value="fijo">Valor fijo (COP)</option>
                    <option value="porcentaje">Porcentaje del monto (%)</option>
                  </select>
                  <input
                    value={form.estudioCreditoValor}
                    onChange={(event) =>
                      setForm({ ...form, estudioCreditoValor: event.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    placeholder={form.estudioCreditoModo === "fijo" ? "30000" : "15"}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Cargo único incluido en la base de amortización (no es una cuota aparte).
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-coodel-dark">Plazos permitidos (cuotas)</p>
                <div className="flex flex-wrap gap-2">
                  {PLAZOS_SUGERIDOS.map((plazo) => {
                    const active = form.plazosPermitidos.includes(plazo);
                    return (
                      <button
                        key={plazo}
                        type="button"
                        onClick={() => togglePlazo(plazo)}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                          active
                            ? "bg-coodel-accent text-white"
                            : "border border-gray-200 bg-white text-gray-600 hover:border-coodel-primary/30"
                        }`}
                      >
                        {plazo} {plazo === 1 ? "cuota" : "cuotas"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button type="button" loading={saving} onClick={() => void save()}>
                  Guardar cambios
                </Button>
                <Button type="button" variant="outline" disabled={saving} onClick={() => void resetDefaults()}>
                  Restaurar defaults
                </Button>
              </div>
            </section>

            {preview && (
              <section className="rounded-xl border border-coodel-primary/15 bg-coodel-primary/[0.03] p-5 md:p-6">
                <h3 className="font-semibold text-coodel-dark">Vista previa de cálculo</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Ejemplo con {formatCOP(400_000)} a{" "}
                  {form.plazosPermitidos.includes(2) ? 2 : form.plazosPermitidos[0]} cuotas.
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <PreviewItem label="Estudio de crédito" value={formatCOP(preview.estudioCredito)} />
                  <PreviewItem
                    label="Base financiada"
                    value={formatCOP(preview.valorCreditoFinanciado)}
                  />
                  <PreviewItem
                    label="Capital + intereses"
                    value={formatCOP(preview.cuotaCapitalInteres)}
                  />
                  <PreviewItem label="Fianza mensual" value={formatCOP(preview.fianzaMensual)} />
                  <PreviewItem
                    label="Vida deudores"
                    value={formatCOP(preview.vidaDeudoresMensual)}
                  />
                  <PreviewItem
                    label="Cuota total estimada"
                    value={formatCOP(preview.valorCuotaTotal)}
                    highlight
                  />
                </dl>
              </section>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-coodel-dark">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function PreviewItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/80 bg-white/80 px-3 py-2">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd
        className={
          highlight
            ? "text-lg font-bold text-coodel-primary"
            : "font-semibold text-coodel-dark"
        }
      >
        {value}
      </dd>
    </div>
  );
}
