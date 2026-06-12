/**
 * GET /api/saha/me — saha elemanı kimlik snapshot'ı (portal layout açılışında).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSahaAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getSahaAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, salesRepId, repName, region } = auth;

  const { data: tenant } = await sb
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  const { count: dealerCount } = await sb
    .from("bayi_sales_rep_dealers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", salesRepId);

  return NextResponse.json({
    success: true,
    salesRepId,
    repName,
    region,
    dealerCount: dealerCount ?? 0,
    tenantName: (tenant?.name as string) || "Dağıtıcı",
  });
}
