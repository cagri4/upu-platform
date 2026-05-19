/**
 * GET /api/bayi-kampanya/init — validate token + fetch products & dealers
 * for the kampanya form. Owner-only (CAMPAIGNS_CREATE).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{
    tenant_id: string;
    capabilities: string[] | null;
    invited_by: string | null;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, capabilities, invited_by",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;

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
