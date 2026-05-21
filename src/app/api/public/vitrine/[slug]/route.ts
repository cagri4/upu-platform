/**
 * GET /api/public/vitrine/[slug] — PUBLIC vitrine endpoint (auth yok).
 * Slug → vitrine + görünür ürünler.
 * view_count atomic increment.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = getServiceClient();

  const { data: vitrine } = await sb
    .from("bayi_vitrines")
    .select("id, dealer_user_id, slug, title, subtitle, logo_url, accent_color, show_prices, visible_product_ids, theme, view_count, tenant_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!vitrine) {
    return NextResponse.json({ error: "Vitrine bulunamadı." }, { status: 404 });
  }

  // Dealer owner_id → bayi_products user_id ile eşleşir (kendi ürünleri veya
  // distributor ürünleri). Resolution: invited_by varsa o, yoksa kendi id.
  const { data: dealerProfile } = await sb
    .from("profiles")
    .select("id, invited_by, display_name")
    .eq("id", vitrine.dealer_user_id)
    .single();

  const ownerId = dealerProfile?.invited_by || dealerProfile?.id || vitrine.dealer_user_id;

  let productsQuery = sb
    .from("bayi_products")
    .select("id, name, code, sku, unit_price, base_price, stock_quantity, image_url, description, category, is_active")
    .eq("user_id", ownerId)
    .eq("is_active", true)
    .order("name");

  if (Array.isArray(vitrine.visible_product_ids) && vitrine.visible_product_ids.length > 0) {
    productsQuery = productsQuery.in("id", vitrine.visible_product_ids);
  }

  const { data: productsRaw } = await productsQuery.limit(200);
  const products = (productsRaw || []).map(p => ({
    id: p.id,
    name: p.name,
    code: p.code || p.sku || null,
    unit_price: Number(p.unit_price || p.base_price || 0),
    in_stock: Number(p.stock_quantity || 0) > 0,
    image_url: p.image_url || null,
    description: p.description || null,
    category: p.category || null,
  }));

  // Increment view_count (best-effort, fire-and-forget).
  void sb.from("bayi_vitrines")
    .update({ view_count: (vitrine.view_count || 0) + 1 })
    .eq("id", vitrine.id);

  return NextResponse.json({
    success: true,
    vitrine: {
      id: vitrine.id,
      slug: vitrine.slug,
      title: vitrine.title || dealerProfile?.display_name || "Mağaza",
      subtitle: vitrine.subtitle || null,
      logo_url: vitrine.logo_url || null,
      accent_color: vitrine.accent_color || "#4f46e5",
      show_prices: vitrine.show_prices !== false,
      dealer_name: dealerProfile?.display_name || null,
    },
    products,
  });
}
