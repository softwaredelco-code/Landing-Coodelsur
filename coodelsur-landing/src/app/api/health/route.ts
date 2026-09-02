import { isEmailConfigured, getEmailTransport } from "@/lib/email/send";
import { isAnalyticsEnabled } from "@/lib/tracking/analytics";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    ok: true,
    demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
    database: false,
    storageConfigured: Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    witmeConfigured: Boolean(process.env.WITME_API_KEY),
    adminConfigured: Boolean(process.env.ADMIN_PASSWORD),
    emailConfigured: isEmailConfigured(),
    emailTransport: getEmailTransport(),
    cedulaVerifyConfigured: Boolean(process.env.VERIFIK_API_KEY),
    analyticsConfigured: isAnalyticsEnabled(),
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    checks.ok = false;
    checks.databaseError =
      error instanceof Error ? error.message : "No se pudo conectar a la base de datos";
  }

  return NextResponse.json(checks, { status: checks.ok ? 200 : 503 });
}
