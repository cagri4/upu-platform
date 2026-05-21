/**
 * Cross-sell co-occurrence motoru.
 *
 * Naive item-item collaborative filtering:
 *   - Son 180 gün siparişlerden ürün çiftleri çıkar
 *   - co_occurrence_count = aynı bayi × aynı ay'da çıkan A+B çift sayısı
 *   - dealer_count = kaç farklı bayide A+B beraber alındı
 *   - score = log(1 + dealer_count) × co_occurrence_count
 *
 * Her tenant için çalıştır → bayi_cross_sell_pairs upsert.
 * Cron günlük yenilir; suggestion ekranında en yüksek skorlu pair listesi.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

interface OrderItemJoin {
  order_id: string;
  product_id: string;
  dealer_id: string;
  created_at: string;
}

export async function computeCrossSellPairs(
  sb: SupabaseClient,
  tenantId: string,
): Promise<{ pairs: number; errors: string[] }> {
  const errors: string[] = [];
  const sinceIso = new Date(Date.now() - 180 * 86400000).toISOString();

  // Tenant scope siparişler + items join
  const { data: items, error } = await sb
    .from("bayi_order_items")
    .select("order_id, product_id, bayi_orders!inner(dealer_id, created_at, tenant_id)")
    .eq("tenant_id", tenantId)
    .gte("bayi_orders.created_at", sinceIso)
    .limit(20000);
  if (error) {
    errors.push(error.message);
    return { pairs: 0, errors };
  }

  // Flatten + filter
  interface JoinRow {
    order_id: string;
    product_id: string;
    bayi_orders: { dealer_id: string; created_at: string; tenant_id: string }
      | Array<{ dealer_id: string; created_at: string; tenant_id: string }>;
  }
  const rows: OrderItemJoin[] = [];
  for (const it of (items || []) as unknown as JoinRow[]) {
    const order = Array.isArray(it.bayi_orders) ? it.bayi_orders[0] : it.bayi_orders;
    if (!it.product_id || !order?.dealer_id) continue;
    rows.push({
      order_id: it.order_id,
      product_id: it.product_id,
      dealer_id: order.dealer_id,
      created_at: order.created_at,
    });
  }

  // Group by order — her sipariş içindeki ürün setini bul
  const byOrder = new Map<string, Set<string>>();
  const orderDealer = new Map<string, string>();
  for (const r of rows) {
    if (!byOrder.has(r.order_id)) byOrder.set(r.order_id, new Set());
    byOrder.get(r.order_id)!.add(r.product_id);
    orderDealer.set(r.order_id, r.dealer_id);
  }

  // Pair counters
  const pairCount = new Map<string, number>();        // "A|B" → count
  const pairDealers = new Map<string, Set<string>>(); // "A|B" → unique dealers
  for (const [oid, prods] of byOrder.entries()) {
    if (prods.size < 2) continue;
    const arr = [...prods].sort();
    const dealer = orderDealer.get(oid)!;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = `${arr[i]}|${arr[j]}`;
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
        if (!pairDealers.has(key)) pairDealers.set(key, new Set());
        pairDealers.get(key)!.add(dealer);
      }
    }
  }

  if (pairCount.size === 0) {
    return { pairs: 0, errors };
  }

  // Upsert — bidirectional (A→B ve B→A her ikisi)
  const rowsOut: Array<{
    tenant_id: string; product_a_id: string; product_b_id: string;
    co_occurrence_count: number; dealer_count: number; score: number;
    last_computed_at: string;
  }> = [];
  const now = new Date().toISOString();
  for (const [key, count] of pairCount.entries()) {
    const [a, b] = key.split("|");
    const dCount = pairDealers.get(key)!.size;
    const score = Math.round((Math.log1p(dCount) * count) * 1000) / 1000;
    // İki yön de
    rowsOut.push({
      tenant_id: tenantId, product_a_id: a, product_b_id: b,
      co_occurrence_count: count, dealer_count: dCount, score, last_computed_at: now,
    });
    rowsOut.push({
      tenant_id: tenantId, product_a_id: b, product_b_id: a,
      co_occurrence_count: count, dealer_count: dCount, score, last_computed_at: now,
    });
  }

  // Chunked upsert (PostgREST default ~1000 row limit comfortable)
  const CHUNK = 500;
  for (let i = 0; i < rowsOut.length; i += CHUNK) {
    const chunk = rowsOut.slice(i, i + CHUNK);
    const { error: upErr } = await sb
      .from("bayi_cross_sell_pairs")
      .upsert(chunk, { onConflict: "tenant_id,product_a_id,product_b_id" });
    if (upErr) errors.push(upErr.message);
  }

  return { pairs: rowsOut.length, errors };
}
