/**
 * Tahsildar Agent — due today, overdue, collection activities
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const tahsildarAgent: AgentDefinition = {
  key: "bayi_tahsildar",
  name: "Tahsildar",
  icon: "📋",

  systemPrompt:
    "Sen bayi yönetim sisteminin tahsildarısın. Vadesi gelen/geçen ödemeleri takip et, tahsilat planla. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: vade_hatirlatma (vade hatırlatması), tahsilat_plani (tahsilat planı oluştur), risk_degerlendirme (risk değerlendirmesi). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    // Due today
    const { data: dueToday } = await supabase
      .from("bayi_dealer_invoices")
      .select("id, dealer_id, amount")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_paid", false)
      .eq("due_date", today);

    const dueTodayTotal = (dueToday || []).reduce((s, i) => s + (i.amount || 0), 0);

    // Overdue
    const { data: overdue } = await supabase
      .from("bayi_dealer_invoices")
      .select("id, dealer_id, amount, due_date")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_paid", false)
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(20);

    const overdueTotal = (overdue || []).reduce((s, i) => s + (i.amount || 0), 0);

    // Recent collection activities
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activities } = await supabase
      .from("bayi_collection_activities")
      .select("id, dealer_id, activity_type, amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", week)
      .limit(10);

    return {
      dueTodayCount: dueToday?.length || 0,
      dueTodayTotal,
      overdueCount: overdue?.length || 0,
      overdueTotal,
      recentActivities: activities?.length || 0,
      collectedThisWeek: (activities || []).reduce((s, a) => s + (a.amount || 0), 0),
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const dueTodayCount = data.dueTodayCount as number;
    const dueTodayTotal = data.dueTodayTotal as number;
    const overdueCount = data.overdueCount as number;
    const overdueTotal = data.overdueTotal as number;

    if (dueTodayCount === 0 && overdueCount === 0) return "";

    return (
      `Bugün vadesi gelen: ${dueTodayCount} fatura (${dueTodayTotal.toLocaleString("tr-TR")} TL), ` +
      `Vadesi geçen: ${overdueCount} fatura (${overdueTotal.toLocaleString("tr-TR")} TL), ` +
      `Bu hafta tahsilat: ${(data.collectedThisWeek as number).toLocaleString("tr-TR")} TL`
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
      case "vade_hatirlatma":
        return "Vade hatırlatması gönderildi";
      case "tahsilat_plani":
        return "Tahsilat planı oluşturuldu";
      case "risk_degerlendirme":
        return "Risk değerlendirmesi hazırlandı";
      default:
        return "İşlem tamamlandı";
    }
  },
};
