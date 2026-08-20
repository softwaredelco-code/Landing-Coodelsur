import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminToken, readCookie } from "@/lib/admin/auth";
import { getLeadFromFile, isDbConnectionError } from "@/lib/leads/file-store";

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

  try {
    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead) {
      const fileLead = getLeadFromFile(params.id);
      if (!fileLead) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }
      return NextResponse.json({ lead: fileLead, source: "file" });
    }
    return NextResponse.json({ lead, source: "database" });
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;
    const fileLead = getLeadFromFile(params.id);
    if (!fileLead) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ lead: fileLead, source: "file" });
  }
}
