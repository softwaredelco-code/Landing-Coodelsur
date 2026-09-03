/**
 * Subida y eliminación de adjuntos en Supabase Storage.
 *
 * Convierte capturas base64 del formulario (cédula, video, firma) en objetos
 * en el bucket configurado. Soporta claves legacy JWT y nuevas `sb_secret_`.
 *
 * @see docs/BACKEND_SETUP.md — variables `SUPABASE_*`
 */
import type { FileCapture } from "@/shared/types/credito";

interface UploadResult {
  url: string;
  path: string;
}

/** Límites en bytes */
export const UPLOAD_LIMITS = {
  image: 5 * 1024 * 1024,
  video: 15 * 1024 * 1024,
  signature: 2 * 1024 * 1024,
} as const;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "lead-attachments";

  if (!url || !key) {
    return null;
  }

  return { url, key, bucket };
}

export { getSupabaseConfig };

/** Headers compatibles con claves legacy JWT (eyJ…) y nuevas secret keys (sb_secret_…). */
export function supabaseStorageHeaders(
  key: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  if (key.startsWith("sb_secret_")) {
    return { apikey: key, ...extra };
  }
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    ...extra,
  };
}

function estimateBase64Bytes(dataUrl: string): number {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] ?? "" : dataUrl;
  return Math.floor((base64.length * 3) / 4);
}

export async function uploadBase64File(
  base64Data: string,
  fileName: string,
  contentType: string,
): Promise<UploadResult | null> {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  const size = estimateBase64Bytes(base64Data);
  const isVideo = contentType.startsWith("video/");
  const isImage = contentType.startsWith("image/");
  const limit = isVideo
    ? UPLOAD_LIMITS.video
    : isImage
      ? UPLOAD_LIMITS.image
      : UPLOAD_LIMITS.signature;

  if (size > limit) {
    throw new Error(
      `El archivo ${fileName} supera el límite de ${Math.round(limit / (1024 * 1024))} MB`,
    );
  }

  const base64Content = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;

  const buffer = Buffer.from(base64Content ?? "", "base64");
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `leads/${Date.now()}-${safeName}`;

  const uploadUrl = `${config.url}/storage/v1/object/${config.bucket}/${path}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: supabaseStorageHeaders(config.key, {
      "Content-Type": contentType,
      "x-upsert": "true",
    }),
    body: buffer,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[storage] upload failed", response.status, detail);
    return null;
  }

  const publicUrl = `${config.url}/storage/v1/object/public/${config.bucket}/${path}`;
  return { url: publicUrl, path };
}

/** URL firmada para buckets privados (válida 1 hora). */
export async function createSignedStorageUrl(path: string): Promise<string | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const response = await fetch(
    `${config.url}/storage/v1/object/sign/${config.bucket}/${path}`,
    {
      method: "POST",
      headers: supabaseStorageHeaders(config.key, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );

  if (!response.ok) {
    console.error("[storage] sign failed", response.status);
    return null;
  }

  const data = (await response.json()) as { signedURL?: string };
  if (!data.signedURL) return null;

  return data.signedURL.startsWith("http")
    ? data.signedURL
    : `${config.url}${data.signedURL}`;
}

/** Descarga un objeto de Storage con la service role key (bucket privado). */
export async function downloadStorageObject(
  path: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const response = await fetch(
    `${config.url}/storage/v1/object/${config.bucket}/${encodedPath}`,
    {
      headers: supabaseStorageHeaders(config.key),
    },
  );

  if (!response.ok) {
    console.error("[storage] download failed", response.status, path);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  return { buffer, contentType };
}

/** Elimina uno o más objetos del bucket de adjuntos. */
export async function deleteStorageObjects(paths: string[]): Promise<number> {
  const config = getSupabaseConfig();
  if (!config || paths.length === 0) return 0;

  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  let deleted = 0;

  for (const objectPath of uniquePaths) {
    const encoded = objectPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const response = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${encoded}`, {
      method: "DELETE",
      headers: supabaseStorageHeaders(config.key),
    });

    if (response.ok) deleted += 1;
  }

  return deleted;
}

function isFileCapture(value: unknown): value is FileCapture {
  return (
    typeof value === "object" &&
    value !== null &&
    "preview" in value &&
    typeof (value as FileCapture).preview === "string"
  );
}

async function persistAttachment(
  field: string,
  dataUrl: string,
  fileName: string,
  mimeType: string,
  size: number,
): Promise<Record<string, unknown>> {
  if (!dataUrl.startsWith("data:")) {
    return {
      fileName,
      mimeType,
      size,
      url: dataUrl.startsWith("http") ? dataUrl : undefined,
      uploaded: dataUrl.startsWith("http"),
    };
  }

  const uploaded = await uploadBase64File(dataUrl, `${field}-${fileName}`, mimeType);

  if (uploaded) {
    return {
      fileName,
      mimeType,
      size,
      url: uploaded.url,
      path: uploaded.path,
      uploaded: true,
    };
  }

  // Sin Storage o upload fallido: conservar preview para revisión en admin
  return {
    fileName,
    mimeType,
    size,
    uploaded: false,
    preview: dataUrl.startsWith("data:") ? dataUrl : undefined,
    note: "No se pudo subir a Storage; disponible en preview",
  };
}

export async function processFileFields(
  datos: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const processed = { ...datos };
  const fileFields = ["cedulaFrontal", "cedulaReverso", "videoVerificacion", "firma"] as const;

  await Promise.all(
    fileFields.map(async (field) => {
      const value = processed[field];

      if (isFileCapture(value)) {
        processed[field] = await persistAttachment(
          field,
          value.preview,
          value.fileName || field,
          value.mimeType || "application/octet-stream",
          value.size || estimateBase64Bytes(value.preview),
        );
        return;
      }

      if (typeof value === "string" && value.startsWith("data:")) {
        const match = value.match(/^data:([^;]+);base64,/);
        const contentType = match?.[1] ?? "application/octet-stream";
        const extension = contentType.split("/")[1]?.split("+")[0] ?? "bin";
        processed[field] = await persistAttachment(
          field,
          value,
          `${field}.${extension}`,
          contentType,
          estimateBase64Bytes(value),
        );
      }
    }),
  );

  return processed;
}
