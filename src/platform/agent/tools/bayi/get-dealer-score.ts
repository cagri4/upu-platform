import { assertTenant, type ToolDef } from "@/platform/agent/types";

interface ScoreRow {
  dealer_id: string;
  score_total: number;
  sub_volume: number;
  sub_regularity: number;
  sub_collection: number;
  sub_trend: number;
  period_start: string;
}

export const getDealerScoreTool: ToolDef = {
  name: "get_dealer_score",
  description: "Bayi performans skorlarını (0-100) listeler. Belirli bayi (dealer_id) veya top_n (skor sıralı) sorulabilir. 4 alt-skor: hacim, düzenlilik, tahsilat, trend. Yeni tenant'ta veri 3 ay birikene kadar boş dönebilir.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      dealer_id: { type: "string", description: "Tek bayi UUID (opsiyonel)." },
      top_n: { type: "number", description: "En yüksek N skor (default 10, max 50)." },
      order: { type: "string", enum: ["desc", "asc"], description: "Sıralama (default desc — en yüksek önce)." },
    },
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "get_dealer_score");
    const dealerId = typeof input.dealer_id === "string" ? input.dealer_id : null;
    const topN = Math.min(50, Math.max(1, Number(input.top_n) || 10));
    const ascending = input.order === "asc";

    if (dealerId) {
      const { data: scores } = await ctx.sb
        .from("bayi_dealer_scores")
        .select("dealer_id, score_total, sub_volume, sub_regularity, sub_collection, sub_trend, period_start, signals")
        .eq("dealer_id", dealerId)
        .eq("tenant_id", ctx.tenantId)
        .order("period_start", { ascending: false })
        .limit(12);

      if (!scores || scores.length === 0) {
        return { dealer_id: dealerId, score: null, message: "Bu bayi için henüz skor yok (3 ay veri biriksin)." };
      }

      const latest = scores[0];
      return {
        dealer_id: dealerId,
        score: Math.round(Number(latest.score_total) || 0),
        sub: {
          volume: Math.round(Number(latest.sub_volume) || 0),
          regularity: Math.round(Number(latest.sub_regularity) || 0),
          collection: Math.round(Number(latest.sub_collection) || 0),
          trend: Math.round(Number(latest.sub_trend) || 0),
        },
        period_start: latest.period_start,
        history_weeks: scores.length,
        trend_last_4w: scores.slice(0, 4).map(s => Math.round(Number(s.score_total) || 0)),
      };
    }

    // Top-N: tüm bayilerin son skoru — manuel "latest per dealer" gerek
    const { data: allScores } = await ctx.sb
      .from("bayi_dealer_scores")
      .select("dealer_id, score_total, sub_volume, sub_regularity, sub_collection, sub_trend, period_start")
      .eq("tenant_id", ctx.tenantId)
      .order("period_start", { ascending: false })
      .limit(2000);

    const latestByDealer = new Map<string, ScoreRow>();
    for (const r of (allScores || []) as ScoreRow[]) {
      if (!latestByDealer.has(r.dealer_id)) latestByDealer.set(r.dealer_id, r);
    }
    const arr = [...latestByDealer.values()];
    arr.sort((a, b) => ascending ? Number(a.score_total) - Number(b.score_total) : Number(b.score_total) - Number(a.score_total));
    const top = arr.slice(0, topN);

    // Dealer adları
    const ids = top.map(t => t.dealer_id);
    const { data: dealers } = ids.length
      ? await ctx.sb.from("bayi_dealers").select("id, name, company_name").in("id", ids).eq("tenant_id", ctx.tenantId)
      : { data: [] };
    const nameMap = new Map((dealers || []).map(d => [d.id, d.name || d.company_name || "Bayi"]));

    return {
      total_scored: arr.length,
      ordering: ascending ? "lowest_first" : "highest_first",
      dealers: top.map(t => ({
        dealer_id: t.dealer_id,
        name: nameMap.get(t.dealer_id) || "Bayi",
        score: Math.round(Number(t.score_total) || 0),
        sub: {
          volume: Math.round(Number(t.sub_volume) || 0),
          regularity: Math.round(Number(t.sub_regularity) || 0),
          collection: Math.round(Number(t.sub_collection) || 0),
          trend: Math.round(Number(t.sub_trend) || 0),
        },
        period_start: t.period_start,
      })),
    };
  },
};
