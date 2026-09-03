import { loadLeadForAdminDetail } from "@/application/lead/load-admin-lead-detail";
import { deleteLead } from "@/application/lead/delete-lead";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminToken, readCookie } from "@/infrastructure/auth/auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
  if (!isValidAdminToken(token, password)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const lead = await loadLeadForAdminDetail(params.id);
  if (!lead) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(
    { lead, source: "database" },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
  if (!isValidAdminToken(token, password)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await deleteLead(params.id);
  if (!result) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    attachmentsRemoved: result.attachmentsRemoved,
    source: result.storage,
  });
}
