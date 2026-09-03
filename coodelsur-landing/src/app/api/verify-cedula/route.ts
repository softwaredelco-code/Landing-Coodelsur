import { verifyDocumentComplete } from "@/application/identity/verify-document";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  documentType: z.string().min(1),
  documentNumber: z.string().min(1, "Número de documento requerido"),
  nombre: z.string().min(3),
  fechaNacimiento: z.string().min(1),
  fechaExpedicion: z.string().min(1),
  checkDuplicate: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const result = await verifyDocumentComplete({
      ...parsed.data,
      checkDuplicate: parsed.data.checkDuplicate ?? false,
    });

    return NextResponse.json({
      ok: result.ok,
      verification: {
        status: result.status,
        message: result.message,
        registeredName: result.registeredName,
        localChecks: result.localChecks,
      },
    });
  } catch (error) {
    console.error("[POST /api/verify-cedula]", error);
    return NextResponse.json({ error: "Error al verificar documento" }, { status: 500 });
  }
}
