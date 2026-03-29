/**
 * Hukuk Muşaviri Agent — legal compliance reminders
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const hukukAgent: AgentDefinition = {
  key: "sy_hukukMusaviri",
  name: "Hukuk Müşaviri",
  icon: "⚖️",

  systemPrompt:
    "Sen site yönetimi hukuk müşavirisin. KMK mevzuatı, aidat borçları ve yasal süreçleri takip edersin. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: yasal_uyari (yasal süre hatırlatması), icra_takip (icra takibi öner), mevzuat_bilgi (mevzuat bilgilendirmesi). " +
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

    // Count total units
    const { count: unitCount } = await supabase
      .from("sy_units")
      .select("id", { count: "exact", head: true })
      .eq("building_id", building.id);

    // Count occupied units (units with active residents)
    const { data: occupiedUnits } = await supabase
      .from("sy_residents")
      .select("unit_id")
      .eq("building_id", building.id)
      .eq("is_active", true);

    const uniqueOccupied = new Set((occupiedUnits || []).map((r) => r.unit_id)).size;

    // Check dues 3+ months overdue (potential legal action)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsPeriod = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, "0")}`;

    const { data: severelyLate } = await supabase
      .from("sy_dues_ledger")
      .select("amount, paid_amount")
      .eq("building_id", building.id)
      .eq("is_paid", false)
      .lte("period", threeMonthsPeriod);

    const severelyLateCount = severelyLate?.length || 0;
    const lateDebt = (severelyLate || []).reduce(
      (sum, d) => sum + ((d.amount || 0) - (d.paid_amount || 0)),
      0,
    );

    return {
      buildingName: building.name,
      buildingId: building.id,
      unitCount: unitCount || 0,
      occupiedCount: uniqueOccupied,
      emptyCount: (unitCount || 0) - uniqueOccupied,
      severelyLateCount,
      lateDebt,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    if (data.noBuilding) return "";

    return (
      `Bina: ${data.buildingName}, Daire: ${data.unitCount}, ` +
      `3+ ay gecikmiş: ${data.severelyLateCount}, ` +
      `Toplam gecikmiş borç: ₺${Number(data.lateDebt).toLocaleString("tr-TR")}`
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
      case "yasal_uyari":
        return "Yasal süre hatırlatması oluşturuldu";
      case "icra_takip":
        return "İcra takip önerisi not edildi";
      case "mevzuat_bilgi":
        return "Mevzuat bilgilendirmesi hazırlandı";
      default:
        return "İşlem tamamlandı";
    }
  },
};
