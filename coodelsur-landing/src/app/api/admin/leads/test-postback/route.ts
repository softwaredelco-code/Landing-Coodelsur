import { NextResponse } from "next/server";
import { isAdminRequest } from "@/infrastructure/auth/require-admin";
import {
  buildPostbackUrl,
  executePostbackCall,
  getPostbackBaseUrl,
} from "@/application/tracking/witme-postback";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    witmeId?: string;
    product?: "nanocredito" | "microcredito";
    payout?: string;
  };

  const witmeId = body.witmeId?.trim();
  const product = body.product === "microcredito" ? "microcredito" : "nanocredito";
  const payout = body.payout ?? "0";

  if (!witmeId) {
    return NextResponse.json({ error: "witmeId requerido" }, { status: 400 });
  }

  const baseUrl = getPostbackBaseUrl(product);
  const targetUrl = buildPostbackUrl(baseUrl, witmeId, payout);
  const result = await executePostbackCall(targetUrl, witmeId, product, {
    payout,
    tier: "inicial",
    tierLabel: `Prueba en $${payout} USD`,
    previousDisbursementsCount: 0,
  });

  return NextResponse.json({ success: result.success, result, targetUrl });
}
