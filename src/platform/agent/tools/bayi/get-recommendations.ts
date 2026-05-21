import { assertTenant, type ToolDef } from "@/platform/agent/types";

export const getRecommendationsTool: ToolDef = {
  name: "get_recommendations",
  description: "Kullanıcı için sistem-üretilen aktif öneriler (recommendation_runs status=open). Pasif bayi, kritik stok, vade, churn, quota gibi konularda 'şunu yap' tavsiyeleri. Score-sıralı. act_on_recommendation ile accept/dismiss edilir.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Maks öneri (default 5)." },
    },
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "get_recommendations");
    const limit = Math.min(20, Math.max(1, Number(input.limit) || 5));
    const { data } = await ctx.sb
      .from("recommendation_runs")
      .select("id, rule_code, title, body, action_type, severity, score, created_at, expires_at, target_ids")
      .eq("user_id", ctx.userId)
      .eq("status", "open")
      .order("score", { ascending: false })
      .limit(limit);
    return {
      total: (data || []).length,
      recommendations: (data || []).map(r => ({
        id: r.id,
        code: r.rule_code,
        title: r.title,
        body: r.body,
        action_type: r.action_type,
        severity: r.severity,
        score: Math.round(Number(r.score) || 0),
        target_count: Array.isArray(r.target_ids) ? r.target_ids.length : null,
        created_at: r.created_at,
      })),
    };
  },
};
