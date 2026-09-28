import { cn } from "@/shared/utils";

const ESTADO_STYLES: Record<string, string> = {
  incompleto: "bg-amber-100 text-amber-900 ring-amber-200",
  por_contactar: "bg-blue-100 text-blue-900 ring-blue-200",
  no_interesado: "bg-slate-100 text-slate-700 ring-slate-200",
  aprobado: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  rechazado_reportado: "bg-red-100 text-red-900 ring-red-200",
  rechazado_no_cumple: "bg-orange-100 text-orange-900 ring-orange-200",
  // Legacy
  recibido: "bg-blue-100 text-blue-900 ring-blue-200",
  revisado: "bg-violet-100 text-violet-900 ring-violet-200",
  contactado: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  descartado: "bg-gray-100 text-gray-700 ring-gray-200",
};

export const ESTADO_LABELS: Record<string, string> = {
  incompleto: "Incompleta",
  por_contactar: "Por Contactar",
  no_interesado: "No interesado",
  aprobado: "Aprobado",
  rechazado_reportado: "Rechazado: Reportado",
  rechazado_no_cumple: "Rechazado: No cumple requisitos",
  // Legacy
  recibido: "Recibida",
  revisado: "Revisada",
  contactado: "Contactada",
  descartado: "Descartada",
};

export function StatusBadge({ estado, className }: { estado: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        ESTADO_STYLES[estado] ?? "bg-gray-100 text-gray-700 ring-gray-200",
        className,
      )}
    >
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}
