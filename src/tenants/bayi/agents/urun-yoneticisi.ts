/**
 * Urun Yoneticisi Agent — product catalog, price changes, inactive products
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const urunYoneticisiAgent: AgentDefinition = {
  key: "bayi_urunYoneticisi",
  name: "Ürün Yöneticisi",
  icon: "🏷",

  systemPrompt:
    "Sen bayi yönetim sisteminin ürün yöneticisisin. Ürün kataloğunu, fiyat değişikliklerini ve pasif ürünleri takip et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: fiyat_guncelle (fiyat güncelleme önerisi), urun_analiz (ürün analizi), katalog_uyari (katalog uyarısı). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Total product count
    const { count: totalProductCount } = await supabase
      .from("bayi_products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);

    // Inactive products
    const { data: inactiveProducts } = await supabase
      .from("bayi_products")
      .select("id, name")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", false)
      .limit(10);

    // Products with no price (needs price update)
    const { data: noPriceProducts } = await supabase
      .from("bayi_products")
      .select("id, name")
      .eq("tenant_id", ctx.tenantId)
      .or("price.is.null,price.eq.0")
      .limit(10);

    // Products not ordered in last 30 days (slow movers)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentOrderItems } = await supabase
      .from("bayi_order_items")
      .select("product_id")
      .gte("created_at", thirtyDaysAgo);

    const orderedProductIds = new Set((recentOrderItems || []).map(i => i.product_id));
    const { data: allProducts } = await supabase
      .from("bayi_products")
      .select("id, name")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);

    const slowMovers = (allProducts || []).filter(p => !orderedProductIds.has(p.id));

    return {
      totalProducts: totalProductCount || 0,
      inactiveCount: inactiveProducts?.length || 0,
      noPriceCount: noPriceProducts?.length || 0,
      slowMoverCount: slowMovers.length,
      slowMoverNames: slowMovers.slice(0, 5).map(p => p.name),
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const totalProducts = data.totalProducts as number;
    const inactiveCount = data.inactiveCount as number;
    const noPriceCount = data.noPriceCount as number;
    const slowMoverCount = data.slowMoverCount as number;

    if (inactiveCount === 0 && noPriceCount === 0 && slowMoverCount === 0) return "";

    let prompt = `Toplam ürün: ${totalProducts}, Pasif: ${inactiveCount}, Fiyatsız: ${noPriceCount}`;
    prompt += `, Son 30 gün sipariş almayan: ${slowMoverCount}`;

    const slowMoverNames = data.slowMoverNames as string[];
    if (slowMoverNames && slowMoverNames.length > 0) {
      prompt += ` (${slowMoverNames.join(", ")})`;
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
      case "fiyat_guncelle":
        return "Fiyat güncelleme önerisi oluşturuldu";
      case "urun_analiz":
        return "Ürün analizi hazırlandı";
      case "katalog_uyari":
        return "Katalog uyarısı gönderildi";
      default:
        return "İşlem tamamlandı";
    }
  },
};
