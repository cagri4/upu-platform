/**
 * /api/market/stok — mkt_products liste endpoint.
 * Token doğrula + kullanıcı tenant scope'unda aktif ürünleri döndür.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("tenant_id")
    .eq("id", pt.user_id)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ success: true, products: [] });
  }

  const { data: products, error } = await sb
    .from("mkt_products")
    .select("id, name, quantity, unit, price, category, expiry_date, min_stock")
    .eq("tenant_id", profile.tenant_id)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[market:stok]", error);
    return NextResponse.json({ error: "Stok listesi yüklenemedi" }, { status: 500 });
  }

  return NextResponse.json({ success: true, products: products || [] });
}
