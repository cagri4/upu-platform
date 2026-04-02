/**
 * Urun Yoneticisi Agent — V2 (tool-using, memory-backed)
 *
 * Product catalog, price changes, inactive products, slow movers.
 * Uses domain tools + platform tools within the agent cycle.
 */

import type {
  AgentContext,
  AgentDefinition,
  AgentProposal,
  AgentToolDefinition,
  ToolHandler,
  ToolResult,
} from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";
import { getRecentMessages, getTaskHistory } from "@/platform/agents/memory";
import { getAgentConfig } from "@/platform/agents/setup";
import { createProposalAndNotify, formatCurrency } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const URUN_YONETICISI_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_products",
    description:
      "Ürün kataloğunu oku. Aktif ürünler, fiyat ve stok bilgisiyle.",
    input_schema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["all", "inactive", "no_price", "slow_movers"],
          description: "Filtre: all (tümü), inactive (pasif), no_price (fiyatsız), slow_movers (yavaş hareketli)",
        },
      },
      required: [],
    },
  },
  {
    name: "read_product_stats",
    description:
      "Ürün istatistikleri: toplam, pasif, fiyatsız, yavaş hareketli ürün sayıları.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_product_price",
    description: "Ürün fiyatını güncelle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Ürün ID" },
        product_name: { type: "string", description: "Ürün adı" },
        new_price: { type: "number", description: "Yeni fiyat" },
        reason: { type: "string", description: "Fiyat değişikliği sebebi (opsiyonel)" },
      },
      required: ["product_id", "product_name", "new_price"],
    },
  },
  {
    name: "toggle_product_status",
    description: "Ürünü aktif/pasif yap. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Ürün ID" },
        product_name: { type: "string", description: "Ürün adı" },
        new_status: { type: "boolean", description: "true = aktif, false = pasif" },
      },
      required: ["product_id", "product_name", "new_status"],
    },
  },
  {
    name: "draft_message",
    description: "Taslak WhatsApp mesajı. Direkt göndermez, kullanıcıya gösterir.",
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string", description: "Alıcı adı" },
        customer_phone: { type: "string", description: "Telefon numarası" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["customer_name", "customer_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadProducts(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const filter = (input.filter as string) || "all";

  if (filter === "slow_movers") {
    // Products not ordered in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentOrderItems } = await supabase
      .from("bayi_order_items")
      .select("product_id")
      .gte("created_at", thirtyDaysAgo);

    const orderedProductIds = new Set((recentOrderItems || []).map((i) => i.product_id));

    const { data: allProducts, error } = await supabase
      .from("bayi_products")
      .select("id, name, price, stock_quantity, is_active")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);

    if (error) return { result: `Hata: ${error.message}`, needsApproval: false };

    const slowMovers = (allProducts || []).filter((p) => !orderedProductIds.has(p.id));
    if (!slowMovers.length) return { result: "Yavaş hareketli ürün yok.", needsApproval: false };

    const list = slowMovers.slice(0, 20).map((p) =>
      `- [${p.id}] ${p.name} | Fiyat: ${p.price ? formatCurrency(p.price) : "Belirsiz"} | Stok: ${p.stock_quantity ?? "-"}`,
    );
    return { result: `Yavaş hareketli ürünler (${slowMovers.length}):\n${list.join("\n")}`, needsApproval: false };
  }

  // Standard filters
  let query = supabase
    .from("bayi_products")
    .select("id, name, price, stock_quantity, is_active")
    .eq("tenant_id", ctx.tenantId);

  if (filter === "inactive") {
    query = query.eq("is_active", false);
  } else if (filter === "no_price") {
    query = query.or("price.is.null,price.eq.0");
  }

  const { data, error } = await query.order("name").limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Ürün bulunamadı.", needsApproval: false };

  const list = data.map((p) => {
    const status = p.is_active ? "Aktif" : "Pasif";
    return `- [${p.id}] ${p.name} | Fiyat: ${p.price ? formatCurrency(p.price) : "Belirsiz"} | Stok: ${p.stock_quantity ?? "-"} | ${status}`;
  });
  return { result: `Ürünler (${data.length}):\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadProductStats(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  // Total
  const { count: totalCount } = await supabase
    .from("bayi_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId);

  // Inactive
  const { count: inactiveCount } = await supabase
    .from("bayi_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", false);

  // No price
  const { count: noPriceCount } = await supabase
    .from("bayi_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .or("price.is.null,price.eq.0");

  // Slow movers
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOrderItems } = await supabase
    .from("bayi_order_items")
    .select("product_id")
    .gte("created_at", thirtyDaysAgo);

  const orderedProductIds = new Set((recentOrderItems || []).map((i) => i.product_id));

  const { data: activeProducts } = await supabase
    .from("bayi_products")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true);

  const slowMoverCount = (activeProducts || []).filter((p) => !orderedProductIds.has(p.id)).length;

  const result = [
    `Toplam ürün: ${totalCount || 0}`,
    `Pasif ürün: ${inactiveCount || 0}`,
    `Fiyatsız ürün: ${noPriceCount || 0}`,
    `Yavaş hareketli (30 gün sipariş almayan): ${slowMoverCount}`,
  ].join("\n");

  return { result, needsApproval: false };
}

async function handleUpdateProductPrice(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const reasonText = input.reason ? `\n📝 ${input.reason}` : "";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "bayi_urunYoneticisi",
    actionType: "update_product_price",
    actionData: {
      product_id: input.product_id,
      product_name: input.product_name,
      new_price: input.new_price,
      reason: input.reason || null,
    },
    message: `💰 *Fiyat Güncelleme*\n\n🏷 ${input.product_name}\n💵 Yeni fiyat: ${formatCurrency(input.new_price as number)}${reasonText}`,
    buttonLabel: "✅ Güncelle",
  });
}

async function handleToggleProductStatus(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const newStatusLabel = input.new_status ? "Aktif" : "Pasif";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "bayi_urunYoneticisi",
    actionType: "toggle_product_status",
    actionData: {
      product_id: input.product_id,
      product_name: input.product_name,
      new_status: input.new_status,
    },
    message: `🔄 *Ürün Durum Değişikliği*\n\n🏷 ${input.product_name}\n📊 Yeni durum: ${newStatusLabel}`,
    buttonLabel: `✅ ${newStatusLabel} Yap`,
  });
}

async function handleDraftMessage(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "bayi_urunYoneticisi",
    actionType: "send_whatsapp",
    actionData: { phone: input.customer_phone, message: input.message_text },
    message: `✉️ *${input.customer_name}* kişisine mesaj taslağı:\n\n📱 ${input.customer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const urunYoneticisiToolHandlers: Record<string, ToolHandler> = {
  read_products: (input, ctx) => handleReadProducts(input, ctx),
  read_product_stats: (input, ctx) => handleReadProductStats(input, ctx),
  update_product_price: handleUpdateProductPrice,
  toggle_product_status: handleToggleProductStatus,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const urunYoneticisiAgent: AgentDefinition = {
  key: "bayi_urunYoneticisi",
  name: "Ürün Yöneticisi",
  icon: "🏷",
  tools: URUN_YONETICISI_TOOLS,
  toolHandlers: urunYoneticisiToolHandlers,

  systemPrompt:
    `Sen bayi yönetim sisteminin ürün yöneticisisin. Görevin ürün kataloğunu yönetmek, fiyat değişikliklerini takip etmek ve yavaş hareketli ürünleri tespit etmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_products: Ürün kataloğunu oku (filtre: all, inactive, no_price, slow_movers)\n` +
    `- read_product_stats: Ürün istatistikleri (toplam, pasif, fiyatsız, yavaş hareketli)\n` +
    `- update_product_price: Ürün fiyatı güncelle (onay gerektirir)\n` +
    `- toggle_product_status: Ürünü aktif/pasif yap (onay gerektirir)\n` +
    `- draft_message: Taslak WhatsApp mesajı (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_products, read_product_stats), sonra analiz et, sonra aksiyon öner.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran: fiyat değişim bildirimi, katalog güncelleme sıklığı, pasif ürün uyarısı.\n` +
    `- Fiyatsız ve yavaş hareketli ürünlere özellikle dikkat et.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "bayi_urunYoneticisi");

    // Total product count
    const { count: totalProductCount } = await supabase
      .from("bayi_products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);

    // Inactive products
    const { count: inactiveCount } = await supabase
      .from("bayi_products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", false);

    // Products with no price
    const { count: noPriceCount } = await supabase
      .from("bayi_products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .or("price.is.null,price.eq.0");

    // Slow movers (not ordered in 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentOrderItems } = await supabase
      .from("bayi_order_items")
      .select("product_id")
      .gte("created_at", thirtyDaysAgo);

    const orderedProductIds = new Set((recentOrderItems || []).map((i) => i.product_id));
    const { data: allActiveProducts } = await supabase
      .from("bayi_products")
      .select("id, name")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);

    const slowMovers = (allActiveProducts || []).filter((p) => !orderedProductIds.has(p.id));

    // Memory
    const recentMessages = await getRecentMessages(ctx.userId, "bayi_urunYoneticisi", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "bayi_urunYoneticisi", 5);

    return {
      totalProducts: totalProductCount || 0,
      inactiveCount: inactiveCount || 0,
      noPriceCount: noPriceCount || 0,
      slowMoverCount: slowMovers.length,
      slowMoverNames: slowMovers.slice(0, 5).map((p) => p.name),
      agentConfig: config,
      recentDecisions: taskHistory
        .filter((t) => t.status === "done" && t.execution_log?.length)
        .slice(0, 3)
        .map((t) => ({
          date: t.created_at,
          actions: (t.execution_log || []).map((l: { action: string; status: string }) => `${l.action}: ${l.status}`),
        })),
      messageHistory: recentMessages.slice(-5).map((m) => ({
        role: m.role,
        content: m.content.substring(0, 200),
      })),
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const totalProducts = data.totalProducts as number;
    const inactiveCount = data.inactiveCount as number;
    const noPriceCount = data.noPriceCount as number;
    const slowMoverCount = data.slowMoverCount as number;
    const slowMoverNames = data.slowMoverNames as string[];
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    if (inactiveCount === 0 && noPriceCount === 0 && slowMoverCount === 0) return "";

    const config = data.agentConfig as Record<string, unknown> | null;

    let prompt = `## Ürün Kataloğu Özeti\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    if (config) {
      prompt += `### Kullanıcı Tercihleri\n`;
      if (config.fiyat_degisim_bildirimi) prompt += `- Fiyat değişim bildirimi: ${config.fiyat_degisim_bildirimi === "evet" ? "Aktif" : "Kapalı"}\n`;
      if (config.katalog_guncelleme_sikligi) prompt += `- Katalog güncelleme sıklığı: ${config.katalog_guncelleme_sikligi}\n`;
      if (config.pasif_urun_uyarisi) prompt += `- Pasif ürün uyarısı: ${config.pasif_urun_uyarisi === "evet" ? "Aktif" : "Kapalı"}\n`;
      prompt += `\n`;
    }
    prompt += `- Toplam ürün: ${totalProducts}\n`;
    prompt += `- Pasif ürün: ${inactiveCount}\n`;
    prompt += `- Fiyatsız ürün: ${noPriceCount}\n`;
    prompt += `- Yavaş hareketli (30 gün sipariş almayan): ${slowMoverCount}\n`;

    if (slowMoverNames?.length) {
      prompt += `\n### Yavaş Hareketli Ürünler\n`;
      for (const name of slowMoverNames) {
        prompt += `- ${name}\n`;
      }
    }

    if (recentDecisions?.length) {
      prompt += `\n### Son Kararlar\n`;
      for (const d of recentDecisions) {
        const dt = new Date(d.date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
        prompt += `- ${dt}: ${d.actions.join(", ")}\n`;
      }
    }

    if (messageHistory?.length) {
      prompt += `\n### Son Mesajlar\n`;
      for (const m of messageHistory) {
        prompt += `[${m.role}] ${m.content}\n`;
      }
    }

    return prompt;
  },

  parseProposals(aiResponse: string): AgentProposal[] {
    try {
      const match = aiResponse.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const arr = JSON.parse(match[0]);
      if (!Array.isArray(arr)) return [];
      return arr.map((item: { type: string; message: string; priority?: string; data?: Record<string, unknown> }) => ({
        actionType: item.type,
        message: item.message,
        priority: (item.priority as "high" | "medium" | "low") || "medium",
        actionData: item.data || {},
      }));
    } catch {
      return [];
    }
  },

  async execute(ctx: AgentContext, actionType: string, actionData: Record<string, unknown>): Promise<string> {
    const supabase = getServiceClient();

    switch (actionType) {
      case "update_product_price": {
        const { error } = await supabase
          .from("bayi_products")
          .update({ price: actionData.new_price })
          .eq("id", actionData.product_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return `${actionData.product_name} fiyatı güncellendi: ${formatCurrency(actionData.new_price as number)}`;
      }

      case "toggle_product_status": {
        const { error } = await supabase
          .from("bayi_products")
          .update({ is_active: actionData.new_status })
          .eq("id", actionData.product_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        const label = actionData.new_status ? "aktif" : "pasif";
        return `${actionData.product_name} ${label} yapıldı.`;
      }

      case "send_whatsapp": {
        const { sendText } = await import("@/platform/whatsapp/send");
        await sendText(actionData.phone as string, actionData.message as string);
        return "Mesaj gönderildi.";
      }

      default:
        return "İşlem tamamlandı.";
    }
  },
};
