/**
 * Teknisyen Agent — maintenance tracking, overdue repairs
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const teknisyenAgent: AgentDefinition = {
  key: "sy_teknisyen",
  name: "Teknisyen",
  icon: "🔧",

  systemPrompt:
    "Sen site yönetimi teknisyenisin. Arıza ve bakım taleplerini takip eder, önceliklendirirsin. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: ariza_takip (eski arıza takibi), bakim_planla (bakım planı öner), oncelik_guncelle (öncelik değiştir). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Get user's building
    const { data: building } = await supabase
      .from("sy_buildings")
      .select("id, name")
      .eq("tenant_id", ctx.tenantId)
      .limit(1)
      .maybeSingle();

    if (!building) return { noBuilding: true };

    // Get open tickets (not completed)
    const { data: openTickets } = await supabase
      .from("sy_maintenance_tickets")
      .select("id, category, priority, status, created_at")
      .eq("building_id", building.id)
      .neq("status", "tamamlandi");

    const openCount = openTickets?.length || 0;

    // Find old tickets (status='acik' and created_at < 7 days ago)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oldTickets = (openTickets || []).filter(
      (t) => t.status === "acik" && t.created_at < sevenDaysAgo,
    );
    const oldCount = oldTickets.length;

    // Group by category
    const categoryMap: Record<string, number> = {};
    for (const t of openTickets || []) {
      const cat = t.category || "diger";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }
    const categories = Object.entries(categoryMap)
      .map(([k, v]) => `${k}(${v})`)
      .join(", ");

    return {
      buildingName: building.name,
      buildingId: building.id,
      openCount,
      oldCount,
      categories: categories || "yok",
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    if (data.noBuilding) return "";

    return (
      `Bina: ${data.buildingName}, Açık arıza: ${data.openCount}, ` +
      `7+ gün bekleyen: ${data.oldCount}, Kategoriler: ${data.categories}`
    );
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
      case "ariza_takip":
        return "Arıza takip hatırlatması oluşturuldu";
      case "bakim_planla":
        return "Bakım planı önerisi hazırlandı";
      case "oncelik_guncelle":
        return "Öncelik güncelleme önerisi not edildi";
      default:
        return "İşlem tamamlandı";
    }
  },
};
