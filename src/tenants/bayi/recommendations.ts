/**
 * Bayi öneri kuralları — 5 MVP rule (pasif bayi, kritik stok, vade
 * yaklaşan, churn risk, quota dolma).
 */
import type { TenantAdapter, RecommendationRule } from "@/platform/recommendations/engine";

const inactiveDealers: RecommendationRule = {
  code: "inactive_dealers",
  title: "🔴 Pasif bayiler",
  bodyTemplate: "{{count}} bayi 30 günden uzun süredir sipariş atmadı. Hatırlatma yapmak ister misin?",
  actionType: "navigate",
  severity: "high",
  cooldownHours: 24,
  async evaluate(sb, ctx) {
    const { data } = await sb
      .from("bayi_churn_signals")
      .select("dealer_id")
      .eq("tenant_id", ctx.tenantId)
      .gte("days_since_last_order", 30);
    const ids = (data || []).map(d => d.dealer_id);
    if (ids.length < 3) return [];
    return [{
      targetIds: ids,
      payload: { count: ids.length, navigate: "/tr/bayi-risk" },
      score: Math.min(100, 60 + ids.length * 2),
    }];
  },
};

const criticalStock: RecommendationRule = {
  code: "critical_stock",
  title: "📦 Stoğu azalan ürünler",
  bodyTemplate: "{{count}} ürün kritik seviyenin altına düştü. Tedarikçi sipariş hazırla.",
  actionType: "navigate",
  severity: "high",
  cooldownHours: 24,
  async evaluate(sb, ctx) {
    const { data: prof } = await sb.from("profiles").select("invited_by").eq("id", ctx.userId).maybeSingle();
    const ownerId = (prof?.invited_by as string) || ctx.userId;
    const { data } = await sb
      .from("bayi_products")
      .select("id, name, stock_quantity, low_stock_threshold")
      .eq("user_id", ownerId)
      .eq("is_active", true);
    const critical = (data || []).filter(p => {
      const stk = Number(p.stock_quantity) || 0;
      const low = Number(p.low_stock_threshold) || 0;
      return low > 0 && stk <= low;
    });
    if (critical.length === 0) return [];
    return [{
      targetIds: critical.slice(0, 20).map(c => c.id),
      payload: { count: critical.length, navigate: "/tr/bayi-stok" },
      score: 70 + critical.length * 3,
    }];
  },
};

const overdueDue: RecommendationRule = {
  code: "overdue_dues",
  title: "⏰ Vadesi geçmiş bayiler",
  bodyTemplate: "{{count}} bayinin vadesi geçmiş — hatırlatma at.",
  actionType: "navigate",
  severity: "normal",
  cooldownHours: 24,
  async evaluate(sb, ctx) {
    const { data } = await sb
      .from("bayi_churn_signals")
      .select("dealer_id")
      .eq("tenant_id", ctx.tenantId)
      .gte("max_overdue_days", 7);
    if (!data || data.length === 0) return [];
    return [{
      targetIds: data.map(d => d.dealer_id),
      payload: { count: data.length, navigate: "/tr/bayi-vade" },
      score: 55 + data.length * 2,
    }];
  },
};

const quotaNearing: RecommendationRule = {
  code: "quota_nearing",
  title: "🎯 AI mesaj kotası dolmak üzere",
  bodyTemplate: "Bu ay {{used}}/{{limit}} mesaj kullandın. Pakete geçmek ister misin?",
  actionType: "upgrade_plan",
  severity: "normal",
  cooldownHours: 48,
  async evaluate(sb, ctx) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: quota } = await sb
      .from("agent_quotas")
      .select("used_messages, plan_key, period_end")
      .eq("user_id", ctx.userId)
      .gte("period_end", today)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!quota) return [];
    const { data: plan } = await sb
      .from("agent_plans")
      .select("monthly_message_limit")
      .eq("key", quota.plan_key)
      .maybeSingle();
    const limit = Number(plan?.monthly_message_limit) || 50;
    const used = Number(quota.used_messages) || 0;
    const pct = used / limit;
    if (pct < 0.7) return [];
    return [{
      payload: { used, limit, navigate: "/tr/bayi-billing?from=quota" },
      score: Math.round(60 + pct * 30),
    }];
  },
};

const noScoreData: RecommendationRule = {
  code: "score_low_count",
  title: "📊 Düşük skorlu bayiler",
  bodyTemplate: "{{count}} bayinin performans skoru 50 altında. Hangi alanlar zayıf incele.",
  actionType: "navigate",
  severity: "low",
  cooldownHours: 72,
  async evaluate(sb, ctx) {
    const { data } = await sb
      .from("bayi_dealer_scores")
      .select("dealer_id, score_total, period_start")
      .eq("tenant_id", ctx.tenantId)
      .order("period_start", { ascending: false })
      .limit(2000);
    const latest = new Map<string, number>();
    for (const r of data || []) {
      if (!latest.has(r.dealer_id)) latest.set(r.dealer_id, Number(r.score_total) || 0);
    }
    const lows = [...latest.entries()].filter(([, s]) => s < 50).map(([id]) => id);
    if (lows.length < 2) return [];
    return [{
      targetIds: lows,
      payload: { count: lows.length, navigate: "/tr/bayiler" },
      score: 40 + lows.length,
    }];
  },
};

export const BAYI_RECOMMENDATIONS_ADAPTER: TenantAdapter = {
  tenantKey: "bayi",
  rules: [inactiveDealers, criticalStock, overdueDue, quotaNearing, noScoreData],
};
