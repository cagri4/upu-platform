import { assertTenant, type ToolDef } from "@/platform/agent/types";

export const suggestCrossSellTool: ToolDef = {
  name: "suggest_cross_sell",
  description: "Bir bayi için cross-sell ürün önerisi listele. Bayinin son 6 ay siparişlerine göre item-item co-occurrence pair'lerinden öneri çıkar. Stoğu olan, henüz almadığı ürünler öncelikte.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      dealer_id: { type: "string", description: "Bayi UUID." },
      product_id: { type: "string", description: "Tek ürünün yanında alınanlar (alternatif olarak)." },
      limit: { type: "number", description: "Maks öneri (default 5, max 20)." },
    },
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "suggest_cross_sell");
    const dealerId = typeof input.dealer_id === "string" ? input.dealer_id : null;
    const productId = typeof input.product_id === "string" ? input.product_id : null;
    const limit = Math.min(20, Math.max(1, Number(input.limit) || 5));

    if (!dealerId && !productId) {
      return { error: "dealer_id veya product_id gerekli." };
    }

    // Owner ID
    const { data: profile } = await ctx.sb
      .from("profiles")
      .select("id, invited_by")
      .eq("id", ctx.userId)
      .maybeSingle();
    const ownerId = (profile?.invited_by as string) || ctx.userId;

    let pairRows: Array<{ product_b_id: string; score: number; co_occurrence_count: number; dealer_count: number }> = [];

    if (productId) {
      const { data } = await ctx.sb
        .from("bayi_cross_sell_pairs")
        .select("product_b_id, score, co_occurrence_count, dealer_count")
        .eq("tenant_id", ctx.tenantId)
        .eq("product_a_id", productId)
        .order("score", { ascending: false })
        .limit(limit);
      pairRows = (data || []).map(p => ({
        product_b_id: p.product_b_id,
        score: Number(p.score) || 0,
        co_occurrence_count: p.co_occurrence_count,
        dealer_count: p.dealer_count,
      }));
    } else if (dealerId) {
      const sinceIso = new Date(Date.now() - 180 * 86400000).toISOString();
      const { data: orders } = await ctx.sb
        .from("bayi_orders")
        .select("id")
        .eq("dealer_id", dealerId)
        .eq("tenant_id", ctx.tenantId)
        .gte("created_at", sinceIso);
      const orderIds = (orders || []).map(o => o.id);
      if (orderIds.length === 0) {
        return { dealer_id: dealerId, suggestions: [], message: "Bayi son 6 ay sipariş atmadı — öneri yok." };
      }
      const { data: items } = await ctx.sb
        .from("bayi_order_items")
        .select("product_id")
        .in("order_id", orderIds);
      const purchasedIds = Array.from(new Set((items || []).map(i => i.product_id).filter(Boolean)));

      const { data: pairs } = await ctx.sb
        .from("bayi_cross_sell_pairs")
        .select("product_a_id, product_b_id, score, co_occurrence_count, dealer_count")
        .eq("tenant_id", ctx.tenantId)
        .in("product_a_id", purchasedIds)
        .order("score", { ascending: false })
        .limit(200);

      const purchasedSet = new Set(purchasedIds);
      const best = new Map<string, { score: number; count: number; dc: number }>();
      for (const p of pairs || []) {
        if (purchasedSet.has(p.product_b_id)) continue;
        const ex = best.get(p.product_b_id);
        const sc = Number(p.score) || 0;
        if (!ex || ex.score < sc) {
          best.set(p.product_b_id, { score: sc, count: p.co_occurrence_count, dc: p.dealer_count });
        }
      }
      pairRows = [...best.entries()]
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, limit)
        .map(([pid, info]) => ({
          product_b_id: pid, score: info.score,
          co_occurrence_count: info.count, dealer_count: info.dc,
        }));
    }

    if (pairRows.length === 0) {
      return { suggestions: [], message: "Henüz yeterli pair verisi yok — cron yarın yenileyecek." };
    }

    // Enrich product names
    const { data: products } = await ctx.sb
      .from("bayi_products")
      .select("id, name, code, sku, unit_price, base_price, stock_quantity")
      .in("id", pairRows.map(p => p.product_b_id))
      .eq("user_id", ownerId);
    const pmap = new Map((products || []).map(p => [p.id, p]));

    return {
      dealer_id: dealerId,
      product_id: productId,
      suggestions: pairRows
        .map(p => {
          const prod = pmap.get(p.product_b_id);
          if (!prod) return null;
          return {
            product_id: p.product_b_id,
            name: prod.name,
            code: prod.code || prod.sku || null,
            unit_price_TRY: Number(prod.unit_price || prod.base_price || 0),
            stock: Number(prod.stock_quantity) || 0,
            co_occurrence: p.co_occurrence_count,
            dealer_count: p.dealer_count,
            score: Math.round(p.score),
          };
        })
        .filter(Boolean),
    };
  },
};
