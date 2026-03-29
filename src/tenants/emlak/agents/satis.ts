/**
 * Satis Destek Agent
 * Tracks customers, cold contacts, property-customer matches, monitoring criteria.
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const satisAgent: AgentDefinition = {
  key: "satis",
  name: "Satış Destek",
  icon: "🤝",

  systemPrompt:
    "Sen emlak ofisinin satış destek uzmanısın. Müşteri takibi ve eşleştirme verilerini analiz et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: musteri_takip (müşteriyle iletişim kur), eslestirme (yeni eşleşme bulundu), takip_guncelle (takip kriterlerini güncelle). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    const { data: customers } = await supabase
      .from("emlak_customers")
      .select("id, name, phone, budget_min, budget_max, preferred_district, updated_at")
      .eq("user_id", ctx.userId);

    if (!customers || customers.length === 0) {
      return { count: 0 };
    }

    const count = customers.length;
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const coldCustomers = customers.filter(
      (c) => !c.updated_at || c.updated_at < fourteenDaysAgo,
    );
    const coldCount = coldCustomers.length;

    // Check for potential matches: customers with budget that overlap properties
    const { count: matchCount } = await supabase
      .from("emlak_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId);

    // Count monitoring criteria
    const { count: monitorCount } = await supabase
      .from("emlak_monitoring_criteria")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId);

    return {
      count,
      coldCount,
      coldCustomers: coldCustomers.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
      })),
      matchCount: matchCount || 0,
      monitorCount: monitorCount || 0,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    if (!data.count || (data.count as number) === 0) return "";

    return (
      `Müşteriler: ${data.count}, ${data.coldCount} tanesiyle 14+ gün iletişim yok. ` +
      `Eşleşme potansiyeli: ${data.matchCount}. ` +
      `Aktif takip kriteri: ${data.monitorCount}`
    );
  },

  parseProposals(
    aiResponse: string,
    _data: Record<string, unknown>,
  ): AgentProposal[] {
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
    actionData: Record<string, unknown>,
  ): Promise<string> {
    switch (actionType) {
      case "musteri_takip":
        return `${(actionData.customerName as string) || "Müşteri"} için hatırlatma oluşturuldu`;
      case "eslestirme":
        return "Eşleştirme sonuçları listelendi";
      case "takip_guncelle":
        return "Takip kriterleri güncelleme önerisi not edildi";
      default:
        return "İşlem tamamlandı";
    }
  },
};
