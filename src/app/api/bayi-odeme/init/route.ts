/**
 * GET /api/bayi-odeme/init — dealers list (owner) or preset (dealer).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; role: string | null;
    capabilities: string[] | null; dealer_id: string | null;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, role, capabilities, dealer_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;

  const caps = (profile.capabilities as string[] | null) || [];
  const canRecordAny = caps.includes("*") || caps.includes(BAYI_CAPABILITIES.FINANCE_PAYMENTS);
  const canRecordOwn = caps.includes(BAYI_CAPABILITIES.FINANCE_BALANCE_OWN);
  if (!canRecordAny && !canRecordOwn) {
    return NextResponse.json({ error: "Ödeme kaydetme yetkiniz yok." }, { status: 403 });
  }

  let dealers: Array<{ id: string; name: string; balance: number }> = [];
  if (canRecordAny) {
    const { data } = await supabase
      .from("bayi_dealers")
      .select("id, company_name, balance")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .order("company_name")
      .limit(200);
    dealers = (data || []).map((d) => ({ id: d.id as string, name: d.company_name as string, balance: Number(d.balance || 0) }));
  } else if (profile.dealer_id) {
    const { data } = await supabase
      .from("bayi_dealers")
      .select("id, company_name, balance")
      .eq("id", profile.dealer_id)
      .maybeSingle();
    if (data) dealers = [{ id: data.id as string, name: data.company_name as string, balance: Number(data.balance || 0) }];
  }

  return NextResponse.json({
    success: true,
    isOwner: canRecordAny,
    presetDealerId: !canRecordAny ? profile.dealer_id : null,
    dealers,
  });
}
