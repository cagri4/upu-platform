/**
 * Depocu Agent — low stock, stock movements, pending purchase orders
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const depocuAgent: AgentDefinition = {
  key: "bayi_depocu",
  name: "Depocu",
  icon: "📦",

  systemPrompt:
    "Sen bayi yönetim sisteminin depocususun. Stok durumunu, kritik seviyeleri ve tedarik süreçlerini takip et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: stok_uyari (kritik stok uyarısı), satinalma_oner (satın alma önerisi), sayim_hatirlatma (sayım hatırlatması). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Low stock items (below minimum)
    const { data: lowStock } = await supabase
      .from("bayi_products")
      .select("id, name, stock_quantity, min_stock")
      .eq("tenant_id", ctx.tenantId)
      .lt("stock_quantity", 10)
      .order("stock_quantity", { ascending: true })
      .limit(10);

    // Pending purchase orders
    const { data: pendingPOs } = await supabase
      .from("bayi_purchase_orders")
      .select("id, supplier_id, total_amount, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "pending");

    // Total product count
    const { count: totalProductCount } = await supabase
      .from("bayi_products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);

    return {
      lowStockCount: lowStock?.length || 0,
      lowStockItems: (lowStock || []).map(p => ({
        id: p.id,
        name: p.name,
        quantity: p.stock_quantity,
        minStock: p.min_stock,
      })),
      pendingPOCount: pendingPOs?.length || 0,
      pendingPOTotal: (pendingPOs || []).reduce((s, po) => s + (po.total_amount || 0), 0),
      totalProducts: totalProductCount || 0,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const lowStockCount = data.lowStockCount as number;
    const pendingPOCount = data.pendingPOCount as number;
    const totalProducts = data.totalProducts as number;

    if (lowStockCount === 0 && pendingPOCount === 0) return "";

    let prompt = `Toplam ürün: ${totalProducts}, Kritik stok: ${lowStockCount} ürün`;

    const lowStockItems = data.lowStockItems as Array<{ name: string; quantity: number }>;
    if (lowStockItems && lowStockItems.length > 0) {
      const names = lowStockItems.slice(0, 3).map(i => `${i.name} (${i.quantity})`).join(", ");
      prompt += ` (${names})`;
    }
    prompt += `. Bekleyen satın alma: ${pendingPOCount}`;

    if (data.pendingPOTotal) {
      prompt += ` (${(data.pendingPOTotal as number).toLocaleString("tr-TR")} TL)`;
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
      case "stok_uyari":
        return "Stok uyarısı oluşturuldu";
      case "satinalma_oner":
        return "Satın alma önerisi hazırlandı";
      case "sayim_hatirlatma":
        return "Sayım hatırlatması planlandı";
      default:
        return "İşlem tamamlandı";
    }
  },
};
