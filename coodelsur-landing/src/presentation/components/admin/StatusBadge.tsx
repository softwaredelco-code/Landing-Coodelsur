import { cn } from "@/shared/utils";

const ESTADO_STYLES: Record<string, string> = {
  incompleto: "bg-amber-100 text-amber-900 ring-amber-200",
  recibido: "bg-blue-100 text-blue-900 ring-blue-200",
  revisado: "bg-violet-100 text-violet-900 ring-violet-200",
  contactado: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  descartado: "bg-gray-100 text-gray-700 ring-gray-200",
};

const ESTADO_LABELS: Record<string, string> = {
  incompleto: "Incompleta",
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
