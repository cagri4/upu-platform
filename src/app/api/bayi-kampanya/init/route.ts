/**
 * GET /api/bayi-kampanya/init — validate token + fetch products & dealers
 * for the kampanya form. Owner-only (CAMPAIGNS_CREATE).
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
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, capabilities, invited_by")
    .eq("id", magicToken.user_id)
    .single();

  if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

  const caps = (profile.capabilities as string[] | null) || [];
  const canCreate = caps.includes("*") || caps.includes(BAYI_CAPABILITIES.CAMPAIGNS_CREATE);
  if (!canCreate) return NextResponse.json({ error: "Kampanya oluşturma yetkiniz yok." }, { status: 403 });

  const ownerId = profile.invited_by || profile.id;

  const [{ data: products }, { data: dealers }] = await Promise.all([
    supabase
      .from("bayi_products")
      .select("id, name, unit_price, base_price")
      .eq("user_id", ownerId)
      .eq("is_active", true)
      .order("name")
      .limit(200),
    supabase
      .from("bayi_dealers")
      .select("id, company_name")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .order("company_name")
      .limit(200),
  ]);

  return NextResponse.json({
    success: true,
    products: (products || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.unit_price || p.base_price || 0),
    })),
    dealers: (dealers || []).map((d) => ({ id: d.id, name: d.company_name })),
  });
}
