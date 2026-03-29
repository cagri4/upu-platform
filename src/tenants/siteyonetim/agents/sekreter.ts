/**
 * Sekreter Agent — announcements, meeting reminders, communication
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const sekreterAgent: AgentDefinition = {
  key: "sy_sekreter",
  name: "Sekreter",
  icon: "📝",

  systemPrompt:
    "Sen site yönetimi sekreterisin. Bina sakinleriyle iletişimi, duyuruları ve toplantıları yönetirsin. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: duyuru_oner (duyuru öner), toplanti_hatirla (toplantı hatırlatması), sakin_bilgilendir (sakinleri bilgilendir). " +
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

    // Count active residents
    const { count: residentCount } = await supabase
      .from("sy_residents")
      .select("id", { count: "exact", head: true })
      .eq("building_id", building.id)
      .eq("is_active", true);

    // Count open maintenance tickets
    const { count: openTickets } = await supabase
      .from("sy_maintenance_tickets")
      .select("id", { count: "exact", head: true })
      .eq("building_id", building.id)
      .eq("status", "acik");

    // Recent income/expense entries in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentTxCount } = await supabase
      .from("sy_income_expenses")
      .select("id", { count: "exact", head: true })
      .eq("building_id", building.id)
      .gte("created_at", sevenDaysAgo);

    return {
      buildingName: building.name,
      buildingId: building.id,
      residentCount: residentCount || 0,
      openTickets: openTickets || 0,
      recentTxCount: recentTxCount || 0,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    if (data.noBuilding) return "";

    return (
      `Bina: ${data.buildingName}, Aktif sakin: ${data.residentCount}, ` +
      `Açık arıza: ${data.openTickets}, Son 7 gün işlem: ${data.recentTxCount}`
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
      case "duyuru_oner":
        return "Duyuru önerisi oluşturuldu";
      case "toplanti_hatirla":
        return "Toplantı hatırlatması gönderildi";
      case "sakin_bilgilendir":
        return "Sakin bilgilendirmesi hazırlandı";
      default:
        return "İşlem tamamlandı";
    }
  },
};
