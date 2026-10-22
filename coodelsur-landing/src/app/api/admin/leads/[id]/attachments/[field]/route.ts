import { NextResponse } from "next/server";
import { isAdminRequest } from "@/infrastructure/auth/require-admin";
import {
  isLeadAttachmentField,
  loadAttachmentBytes,
  resolveAttachmentSource,
} from "@/domain/lead/attachments";
import { loadLeadAttachmentValue } from "@/application/lead/load-lead-attachment";
import { downloadStorageObject } from "@/infrastructure/storage/upload";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string; field: string } },
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isLeadAttachmentField(params.field)) {
    return NextResponse.json({ error: "Adjunto no válido" }, { status: 400 });
  }

  const attachmentValue = await loadLeadAttachmentValue(params.id, params.field);
  if (attachmentValue === null || attachmentValue === undefined) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const source = resolveAttachmentSource(attachmentValue);
  if (!source) {
    return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
  }

  if (source.kind === "storagePath") {
    const { createSignedStorageUrl } = await import("@/infrastructure/storage/upload");
    const signed = await createSignedStorageUrl(source.path);
    if (signed) {
      return NextResponse.redirect(signed, 302);
    }
  }

  if (source.kind === "remoteUrl") {
    return NextResponse.redirect(source.url, 302);
  }

  const file = await loadAttachmentBytes(source, downloadStorageObject);
  if (!file) {
    return NextResponse.json(
      { error: "No se pudo cargar el archivo. Revisa la configuración de Supabase Storage." },
      { status: 502 },
    );
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
