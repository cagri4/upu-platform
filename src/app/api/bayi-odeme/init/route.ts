/**
 * GET /api/bayi-odeme/init — dealers list (owner) or preset (dealer).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, capabilities, dealer_id")
    .eq("id", magicToken.user_id)
    .single();
  if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

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
