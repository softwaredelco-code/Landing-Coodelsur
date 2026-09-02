export const LEAD_ATTACHMENT_FIELDS = [
  "cedulaFrontal",
  "cedulaReverso",
  "videoVerificacion",
  "firma",
] as const;

export type LeadAttachmentField = (typeof LEAD_ATTACHMENT_FIELDS)[number];

export const ATTACHMENT_LABELS: Record<LeadAttachmentField, string> = {
  cedulaFrontal: "Cédula frontal",
  cedulaReverso: "Cédula reverso",
  videoVerificacion: "Video verificación",
  firma: "Firma",
};

export interface AdminAttachment {
  field: LeadAttachmentField;
  label: string;
  fileName: string | null;
  mimeType: string | null;
  /** URL del proxy admin para mostrar/descargar el archivo. */
  url: string | null;
  uploaded: boolean;
  available: boolean;
}

export type AttachmentSource =
  | { kind: "dataUrl"; dataUrl: string; mimeType: string }
  | { kind: "storagePath"; path: string; mimeType: string }
  | { kind: "remoteUrl"; url: string; mimeType: string };

function readAttachmentMeta(value: unknown): {
  dataUrl: string | null;
  path: string | null;
  remoteUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  uploaded: boolean;
} {
  if (typeof value === "string") {
    if (value.startsWith("data:")) {
      return {
        dataUrl: value,
        path: null,
        remoteUrl: null,
        fileName: null,
        mimeType: value.match(/^data:([^;]+)/)?.[1] ?? null,
        uploaded: false,
      };
    }
    if (value.startsWith("http")) {
      return {
        dataUrl: null,
        path: null,
        remoteUrl: value,
        fileName: null,
        mimeType: null,
        uploaded: true,
      };
    }
    return {
      dataUrl: null,
      path: null,
      remoteUrl: null,
      fileName: null,
      mimeType: null,
      uploaded: false,
    };
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const preview =
      typeof obj.preview === "string" &&
      (obj.preview.startsWith("data:") || obj.preview.startsWith("http"))
        ? obj.preview
        : null;
    const httpUrl = typeof obj.url === "string" && obj.url.startsWith("http") ? obj.url : null;

    return {
      dataUrl: preview?.startsWith("data:") ? preview : null,
      path: typeof obj.path === "string" ? obj.path : null,
      remoteUrl: httpUrl ?? (preview?.startsWith("http") ? preview : null),
      fileName: typeof obj.fileName === "string" ? obj.fileName : null,
      mimeType: typeof obj.mimeType === "string" ? obj.mimeType : null,
      uploaded: obj.uploaded === true,
    };
  }

  return {
    dataUrl: null,
    path: null,
    remoteUrl: null,
    fileName: null,
    mimeType: null,
    uploaded: false,
  };
}

export function resolveAttachmentSource(value: unknown): AttachmentSource | null {
  const meta = readAttachmentMeta(value);

  if (meta.dataUrl) {
    return {
      kind: "dataUrl",
      dataUrl: meta.dataUrl,
      mimeType: meta.mimeType ?? meta.dataUrl.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream",
    };
  }

  if (meta.path) {
    return {
      kind: "storagePath",
      path: meta.path,
      mimeType: meta.mimeType ?? "application/octet-stream",
    };
  }

  if (meta.remoteUrl) {
    return {
      kind: "remoteUrl",
      url: meta.remoteUrl,
      mimeType: meta.mimeType ?? "application/octet-stream",
    };
  }

  return null;
}

export function isAttachmentAvailable(value: unknown): boolean {
  return resolveAttachmentSource(value) !== null;
}

export function getAdminAttachmentProxyUrl(leadId: string, field: LeadAttachmentField): string {
  return `/api/admin/leads/${leadId}/attachments/${field}`;
}

/** Metadatos livianos de adjuntos (sin preview/base64). */
export type AttachmentFieldMeta = Partial<Record<LeadAttachmentField, unknown>>;

