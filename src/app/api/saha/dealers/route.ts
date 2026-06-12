/**
 * GET /api/saha/dealers — saha elemanına atanmış bayiler (ad-hoc check-in için).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSahaAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getSahaAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, salesRepId } = auth;

  const { data } = await sb
    .from("bayi_sales_rep_dealers")
    .select("dealer_id, bayi_dealers(name, company_name, address, region)")
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", salesRepId);

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  return NextResponse.json({
    success: true,
    items: (data ?? []).map((d) => ({
      id: d.dealer_id as string,
      name: (pick(d.bayi_dealers)?.company_name as string) || (pick(d.bayi_dealers)?.name as string) || "Bayi",
      address: (pick(d.bayi_dealers)?.address as string) || null,
      region: (pick(d.bayi_dealers)?.region as string) || null,
    })),
  });
}
