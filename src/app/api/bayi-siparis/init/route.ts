/**
 * GET /api/bayi-siparis/init — validate token and fetch the picker data
 * the sipariş form needs:
 *  - dealers (owner lists all; dealer sees only self so picker auto-fills)
 *  - products (owner's catalog, active + in-stock first)
 *  - caller capabilities so the UI knows whether to show the dealer
 *    dropdown or lock to the caller's own dealer_id
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; role: string | null; capabilities: string[] | null;
    dealer_id: string | null; invited_by: string | null; display_name: string | null;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, role, capabilities, dealer_id, invited_by, display_name",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;

  const caps = (profile.capabilities as string[] | null) || [];
  const isOwner = caps.includes("*");
  const isDealer = profile.role === "dealer";

  // Owner's user_id is "me" for owners, invited_by for dealers/employees.
  const ownerId = profile.invited_by || profile.id;

  // Products: owner's catalog (bayi_products.user_id = ownerId)
  const { data: products } = await supabase
    .from("bayi_products")
    .select("id, name, unit_price, base_price, stock_quantity, category")
    .eq("user_id", ownerId)
    .eq("is_active", true)
    .order("name")
    .limit(100);

  // Dealers: owner sees all, dealer sees only self.
  let dealers: Array<{ id: string; name: string }> = [];
  if (isOwner && !isDealer) {
    const { data } = await supabase
      .from("bayi_dealers")
      .select("id, company_name")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .order("company_name")
      .limit(200);
    dealers = (data || []).map((d) => ({ id: d.id as string, name: d.company_name as string }));
  } else if (isDealer && profile.dealer_id) {
    const { data } = await supabase
      .from("bayi_dealers")
      .select("id, company_name")
      .eq("id", profile.dealer_id)
      .maybeSingle();
    if (data) dealers = [{ id: data.id as string, name: data.company_name as string }];
  }

  return NextResponse.json({
    success: true,
    isOwner,
    isDealer,
    presetDealerId: isDealer ? profile.dealer_id : null,
    callerName: profile.display_name,
    dealers,
    products: (products || []).map((p) => ({
      id: p.id,
      name: p.name,
      unit_price: Number(p.unit_price || p.base_price || 0),
      stock_quantity: p.stock_quantity || 0,
      category: p.category || null,
    })),
  });
}
