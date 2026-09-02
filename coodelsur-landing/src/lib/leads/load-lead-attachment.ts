import { prisma } from "@/lib/prisma";
import type { LeadAttachmentField } from "@/lib/leads/attachments";
import { LEAD_ATTACHMENT_FIELDS } from "@/lib/leads/attachments";
import { getLeadFromFile, isDbConnectionError } from "@/lib/leads/file-store";

const FORM_CACHE_TTL_MS = 60_000;
const formularioCache = new Map<
  string,
  { data: Record<string, unknown>; expiresAt: number }
>();

function readCachedField(leadId: string, field: LeadAttachmentField): unknown | null | undefined {
  const cached = formularioCache.get(leadId);
  if (!cached || cached.expiresAt <= Date.now()) return undefined;
  return cached.data[field] ?? null;
}

function cacheFormulario(leadId: string, data: Record<string, unknown>) {
  formularioCache.set(leadId, {
    data,
    expiresAt: Date.now() + FORM_CACHE_TTL_MS,
  });
}

/** Precarga el JSON del formulario en memoria (p. ej. al abrir detalle admin). */
export function primeLeadFormularioCache(leadId: string, data: Record<string, unknown>) {
  cacheFormulario(leadId, data);
}

async function fetchAttachmentField(
  leadId: string,
  field: LeadAttachmentField,
): Promise<unknown | null> {
  const rows = await prisma.$queryRaw<{ value: unknown }[]>`
    SELECT "datosFormulario"->${field} AS value
    FROM "Lead"
    WHERE id = ${leadId}
    LIMIT 1
  `;

  const value = rows[0]?.value ?? null;
  if (value !== null && value !== undefined) {
    const cached = formularioCache.get(leadId);
    cacheFormulario(leadId, {
      ...(cached?.expiresAt && cached.expiresAt > Date.now() ? cached.data : {}),
      [field]: value,
    });
  }

  return value;
}

/** Lee un adjunto del JSON del lead (campo validado en la ruta admin). */
export async function loadLeadAttachmentValue(
  leadId: string,
  field: LeadAttachmentField,
): Promise<unknown | null> {
  const cached = readCachedField(leadId, field);
  if (cached !== undefined) return cached;

  try {
    return await fetchAttachmentField(leadId, field);
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;
  }

  const fileLead = getLeadFromFile(leadId);
  if (!fileLead?.datosFormulario || typeof fileLead.datosFormulario !== "object") {
    return null;
  }

  const data = fileLead.datosFormulario as Record<string, unknown>;
  cacheFormulario(leadId, data);
  return data[field] ?? null;
}
