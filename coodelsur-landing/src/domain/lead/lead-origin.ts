/** Etiquetas y utilidades de origen de leads (Witme, web, campañas). */

export const LEAD_ORIGEN_FILTER_OPTIONS = [
  { value: "", label: "Todos los orígenes" },
  { value: "witme", label: "Witme" },
  { value: "directo", label: "Web directo" },
  { value: "organico", label: "Orgánico / campañas" },
  { value: "referido", label: "Referido" },
] as const;

const ORIGEN_LABELS: Record<string, string> = {
  witme: "Witme",
  directo: "Web directo",
  organico: "Orgánico",
  referido: "Referido",
};

export function formatLeadOrigen(origen: string): string {
  return ORIGEN_LABELS[origen.toLowerCase()] ?? origen;
}

export function isWitmeOriginated(origen: string, utmSource?: string | null): boolean {
  if (origen.toLowerCase() === "witme") return true;
  return Boolean(utmSource?.toLowerCase().includes("witme"));
}
