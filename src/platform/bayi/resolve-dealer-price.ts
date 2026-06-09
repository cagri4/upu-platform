/**
 * resolveDealerPrice — bayi × ürün × miktar → birim fiyat.
 *
 * Algoritma:
 *   1. Bayinin atanmış price_list'leri (priority ASC, sadece is_active=true)
 *   2. Geçerlilik aralığında olmayanları ele
 *   3. İlk eşleşen liste'de bu ürün için item var mı?
 *   4. Item bulunduysa: tier'lara bak (min_quantity <= miktar olan en yüksek
 *      discount_percent uygula), yoksa unit_price
 *   5. Hiç liste yoksa veya ürün hiçbir listede yoksa: products.base_price
 *      (fallback). is_active=false ise null.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolveResult {
  basePrice: number;
  unitPrice: number;
  finalPrice: number;
  discountPercent: number;
  currency: string;
  priceListId: string | null;
  priceListName: string | null;
  source: "price_list" | "fallback_base" | "not_found";
}

export async function resolveDealerPrice(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    dealerId: string;
    productId: string;
    quantity: number;
  },
): Promise<ResolveResult | null> {
  const { tenantId, dealerId, productId, quantity } = args;

  // Ürün varlığı + base price
  const { data: prod } = await sb
    .from("bayi_products")
    .select("id, base_price, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();
  if (!prod || prod.is_active === false) return null;

  const basePrice = Number(prod.base_price ?? 0);
  const today = new Date().toISOString().slice(0, 10);

  // Bayinin öncelikli liste atamaları
  const { data: assigns } = await sb
    .from("bayi_dealer_price_assignments")
    .select(
      "price_list_id, priority, bayi_price_lists(id, name, is_active, valid_from, valid_until, currency)",
    )
    .eq("tenant_id", tenantId)
    .eq("dealer_id", dealerId)
    .order("priority", { ascending: true });

  const eligibleLists: Array<{ id: string; name: string; currency: string }> = [];
  for (const a of assigns ?? []) {
    const raw = a.bayi_price_lists as unknown;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const pl = (arr[0] ?? null) as
      | { id: string; name: string; is_active: boolean; valid_from: string | null; valid_until: string | null; currency: string }
      | null;
    if (!pl || !pl.is_active) continue;
    if (pl.valid_from && pl.valid_from > today) continue;
    if (pl.valid_until && pl.valid_until < today) continue;
    eligibleLists.push({ id: pl.id, name: pl.name, currency: pl.currency });
  }

  // İlk eşleşen liste içinde ürün item'ı var mı?
  for (const list of eligibleLists) {
    const { data: item } = await sb
      .from("bayi_price_list_items")
      .select("id, unit_price, currency")
      .eq("tenant_id", tenantId)
      .eq("price_list_id", list.id)
      .eq("product_id", productId)
      .maybeSingle();

    if (!item) continue;

    const unitPrice = Number(item.unit_price);
    let discountPercent = 0;

    // Tier'ları çek
    const { data: tiers } = await sb
      .from("bayi_price_tiers")
      .select("min_quantity, discount_percent")
      .eq("tenant_id", tenantId)
      .eq("price_list_item_id", item.id)
      .lte("min_quantity", quantity)
      .order("min_quantity", { ascending: false })
      .limit(1);

    if (tiers && tiers.length > 0) {
      discountPercent = Number(tiers[0].discount_percent);
    }

    const finalPrice = +(unitPrice * (1 - discountPercent / 100)).toFixed(2);
    return {
      basePrice,
      unitPrice,
      finalPrice,
      discountPercent,
      currency: (item.currency as string) || list.currency || "TRY",
      priceListId: list.id,
      priceListName: list.name,
      source: "price_list",
    };
  }

  // Hiçbir listede ürün yok → base price fallback
  return {
    basePrice,
    unitPrice: basePrice,
    finalPrice: basePrice,
    discountPercent: 0,
    currency: "TRY",
    priceListId: null,
    priceListName: null,
    source: "fallback_base",
  };
}
