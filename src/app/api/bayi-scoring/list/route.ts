/**
 * GET /api/bayi-scoring/list — admin/satis için tüm bayilerin son skor + risk durumu.
 *
 * Tek payload (Promise.all):
 *   - scores: bayi_dealer_scores son satır (period_start max) — Map dealer_id→score
 *   - risks:  bayi_churn_signals view (risk_level, signals)
 *
 * UI: bayiler liste sayfası score kolonu + filter, dashboard risk banner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "user", "satis", "muhasebe"]);

interface ScoreRow {
  dealer_id: string;
  score_total: number;
  sub_volume: number;
  sub_regularity: number;
  sub_collection: number;
  sub_trend: number;
  period_start: string;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ALLOWED_ROLES.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Yetki yok." }, { status: 403 });
  }
  const tenantId = lookup.tenantId;

  // En son skor per dealer — view yok, manuel: tüm skorları çek, dealer_id → en son satır
  const { data: allScores } = await sb
    .from("bayi_dealer_scores")
    .select("dealer_id, score_total, sub_volume, sub_regularity, sub_collection, sub_trend, period_start")
    .eq("tenant_id", tenantId)
    .order("period_start", { ascending: false })
    .limit(2000);

  const latestByDealer = new Map<string, ScoreRow>();
  for (const r of (allScores || []) as ScoreRow[]) {
    if (!latestByDealer.has(r.dealer_id)) latestByDealer.set(r.dealer_id, r);
  }

  // Risk view
  const { data: risks } = await sb
    .from("bayi_churn_signals")
    .select("dealer_id, dealer_name, company_name, risk_level, days_since_last_order, max_overdue_days, orders_last_30d, orders_prev_30d, balance, last_order_at")
    .eq("tenant_id", tenantId);

  // Liste output — dealer_id key'li merge
  const dealerScoreMap: Record<string, {
    score: number; sub: { volume: number; regularity: number; collection: number; trend: number };
    period_start: string;
  }> = {};
  for (const [id, r] of latestByDealer.entries()) {
    dealerScoreMap[id] = {
      score: Math.round(Number(r.score_total) || 0),
      sub: {
        volume: Math.round(Number(r.sub_volume) || 0),
        regularity: Math.round(Number(r.sub_regularity) || 0),
        collection: Math.round(Number(r.sub_collection) || 0),
        trend: Math.round(Number(r.sub_trend) || 0),
      },
      period_start: r.period_start,
    };
  }

  const riskList = (risks || []).map((r) => ({
    dealerId: r.dealer_id,
    dealerName: r.dealer_name || r.company_name,
    riskLevel: r.risk_level as "ok" | "watch" | "risk",
    daysSinceLastOrder: r.days_since_last_order,
    maxOverdueDays: r.max_overdue_days,
    ordersLast30d: r.orders_last_30d,
    ordersPrev30d: r.orders_prev_30d,
    balance: Number(r.balance) || 0,
    lastOrderAt: r.last_order_at,
  }));

  const summary = {
    total: riskList.length,
    risk: riskList.filter(r => r.riskLevel === "risk").length,
    watch: riskList.filter(r => r.riskLevel === "watch").length,
    ok: riskList.filter(r => r.riskLevel === "ok").length,
    scored: latestByDealer.size,
  };

  return NextResponse.json({
    success: true,
    summary,
    scores: dealerScoreMap,
    risks: riskList,
  });
}
