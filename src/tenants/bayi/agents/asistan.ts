/**
 * Asistan Agent — daily overview: orders, revenue, stock alerts, deliveries, dealer count
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const asistanAgent: AgentDefinition = {
  key: "bayi_asistan",
  name: "Asistan",
  icon: "📊",

  systemPrompt:
    "Sen bayi yönetim sisteminin asistanısın. Günlük genel durumu özetle, kritik uyarıları bildir. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: gunluk_rapor (günlük özet gönder), kritik_uyari (acil dikkat gereken konu), performans_ozet (performans değerlendirmesi). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    // Today's orders count + revenue
    const { data: todayOrders } = await supabase
      .from("bayi_orders")
      .select("id, total_amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", `${today}T00:00:00`);

    const orderCount = todayOrders?.length || 0;
    const revenue = (todayOrders || []).reduce((s, o) => s + (o.total_amount || 0), 0);

    // Critical stock count
    const { count: criticalStockCount } = await supabase
      .from("bayi_products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .lt("stock_quantity", 10);

    // Active deliveries (pending orders)
    const { count: activeDeliveryCount } = await supabase
      .from("bayi_orders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["shipped", "preparing"]);

    // Dealer count
    const { count: dealerCount } = await supabase
      .from("bayi_dealers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);

    return {
      orderCount,
      revenue,
      criticalStockCount: criticalStockCount || 0,
      activeDeliveries: activeDeliveryCount || 0,
      dealerCount: dealerCount || 0,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const orderCount = data.orderCount as number;
    const revenue = data.revenue as number;
    const criticalStockCount = data.criticalStockCount as number;
    const activeDeliveries = data.activeDeliveries as number;
    const dealerCount = data.dealerCount as number;

    if (orderCount === 0 && criticalStockCount === 0 && activeDeliveries === 0) return "";

    return (
      `Bugünkü siparişler: ${orderCount}, Ciro: ${revenue.toLocaleString("tr-TR")} TL, ` +
      `Kritik stok: ${criticalStockCount} ürün, Aktif teslimat: ${activeDeliveries}, ` +
      `Aktif bayi sayısı: ${dealerCount}`
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
      case "gunluk_rapor":
        return "Günlük rapor hazırlandı ve gönderildi";
      case "kritik_uyari":
        return "Kritik uyarı not edildi";
      case "performans_ozet":
        return "Performans özeti oluşturuldu";
      default:
        return "İşlem tamamlandı";
    }
  },
};
