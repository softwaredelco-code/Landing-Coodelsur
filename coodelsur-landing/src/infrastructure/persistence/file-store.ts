/**
 * Almacén local de leads (JSON) para desarrollo / presentación
 * cuando PostgreSQL no está disponible.
 *
 * No reemplaza Supabase en producción: solo actúa como fallback
 * si la conexión a la DB falla.
 */

import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export interface StoredLead {
  id: string;
  tipoCredito: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string | null;
  datosFormulario: Record<string, unknown>;
  origen: string;
  estado: string;
  aceptaTerminos: boolean;
  fechaAceptacionTerminos: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  utmMedium: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  ip: string | null;
  ciudad: string | null;
  pais: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaCreacion: string;
  fechaActualizacion: string;
  storage: "file";
}

const DATA_DIR = path.join(process.cwd(), "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

function ensureStore(): StoredLead[] {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(LEADS_FILE)) {
    writeFileSync(LEADS_FILE, "[]", "utf8");
    return [];
  }
  try {
    const raw = readFileSync(LEADS_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoredLead[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(leads: StoredLead[]) {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf8");
}

export function saveLeadToFile(
  input: Omit<StoredLead, "id" | "fechaCreacion" | "fechaActualizacion" | "storage" | "estado"> & {
    estado?: string;
  },
): StoredLead {
  const now = new Date().toISOString();
  const lead: StoredLead = {
    id: randomUUID(),
    tipoCredito: input.tipoCredito,
    nombre: input.nombre,
    cedula: input.cedula,
    telefono: input.telefono,
    email: input.email,
    datosFormulario: input.datosFormulario,
    origen: input.origen,
    estado: input.estado ?? "recibido",
    aceptaTerminos: input.aceptaTerminos,
    fechaAceptacionTerminos: input.fechaAceptacionTerminos,
    utmSource: input.utmSource,
    utmCampaign: input.utmCampaign,
    utmMedium: input.utmMedium,
    utmTerm: input.utmTerm,
    utmContent: input.utmContent,
    ip: input.ip,
    ciudad: input.ciudad,
    pais: input.pais,
    latitud: input.latitud,
    longitud: input.longitud,
    fechaCreacion: now,
    fechaActualizacion: now,
    storage: "file",
  };

  const leads = ensureStore();
  leads.unshift(lead);
  persist(leads);
  return lead;
}

export function listLeadsFromFile(): StoredLead[] {
  return ensureStore().sort(
    (a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime(),
  );
}

export function getLeadFromFile(id: string): StoredLead | null {
  return ensureStore().find((lead) => lead.id === id) ?? null;
}

export function updateLeadEstadoInFile(id: string, estado: string): StoredLead | null {
  const leads = ensureStore();
  const index = leads.findIndex((lead) => lead.id === id);
  if (index < 0) return null;
  const current = leads[index]!;
  const updated: StoredLead = {
    ...current,
    estado,
    fechaActualizacion: new Date().toISOString(),
  };
  leads[index] = updated;
  persist(leads);
  return updated;
}

export function updateLeadInFile(
  id: string,
  input: Partial<
    Omit<StoredLead, "id" | "fechaCreacion" | "fechaActualizacion" | "storage">
  >,
): StoredLead | null {
  const leads = ensureStore();
  const index = leads.findIndex((lead) => lead.id === id);
  if (index < 0) return null;
  const current = leads[index]!;
  const updated: StoredLead = {
    ...current,
    ...input,
    fechaActualizacion: new Date().toISOString(),
  };
  leads[index] = updated;
  persist(leads);
  return updated;
}

export function deleteLeadFromFile(id: string): boolean {
  const leads = ensureStore();
  const next = leads.filter((lead) => lead.id !== id);
  if (next.length === leads.length) return false;
  persist(next);
  return true;
}

export function isDbConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code) : "";
  const name = "name" in error ? String((error as { name?: string }).name) : "";
  const message = "message" in error ? String((error as { message?: string }).message) : "";
  return (
    code === "P1001" ||
    code === "P1000" ||
    code === "P1017" ||
    name === "PrismaClientRustPanicError" ||
    message.includes("Can't reach database server") ||
    message.includes("ECONNREFUSED") ||
    message.includes("does not exist") ||
    message.includes("timer has gone away") ||
    message.includes("PANIC")
  );
}
