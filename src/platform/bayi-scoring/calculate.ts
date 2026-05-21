/**
 * Bayi performans skoru hesabı.
 *
 * Skor formülü (toplam = 4 alt-skor ortalaması, hepsi 0-100):
 *   1. sub_volume      Son 90 gün sipariş hacmi, tenant peer ortalamasına göre normalize.
 *                      P50 = 50, P90 = 100, P10 = 20.
 *   2. sub_regularity  Sipariş aralık varyansı (düşük std = yüksek skor).
 *                      Tek sipariş = 30, düzenli (std<7g) = 90+.
 *   3. sub_collection  Vade uyumu — son 6 ayda ödenmiş satışların %, geç-tahsilat
 *                      düşürür. Hiç satış/vade yoksa 70 (neutral).
 *   4. sub_trend       Son 30g hacim / önceki 30g hacim. 1.0 = 60, 1.5 = 90, 0.5 = 30.
 *
 * Snapshot weekly: cron her Pazartesi 02:00 — ISO-week başı period_start.
 * Hafta ortasında çağrı yapılırsa overwrite (UNIQUE dealer×period_start).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

interface DealerRow {
  id: string;
  tenant_id: string;
  balance: number | null;
  created_at: string;
}

interface OrderRow {
  dealer_id: string;
  created_at: string;
  total_amount: number | null;
}

interface TxRow {
  dealer_id: string;
  transaction_type_id: string;
  amount: number;
  due_date: string | null;
  transaction_date: string;
}

interface PeerVolume {
  dealer_id: string;
  vol_90d: number;
}

interface ScoreResult {
  dealer_id: string;
  tenant_id: string;
  sub_volume: number;
  sub_regularity: number;
  sub_collection: number;
  sub_trend: number;
  score_total: number;
  signals: Record<string, unknown>;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function isoMondayStart(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;          // 1..7, Mon=1
  if (day > 1) x.setUTCDate(x.getUTCDate() - (day - 1));
  return x.toISOString().slice(0, 10);
}

function calcRegularity(orders: OrderRow[]): number {
  if (orders.length === 0) return 0;
  if (orders.length === 1) return 30;
  // Sıraladıktan sonra ardışık günler arası std
  const sorted = [...orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const g = (new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime()) / 86400000;
    gaps.push(g);
  }
  const mean = gaps.reduce((s, x) => s + x, 0) / gaps.length;
  const variance = gaps.reduce((s, x) => s + (x - mean) ** 2, 0) / gaps.length;
  const std = Math.sqrt(variance);
  // std 0 → 100, std 7 → 90, std 14 → 75, std 30 → 45
  return clamp(Math.round(100 - std * 2), 0, 100);
}

function calcVolume(myVol: number, peerSorted: number[]): number {
  if (peerSorted.length === 0) return 50;
  const p10 = percentile(peerSorted, 10);
  const p50 = percentile(peerSorted, 50);
  const p90 = percentile(peerSorted, 90);
  if (myVol <= p10) return clamp(Math.round((myVol / Math.max(1, p10)) * 20), 0, 20);
  if (myVol <= p50) return Math.round(20 + ((myVol - p10) / Math.max(1, p50 - p10)) * 30);
  if (myVol <= p90) return Math.round(50 + ((myVol - p50) / Math.max(1, p90 - p50)) * 40);
  return clamp(Math.round(90 + Math.min(10, (myVol - p90) / Math.max(1, p90) * 10)), 90, 100);
}

function calcCollection(saleTotal: number, paidTotal: number, maxOverdueDays: number): number {
  if (saleTotal <= 0) return 70;  // neutral
  const paidRatio = clamp(paidTotal / saleTotal, 0, 1);
  let base = Math.round(paidRatio * 100);
  // Overdue ceza: 7 gün -10, 30 gün -25, 60 gün -40
  if (maxOverdueDays >= 60) base -= 40;
  else if (maxOverdueDays >= 30) base -= 25;
  else if (maxOverdueDays >= 7) base -= 10;
  return clamp(base, 0, 100);
}

function calcTrend(recentVol: number, previousVol: number): number {
  if (previousVol <= 0 && recentVol <= 0) return 50;
  if (previousVol <= 0) return 75;  // yeni başlayan = pozitif sinyal
  const ratio = recentVol / previousVol;
  // 0 = 0, 0.5 = 30, 1 = 60, 1.5 = 90, 2+ = 100
  if (ratio >= 2) return 100;
  if (ratio >= 1) return Math.round(60 + (ratio - 1) * 60);
  return Math.round(60 * ratio);
}

export async function calculateScoresForTenant(
  sb: SupabaseClient,
  tenantId: string,
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  const periodStart = isoMondayStart(new Date());
  const periodEndDate = new Date(`${periodStart}T00:00:00Z`);
  periodEndDate.setUTCDate(periodEndDate.getUTCDate() + 7);
  const periodEnd = periodEndDate.toISOString().slice(0, 10);

  const ninetyAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sixtyAgo = new Date(Date.now() - 60 * 86400000).toISOString();
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();

  // 1. Tenant dealer'ları
  const { data: dealers } = await sb
    .from("bayi_dealers")
    .select("id, tenant_id, balance, created_at")
    .eq("tenant_id", tenantId)
    .neq("is_active", false);
  if (!dealers || dealers.length === 0) return { inserted: 0, errors };

  const dealerIds = dealers.map((d: DealerRow) => d.id);

  // 2. Son 90g sipariş datası — peer volume için
  const { data: orders } = await sb
    .from("bayi_orders")
    .select("dealer_id, created_at, total_amount")
    .eq("tenant_id", tenantId)
    .in("dealer_id", dealerIds)
    .gte("created_at", ninetyAgo);

  const orderRows = (orders || []) as OrderRow[];
  const ordersByDealer = new Map<string, OrderRow[]>();
  for (const o of orderRows) {
    if (!ordersByDealer.has(o.dealer_id)) ordersByDealer.set(o.dealer_id, []);
    ordersByDealer.get(o.dealer_id)!.push(o);
  }

  // Peer 90d volume listesi (tenant scope)
  const peerVolumes: PeerVolume[] = dealers.map((d: DealerRow) => ({
    dealer_id: d.id,
    vol_90d: (ordersByDealer.get(d.id) || []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
  }));
  const peerVolSorted = [...peerVolumes.map(p => p.vol_90d)].sort((a, b) => a - b);

  // 3. Transactions — collection sub-score için
  const { data: txTypes } = await sb
    .from("bayi_transaction_types")
    .select("id, code");
  const saleTypeId = (txTypes || []).find((t) => t.code === "sale")?.id;
  const paymentTypeId = (txTypes || []).find((t) => t.code === "payment")?.id;

  const { data: txs } = await sb
    .from("bayi_dealer_transactions")
    .select("dealer_id, transaction_type_id, amount, due_date, transaction_date")
    .in("dealer_id", dealerIds)
    .gte("transaction_date", sixMonthsAgo);
  const txRows = (txs || []) as TxRow[];

  // 4. Her dealer için skoru hesapla
  const today = Date.now();
  const results: ScoreResult[] = [];
  for (const d of dealers as DealerRow[]) {
    const myOrders = ordersByDealer.get(d.id) || [];
    const myVol90 = myOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const myVol30 = myOrders
      .filter(o => new Date(o.created_at).toISOString() >= thirtyAgo)
      .reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const myVolPrev30 = myOrders
      .filter(o => {
        const ts = new Date(o.created_at).toISOString();
        return ts >= sixtyAgo && ts < thirtyAgo;
      })
      .reduce((s, o) => s + (Number(o.total_amount) || 0), 0);

    const myTxs = txRows.filter(t => t.dealer_id === d.id);
    const saleTotal = saleTypeId
      ? myTxs.filter(t => t.transaction_type_id === saleTypeId).reduce((s, t) => s + (Number(t.amount) || 0), 0)
      : 0;
    const paidTotal = paymentTypeId
      ? myTxs.filter(t => t.transaction_type_id === paymentTypeId).reduce((s, t) => s + (Number(t.amount) || 0), 0)
      : 0;
    const maxOverdue = myTxs.reduce((max, t) => {
      if (!t.due_date) return max;
      const dueT = new Date(t.due_date).getTime();
      if (dueT >= today) return max;
      const days = Math.floor((today - dueT) / 86400000);
      return Math.max(max, days);
    }, 0);

    const subVol  = calcVolume(myVol90, peerVolSorted);
    const subReg  = calcRegularity(myOrders);
    const subCol  = calcCollection(saleTotal, paidTotal, maxOverdue);
    const subTr   = calcTrend(myVol30, myVolPrev30);
    const total   = Math.round((subVol + subReg + subCol + subTr) / 4);

    results.push({
      dealer_id: d.id,
      tenant_id: tenantId,
      sub_volume: subVol,
      sub_regularity: subReg,
      sub_collection: subCol,
      sub_trend: subTr,
      score_total: total,
      signals: {
        vol_90d: Math.round(myVol90),
        vol_30d: Math.round(myVol30),
        vol_prev_30d: Math.round(myVolPrev30),
        order_count_90d: myOrders.length,
        sale_total: Math.round(saleTotal),
        paid_total: Math.round(paidTotal),
        max_overdue_days: maxOverdue,
      },
    });
  }

  // 5. Upsert (UNIQUE dealer_id + period_start)
  if (results.length === 0) return { inserted: 0, errors };
  const rows = results.map(r => ({
    tenant_id: r.tenant_id,
    dealer_id: r.dealer_id,
    period_start: periodStart,
    period_end: periodEnd,
    score_total: r.score_total,
    sub_volume: r.sub_volume,
    sub_regularity: r.sub_regularity,
    sub_collection: r.sub_collection,
    sub_trend: r.sub_trend,
    signals: r.signals,
    snapshot_at: new Date().toISOString(),
  }));

  const { error } = await sb
    .from("bayi_dealer_scores")
    .upsert(rows, { onConflict: "dealer_id,period_start" });
  if (error) errors.push(error.message);

  return { inserted: results.length, errors };
}
