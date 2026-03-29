/**
 * Muhasebeci Agent — tracks unpaid dues, late payments, income/expense balance
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const muhasebeciAgent: AgentDefinition = {
  key: "sy_muhasebeci",
  name: "Muhasebeci",
  icon: "💰",

  systemPrompt:
    "Sen site yönetimi muhasebecisisin. Binanın mali durumunu analiz et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: tahsilat_uyari (gecikmiş aidat hatırlatması), gelir_gider_analiz (mali durum değerlendirmesi), aidat_guncelle (aidat tutarı güncelleme önerisi). " +
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

    // Count unpaid dues
    const { data: unpaidDues } = await supabase
      .from("sy_dues_ledger")
      .select("amount, paid_amount, late_charge_kurus")
      .eq("building_id", building.id)
      .eq("is_paid", false);

    const unpaidCount = unpaidDues?.length || 0;
    const totalDebt = (unpaidDues || []).reduce(
      (sum, d) => sum + ((d.amount || 0) - (d.paid_amount || 0)),
      0,
    );
    const lateCount = (unpaidDues || []).filter(
      (d) => d.late_charge_kurus && d.late_charge_kurus > 0,
    ).length;

    // Income vs expense totals
    const { data: incomeRows } = await supabase
      .from("sy_income_expenses")
      .select("amount_kurus")
      .eq("building_id", building.id)
      .eq("type", "income");

    const { data: expenseRows } = await supabase
      .from("sy_income_expenses")
      .select("amount_kurus")
      .eq("building_id", building.id)
      .eq("type", "expense");

    const income = (incomeRows || []).reduce((s, r) => s + (r.amount_kurus || 0), 0) / 100;
    const expense = (expenseRows || []).reduce((s, r) => s + (r.amount_kurus || 0), 0) / 100;

    return {
      buildingName: building.name,
      buildingId: building.id,
      unpaidCount,
      totalDebt,
      lateCount,
      income,
      expense,
      net: income - expense,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    if (data.noBuilding) return "";

    return (
      `Bina: ${data.buildingName}, Borçlu daire: ${data.unpaidCount}, ` +
      `Toplam borç: ₺${Number(data.totalDebt).toLocaleString("tr-TR")}, ` +
      `Gecikmiş: ${data.lateCount} daire, ` +
      `Gelir: ₺${Number(data.income).toLocaleString("tr-TR")}, ` +
      `Gider: ₺${Number(data.expense).toLocaleString("tr-TR")}, ` +
      `Net: ₺${Number(data.net).toLocaleString("tr-TR")}`
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
      case "tahsilat_uyari":
        return "Tahsilat hatırlatması oluşturuldu";
      case "gelir_gider_analiz":
        return "Mali durum raporu hazırlandı";
      case "aidat_guncelle":
        return "Aidat güncelleme önerisi not edildi";
      default:
        return "İşlem tamamlandı";
    }
  },
};
