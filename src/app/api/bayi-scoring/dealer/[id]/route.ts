/**
 * GET /api/bayi-scoring/dealer/[id] — tek bayi 12-hafta skor trendi.
 *
 * bayi_dealer_scores tablosundan son 12 hafta (period_start DESC, limit 12).
 * Detay sayfası "Performans" tab'ı için chart datası.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "user", "satis", "muhasebe"]);

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
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

  // Dealer aynı tenant'ta mı kontrol
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id, name, company_name, tenant_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!dealer) return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 });

  // Son 12 hafta skor
  const { data: scores } = await sb
    .from("bayi_dealer_scores")
    .select("period_start, period_end, score_total, sub_volume, sub_regularity, sub_collection, sub_trend, signals")
    .eq("dealer_id", id)
    .eq("tenant_id", tenantId)
    .order("period_start", { ascending: false })
    .limit(12);

  // Risk signal
  const { data: risk } = await sb
    .from("bayi_churn_signals")
    .select("risk_level, days_since_last_order, max_overdue_days, orders_last_30d, orders_prev_30d, last_order_at")
    .eq("dealer_id", id)
    .maybeSingle();

  const trend = ((scores || []) as Array<{
    period_start: string; score_total: number;
    sub_volume: number; sub_regularity: number; sub_collection: number; sub_trend: number;
    signals: Record<string, unknown> | null;
  }>).reverse().map(r => ({
    period_start: r.period_start,
    total: Math.round(Number(r.score_total) || 0),
    volume: Math.round(Number(r.sub_volume) || 0),
    regularity: Math.round(Number(r.sub_regularity) || 0),
    collection: Math.round(Number(r.sub_collection) || 0),
    trend: Math.round(Number(r.sub_trend) || 0),
    signals: r.signals || {},
  }));

  const latest = trend.length > 0 ? trend[trend.length - 1] : null;

  return NextResponse.json({
    success: true,
    dealer: {
      id: dealer.id,
      name: dealer.name || dealer.company_name,
    },
    latest,
    trend,
    risk: risk ? {
      level: risk.risk_level as "ok" | "watch" | "risk",
      daysSinceLastOrder: risk.days_since_last_order,
      maxOverdueDays: risk.max_overdue_days,
      ordersLast30d: risk.orders_last_30d,
      ordersPrev30d: risk.orders_prev_30d,
      lastOrderAt: risk.last_order_at,
    } : null,
  });
}
