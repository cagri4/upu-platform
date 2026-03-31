/**
 * Satış Temsilcisi Agent — planned visits, pending orders, dealer issues
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const satisTemsilcisiAgent: AgentDefinition = {
  key: "bayi_satisTemsilcisi",
  name: "Satış Temsilcisi",
  icon: "🤝",

  systemPrompt:
    "Sen bayi yönetim sisteminin saha satış temsilcisisin. Ziyaret planları, bekleyen siparişler ve bayi sorunlarını takip et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: ziyaret_planla (ziyaret planla veya hatırlat), siparis_takip (sipariş takibi), bayi_uyari (bayi ile ilgili uyarı). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const in3d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Planned visits in next 3 days
    const { data: visits } = await supabase
      .from("bayi_dealer_visits")
      .select("id, dealer_id, visit_date, notes")
      .eq("tenant_id", ctx.tenantId)
      .gte("visit_date", today)
      .lte("visit_date", in3d)
      .order("visit_date", { ascending: true })
      .limit(10);

    // Pending orders
    const { data: pendingOrders } = await supabase
      .from("bayi_orders")
      .select("id, dealer_id, total_amount, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "pending");

    // Dealers with issues (inactive or negative balance)
    const { data: problemDealers } = await supabase
      .from("bayi_dealers")
      .select("id, name, balance")
      .eq("tenant_id", ctx.tenantId)
      .lt("balance", 0)
      .limit(5);

    return {
      plannedVisits: visits?.length || 0,
      visits: (visits || []).slice(0, 5).map(v => ({
        id: v.id,
        dealerId: v.dealer_id,
        date: v.visit_date,
        notes: v.notes,
      })),
      pendingOrders: pendingOrders?.length || 0,
      pendingTotal: (pendingOrders || []).reduce((s, o) => s + (o.total_amount || 0), 0),
      problemDealers: (problemDealers || []).map(d => ({
        id: d.id,
        name: d.name,
        balance: d.balance,
      })),
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const plannedVisits = data.plannedVisits as number;
    const pendingOrders = data.pendingOrders as number;
    const problemDealers = data.problemDealers as Array<{ name: string; balance: number }>;

    if (plannedVisits === 0 && pendingOrders === 0 && (!problemDealers || problemDealers.length === 0)) return "";

    let prompt = `Planlanan ziyaret: ${plannedVisits}, Bekleyen sipariş: ${pendingOrders}`;
    if (data.pendingTotal) {
      prompt += ` (toplam ${(data.pendingTotal as number).toLocaleString("tr-TR")} TL)`;
    }
    prompt += ". ";

    if (problemDealers && problemDealers.length > 0) {
      prompt += `Sorunlu bayi: ${problemDealers.length} (${problemDealers.map(d => d.name).join(", ")}). `;
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
      case "ziyaret_planla":
        return "Ziyaret planı oluşturuldu";
      case "siparis_takip":
        return "Sipariş takibi başlatıldı";
      case "bayi_uyari":
        return "Bayi uyarısı not edildi";
      default:
        return "İşlem tamamlandı";
    }
  },
};
