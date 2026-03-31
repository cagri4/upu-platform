/**
 * Satış Müdürü Agent — campaigns, dealer performance, sales targets
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const satisMuduruAgent: AgentDefinition = {
  key: "bayi_satisMuduru",
  name: "Satış Müdürü",
  icon: "💰",

  systemPrompt:
    "Sen bayi yönetim sisteminin satış müdürüsün. Kampanyaları, bayi performansını ve satış hedeflerini analiz et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: kampanya_oner (yeni kampanya önerisi), hedef_uyari (satış hedefi uyarısı), performans_degerlendirme (bayi performans değerlendirmesi). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Active campaigns
    const now = new Date().toISOString();
    const { data: campaigns } = await supabase
      .from("bayi_campaigns")
      .select("id, name, start_date, end_date")
      .eq("tenant_id", ctx.tenantId)
      .lte("start_date", now)
      .gte("end_date", now);

    // Dealer performance — top and bottom by order count
    const { data: dealerOrders } = await supabase
      .from("bayi_orders")
      .select("dealer_id, total_amount")
      .eq("tenant_id", ctx.tenantId);

    const dealerTotals: Record<string, number> = {};
    for (const o of dealerOrders || []) {
      if (o.dealer_id) {
        dealerTotals[o.dealer_id] = (dealerTotals[o.dealer_id] || 0) + (o.total_amount || 0);
      }
    }
    const sorted = Object.entries(dealerTotals).sort((a, b) => b[1] - a[1]);
    const topDealers = sorted.slice(0, 3);
    const bottomDealers = sorted.slice(-3);

    // Sales targets vs actual
    const { data: targets } = await supabase
      .from("bayi_sales_targets")
      .select("target_amount, actual_amount, period")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(3);

    return {
      activeCampaigns: campaigns?.length || 0,
      campaignNames: (campaigns || []).map(c => c.name).join(", "),
      topDealers,
      bottomDealers,
      targets: (targets || []).map(t => ({
        period: t.period,
        target: t.target_amount,
        actual: t.actual_amount,
        ratio: t.target_amount ? Math.round(((t.actual_amount || 0) / t.target_amount) * 100) : 0,
      })),
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const activeCampaigns = data.activeCampaigns as number;
    const targets = data.targets as Array<{ period: string; target: number; actual: number; ratio: number }>;

    if (activeCampaigns === 0 && (!targets || targets.length === 0)) return "";

    let prompt = `Aktif kampanya: ${activeCampaigns}`;
    if (data.campaignNames) prompt += ` (${data.campaignNames})`;
    prompt += ". ";

    if (targets && targets.length > 0) {
      for (const t of targets) {
        prompt += `Hedef (${t.period}): %${t.ratio} gerçekleşme. `;
      }
    }

    const top = data.topDealers as Array<[string, number]>;
    const bottom = data.bottomDealers as Array<[string, number]>;
    if (top && top.length > 0) {
      prompt += `En iyi bayi cirosu: ${top[0][1].toLocaleString("tr-TR")} TL. `;
    }
    if (bottom && bottom.length > 0) {
      prompt += `En düşük bayi cirosu: ${bottom[0][1].toLocaleString("tr-TR")} TL. `;
    }

    return prompt;
  },

  parseProposals(aiResponse: string, _data: Record<string, unknown>): AgentProposal[] {
    try {
      const match = aiResponse.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const arr = JSON.parse(match[0]) as Array<{
        type: string;
        message: string;
        priority: "high" | "medium" | "low";
        data?: Record<string, unknown>;
      }>;
      if (!Array.isArray(arr)) return [];
      return arr.map((item) => ({
        actionType: item.type,
        message: item.message,
        priority: item.priority || "medium",
        actionData: item.data || {},
      }));
    } catch {
      return [];
    }
  },

  async execute(
    _ctx: AgentContext,
    actionType: string,
    _actionData: Record<string, unknown>,
  ): Promise<string> {
    switch (actionType) {
      case "kampanya_oner":
        return "Kampanya önerisi oluşturuldu";
      case "hedef_uyari":
        return "Satış hedefi uyarısı gönderildi";
      case "performans_degerlendirme":
        return "Performans değerlendirmesi hazırlandı";
      default:
        return "İşlem tamamlandı";
    }
  },
};
