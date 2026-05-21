import { assertTenant, type ToolDef } from "@/platform/agent/types";

export const getChurnRisksTool: ToolDef = {
  name: "get_churn_risks",
  description: "Churn riski altındaki bayileri listeler. risk_level=risk olanlar default; 'watch' filter da geçilebilir. Son sipariş zamanı, vade gecikmesi, sipariş trendi gibi sinyalleri içerir. Recovery aksiyonu önermek için kullan.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      level: { type: "string", enum: ["risk", "watch", "all"], description: "Risk seviyesi (default 'risk' — sadece yüksek)." },
      limit: { type: "number", description: "Maks bayi (default 20, max 100)." },
    },
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "get_churn_risks");
    const level = (typeof input.level === "string" && ["risk", "watch", "all"].includes(input.level))
      ? input.level
      : "risk";
    const limit = Math.min(100, Math.max(1, Number(input.limit) || 20));

    let query = ctx.sb
      .from("bayi_churn_signals")
      .select("dealer_id, dealer_name, company_name, risk_level, days_since_last_order, max_overdue_days, orders_last_30d, orders_prev_30d, balance, last_order_at")
      .eq("tenant_id", ctx.tenantId)
      .limit(limit);

    if (level === "risk") {
      query = query.eq("risk_level", "risk");
    } else if (level === "watch") {
      query = query.in("risk_level", ["watch", "risk"]);
    }

    const { data, error } = await query;
    if (error) return { error: "Churn risk verisi alınamadı: " + error.message };

    const rows = (data || []).sort((a, b) => {
      // Risk önce, sonra en eski sipariş
      if (a.risk_level !== b.risk_level) {
        const order: Record<string, number> = { risk: 0, watch: 1, ok: 2 };
        return order[a.risk_level] - order[b.risk_level];
      }
      return (b.days_since_last_order || 0) - (a.days_since_last_order || 0);
    });

    const summary = {
      total: rows.length,
      risk: rows.filter(r => r.risk_level === "risk").length,
      watch: rows.filter(r => r.risk_level === "watch").length,
    };

    return {
      ...summary,
      dealers: rows.map(r => ({
        dealer_id: r.dealer_id,
        name: r.dealer_name || r.company_name || "Bayi",
        risk_level: r.risk_level,
        days_since_last_order: r.days_since_last_order,
        max_overdue_days: r.max_overdue_days,
        orders_last_30d: r.orders_last_30d,
        orders_prev_30d: r.orders_prev_30d,
        balance_TRY: Number(r.balance) || 0,
        last_order_at: r.last_order_at,
      })),
    };
  },
};
