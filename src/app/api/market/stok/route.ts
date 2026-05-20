/**
 * /api/market/stok — mkt_products liste endpoint.
 * Token doğrula + kullanıcı tenant scope'unda aktif ürünleri döndür.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ tenant_id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "market",
    select: "tenant_id",
  });
  if ("error" in lookup) {
    return NextResponse.json({ success: true, products: [] });
  }

  const { data: products, error } = await sb
    .from("mkt_products")
    .select("id, name, quantity, unit, price, category, expiry_date, min_stock")
    .eq("tenant_id", lookup.tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[market:stok]", error);
    return NextResponse.json({ error: "Stok listesi yüklenemedi" }, { status: 500 });
  }

  return NextResponse.json({ success: true, products: products || [] });
}
