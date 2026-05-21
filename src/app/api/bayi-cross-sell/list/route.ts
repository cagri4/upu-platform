/**
 * GET /api/bayi-cross-sell/list — cross-sell suggestion fetcher.
 *
 * 3 mod:
 *   ?product_id=  → bu ürünün yanında alınanlar (item-page)
 *   ?dealer_id=   → bu bayinin geçmiş siparişlerinden öneri (detay sayfası)
 *   (boş)         → tenant top pairs (admin gözatma)
 *
 * Tüm sonuçlar stok+aktif ürünlerle enrich edilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["admin", "user", "satis", "muhasebe", "depocu"]);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null; invited_by: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role, invited_by",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ALLOWED.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Yetki yok." }, { status: 403 });
  }
  const tenantId = lookup.tenantId;
  const ownerId = lookup.profile.invited_by || lookup.profile.id;

  const productId = req.nextUrl.searchParams.get("product_id");
  const dealerId = req.nextUrl.searchParams.get("dealer_id");
  const limit = Math.min(20, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "5", 10)));

  // 1) Tek ürün için pair öneri
  if (productId) {
    const { data } = await sb
      .from("bayi_cross_sell_pairs")
      .select("product_b_id, score, co_occurrence_count, dealer_count")
      .eq("tenant_id", tenantId)
      .eq("product_a_id", productId)
      .order("score", { ascending: false })
      .limit(limit);

    return NextResponse.json({
      success: true,
      pairs: await enrich(sb, ownerId, (data || []).map(p => ({
        product_id: p.product_b_id,
        score: Number(p.score) || 0,
        count: p.co_occurrence_count,
        dealer_count: p.dealer_count,
      }))),
    });
  }

  // 2) Bayi geçmişine göre öneri — son 6 ay sipariş + bayinin almadıkları
  if (dealerId) {
    const sinceIso = new Date(Date.now() - 180 * 86400000).toISOString();
    const { data: orders } = await sb
      .from("bayi_orders")
      .select("id")
      .eq("dealer_id", dealerId)
      .eq("tenant_id", tenantId)
      .gte("created_at", sinceIso)
      .limit(200);
    const orderIds = (orders || []).map(o => o.id);

    let purchasedIds: string[] = [];
    if (orderIds.length > 0) {
      const { data: items } = await sb
        .from("bayi_order_items")
        .select("product_id")
        .in("order_id", orderIds);
      purchasedIds = Array.from(new Set((items || []).map(i => i.product_id).filter(Boolean)));
    }

    if (purchasedIds.length === 0) {
      return NextResponse.json({ success: true, pairs: [] });
    }

    // Pair: bayinin aldığı ürünlere bağlı olanlar (henüz alınmamış olanlar öncelik)
    const { data: pairs } = await sb
      .from("bayi_cross_sell_pairs")
      .select("product_a_id, product_b_id, score, co_occurrence_count, dealer_count")
      .eq("tenant_id", tenantId)
      .in("product_a_id", purchasedIds)
      .order("score", { ascending: false })
      .limit(200);

    const purchasedSet = new Set(purchasedIds);
    const suggestionScores = new Map<string, { score: number; count: number; dealerCount: number }>();
    for (const p of pairs || []) {
      if (purchasedSet.has(p.product_b_id)) continue; // zaten almış
      const existing = suggestionScores.get(p.product_b_id);
      const score = Number(p.score) || 0;
      if (!existing || existing.score < score) {
        suggestionScores.set(p.product_b_id, {
          score, count: p.co_occurrence_count, dealerCount: p.dealer_count,
        });
      }
    }
    const top = [...suggestionScores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit)
      .map(([pid, info]) => ({
        product_id: pid,
        score: info.score,
        count: info.count,
        dealer_count: info.dealerCount,
      }));

    return NextResponse.json({
      success: true,
      pairs: await enrich(sb, ownerId, top),
    });
  }

  // 3) Default — top pairs across tenant
  const { data: topPairs } = await sb
    .from("bayi_cross_sell_pairs")
    .select("product_a_id, product_b_id, score, co_occurrence_count, dealer_count")
    .eq("tenant_id", tenantId)
    .order("score", { ascending: false })
    .limit(limit);
  return NextResponse.json({
    success: true,
    pairs: (topPairs || []).map(p => ({
      product_a_id: p.product_a_id,
      product_b_id: p.product_b_id,
      score: Number(p.score) || 0,
      count: p.co_occurrence_count,
      dealer_count: p.dealer_count,
    })),
  });
}

interface PairOut {
  product_id: string;
  name?: string;
  code?: string | null;
  unit_price?: number;
  stock_quantity?: number;
  score: number;
  count: number;
  dealer_count: number;
}

async function enrich(
  sb: ReturnType<typeof getServiceClient>,
  ownerId: string,
  pairs: PairOut[],
): Promise<PairOut[]> {
  if (pairs.length === 0) return pairs;
  const ids = pairs.map(p => p.product_id);
  const { data: products } = await sb
    .from("bayi_products")
    .select("id, name, code, sku, unit_price, base_price, stock_quantity")
    .in("id", ids)
    .eq("user_id", ownerId);
  const map = new Map((products || []).map(p => [p.id, p]));
  return pairs
    .map(p => {
      const prod = map.get(p.product_id);
      if (!prod) return null;
      return {
        ...p,
        name: prod.name,
        code: prod.code || prod.sku || null,
        unit_price: Number(prod.unit_price || prod.base_price || 0),
        stock_quantity: Number(prod.stock_quantity) || 0,
      };
    })
    .filter((p): p is PairOut => p !== null);
}