async function resolveAttachmentUrl(
  leadId: string,
  field: LeadAttachmentField,
  meta: ReturnType<typeof readAttachmentMeta>,
): Promise<string | null> {
  if (meta.remoteUrl?.startsWith("http")) return meta.remoteUrl;

  if (meta.path && meta.uploaded) {
    const { createSignedStorageUrl } = await import("@/lib/storage/upload");
    const signed = await createSignedStorageUrl(meta.path);
    if (signed) return signed;
  }

  if (meta.dataUrl || meta.path || meta.remoteUrl) {
    return getAdminAttachmentProxyUrl(leadId, field);
  }

  return null;
}

/** Metadatos de adjuntos para el panel admin (URLs directas cuando es posible). */
export async function buildAdminAttachmentsFromMeta(
  leadId: string,
  fieldMeta: AttachmentFieldMeta,
): Promise<AdminAttachment[]> {
  return Promise.all(
    LEAD_ATTACHMENT_FIELDS.map(async (field) => {
      const value = fieldMeta[field];
      const meta = readAttachmentMeta(value);
      const available = isAttachmentAvailable(value);

      const url = available ? await resolveAttachmentUrl(leadId, field, meta) : null;

      return {
        field,
        label: ATTACHMENT_LABELS[field],
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        url,
        uploaded: meta.uploaded,
        available,
      };
    }),
  );
}

/** Metadatos de adjuntos para el panel admin (sirve vía proxy interno). */
export function buildAdminAttachments(
  leadId: string,
  datosFormulario: unknown,
): AdminAttachment[] {
  const datos =
    datosFormulario && typeof datosFormulario === "object"
      ? (datosFormulario as Record<string, unknown>)
      : {};

  return LEAD_ATTACHMENT_FIELDS.map((field) => {
    const value = datos[field];
    const meta = readAttachmentMeta(value);
    const available = isAttachmentAvailable(value);
    const publicUrl =
      meta.uploaded && meta.remoteUrl?.startsWith("http") ? meta.remoteUrl : null;

    return {
      field,
      label: ATTACHMENT_LABELS[field],
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      url: available
        ? publicUrl ?? getAdminAttachmentProxyUrl(leadId, field)
        : null,
      uploaded: meta.uploaded,
      available,
    };
  });
}

export function isImageAttachment(attachment: AdminAttachment): boolean {
  if (attachment.mimeType?.startsWith("image/")) return true;
  return (
    attachment.field === "cedulaFrontal" ||
    attachment.field === "cedulaReverso" ||
    attachment.field === "firma"
  );
}

export function isVideoAttachment(attachment: AdminAttachment): boolean {
  if (attachment.mimeType?.startsWith("video/")) return true;
  return attachment.field === "videoVerificacion";
}

export function isLeadAttachmentField(value: string): value is LeadAttachmentField {
  return (LEAD_ATTACHMENT_FIELDS as readonly string[]).includes(value);
}

/** Rutas en Supabase Storage referenciadas por los adjuntos del lead. */
export function extractStoragePathsFromDatos(datosFormulario: unknown): string[] {
  if (!datosFormulario || typeof datosFormulario !== "object") return [];

  const datos = datosFormulario as Record<string, unknown>;
  const paths: string[] = [];

  for (const field of LEAD_ATTACHMENT_FIELDS) {
    const meta = readAttachmentMeta(datos[field]);
    if (meta.path) paths.push(meta.path);
  }

  return paths;
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

/** Convierte la fuente del adjunto en bytes listos para responder al admin. */
export async function loadAttachmentBytes(
  source: AttachmentSource,
  fetchStorageObject: (path: string) => Promise<{ buffer: Buffer; contentType: string } | null>,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (source.kind === "dataUrl") {
    const decoded = decodeDataUrl(source.dataUrl);
    if (!decoded) return null;
    return { buffer: decoded.buffer, contentType: decoded.mimeType };
  }

  if (source.kind === "storagePath") {
    const stored = await fetchStorageObject(source.path);
    if (stored) return stored;
    return null;
  }

  try {
    const response = await fetch(source.url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? source.mimeType;
    return { buffer, contentType };
  } catch {
    return null;
  }
}
