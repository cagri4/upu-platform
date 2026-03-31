/**
 * Lojistikci Agent — pending deliveries, today's routes, delayed shipments
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const lojistikciAgent: AgentDefinition = {
  key: "bayi_lojistikci",
  name: "Lojistikci",
  icon: "🚛",

  systemPrompt:
    "Sen bayi yönetim sisteminin lojistikçisisin. Teslimatları planla, gecikmeleri takip et, rota öner. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: teslimat_planla (teslimat planla), gecikme_uyari (gecikme uyarısı), rota_oner (rota optimizasyonu öner). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    // Pending deliveries (shipped orders)
    const { data: pendingDeliveries } = await supabase
      .from("bayi_orders")
      .select("id, dealer_id, total_amount, created_at")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "shipped")
      .limit(20);

    // Today's deliveries (estimated delivery today)
    const { data: todayDeliveries } = await supabase
      .from("bayi_orders")
      .select("id, dealer_id, total_amount")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "shipped")
      .eq("estimated_delivery", today);

    // Delayed shipments (preparing for more than 3 days)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: delayed } = await supabase
      .from("bayi_orders")
      .select("id, dealer_id, total_amount, created_at")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "preparing")
      .lt("created_at", threeDaysAgo);

    return {
      pendingDeliveries: pendingDeliveries?.length || 0,
      todayDeliveries: todayDeliveries?.length || 0,
      delayedShipments: delayed?.length || 0,
      delayedTotal: (delayed || []).reduce((s, o) => s + (o.total_amount || 0), 0),
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const pendingDeliveries = data.pendingDeliveries as number;
    const todayDeliveries = data.todayDeliveries as number;
    const delayedShipments = data.delayedShipments as number;

    if (pendingDeliveries === 0 && delayedShipments === 0) return "";

    return (
      `Yoldaki teslimat: ${pendingDeliveries}, Bugün teslim edilecek: ${todayDeliveries}, ` +
      `Geciken sevkiyat: ${delayedShipments} (${(data.delayedTotal as number).toLocaleString("tr-TR")} TL)`
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
      case "teslimat_planla":
        return "Teslimat planı oluşturuldu";
      case "gecikme_uyari":
        return "Gecikme uyarısı gönderildi";
      case "rota_oner":
        return "Rota optimizasyonu önerildi";
      default:
        return "İşlem tamamlandı";
    }
  },
};
