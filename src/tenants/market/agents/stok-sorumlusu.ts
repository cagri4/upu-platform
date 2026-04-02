/**
 * Stok Sorumlusu Agent — Product management, stock updates, expiry tracking, reorder alerts
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
import { createProposalAndNotify } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const STOK_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_products",
    description:
      "Urunleri filtrelerle oku. filter: 'all'|'low_stock'|'expiring'. low_stock_threshold: sayi.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["all", "low_stock", "expiring"], description: "Filtre turu" },
        low_stock_threshold: { type: "number", description: "Dusuk stok esigi (varsayilan 10)" },
        category: { type: "string", description: "Kategori filtresi (opsiyonel)" },
      },
      required: [],
    },
  },
  {
    name: "read_product_stats",
    description: "Stok istatistikleri: toplam urun, dusuk stok, son kullanma yaklasan, toplam deger.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_stock_quantity",
    description: "Urun stok miktarini guncelle. Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Urun ID" },
        product_name: { type: "string", description: "Urun adi (gosterim icin)" },
        new_quantity: { type: "number", description: "Yeni stok miktari" },
        reason: { type: "string", description: "Guncelleme nedeni" },
      },
      required: ["product_id", "product_name", "new_quantity"],
    },
  },
  {
    name: "flag_expiring_product",
    description: "Son kullanma tarihi yaklasan urun icin uyari olustur.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Urun ID" },
        product_name: { type: "string", description: "Urun adi" },
        expiry_date: { type: "string", description: "Son kullanma tarihi" },
        quantity: { type: "number", description: "Mevcut miktar" },
      },
      required: ["product_id", "product_name", "expiry_date"],
    },
  },
  {
    name: "suggest_reorder",
    description: "Dusuk stoklu urun icin yeniden siparis onerisi olustur.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Urun ID" },
        product_name: { type: "string", description: "Urun adi" },
        current_quantity: { type: "number", description: "Mevcut miktar" },
        suggested_order_quantity: { type: "number", description: "Onerilen siparis miktari" },
      },
      required: ["product_id", "product_name", "current_quantity", "suggested_order_quantity"],
    },
  },
  {
    name: "draft_message",
    description: "Tedarikci veya personele taslak mesaj hazirla.",
    input_schema: {
      type: "object",
      properties: {
        recipient_name: { type: "string", description: "Alici adi" },
        recipient_phone: { type: "string", description: "Telefon numarasi" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["recipient_name", "recipient_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadProducts(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  let query = supabase
    .from("mkt_products")
    .select("id, name, quantity, unit, price, category, expiry_date, min_stock")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .order("name")
    .limit(20);

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Stokta urun yok.", needsApproval: false };

  let filtered = data;
  if (input.filter === "low_stock") {
    const threshold = (input.low_stock_threshold as number) || 10;
    filtered = data.filter((p) => p.quantity <= threshold);
  } else if (input.filter === "expiring") {
    const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    filtered = data.filter((p) => p.expiry_date && p.expiry_date <= weekLater);
  }

  if (input.category) {
    filtered = filtered.filter((p) => p.category && p.category.toLowerCase().includes((input.category as string).toLowerCase()));
  }

  if (!filtered.length) return { result: "Filtre sonucu bos.", needsApproval: false };

  const list = filtered.map((p) => {
    const price = p.price ? `${Number(p.price).toLocaleString("tr-TR")} TL` : "fiyat yok";
    const expiry = p.expiry_date ? ` | SKT: ${p.expiry_date.substring(0, 10)}` : "";
    return `- [${p.id.substring(0, 8)}] ${p.name} | ${p.quantity} ${p.unit} | ${price}${expiry}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadProductStats(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: products } = await supabase
    .from("mkt_products")
    .select("id, name, quantity, unit, price, expiry_date, min_stock")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true);

  if (!products?.length) return { result: "Stokta urun yok.", needsApproval: false };

  const count = products.length;
  const lowStock = products.filter((p) => p.quantity <= (p.min_stock || 10)).length;

  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const expiringSoon = products.filter((p) => p.expiry_date && p.expiry_date <= weekLater).length;

  const totalValue = products.reduce((s, p) => s + (p.price || 0) * (p.quantity || 0), 0);

  const lines = [
    `Toplam: ${count} urun`,
    `Dusuk stok: ${lowStock}`,
    `SKT yaklasan (7 gun): ${expiringSoon}`,
    `Toplam stok degeri: ${totalValue.toLocaleString("tr-TR")} TL`,
  ];

  return { result: lines.join("\n"), needsApproval: false };
}

async function handleUpdateStockQuantity(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const name = input.product_name as string;
  const newQty = input.new_quantity as number;
  const reason = (input.reason as string) || "";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "mkt_stokSorumlusu",
    actionType: "update_stock_quantity",
    actionData: { product_id: input.product_id, new_quantity: newQty },
    message: `"${name}" stok miktari ${newQty} olarak guncellensin mi?${reason ? `\n${reason}` : ""}`,
    buttonLabel: "Guncelle",
  });
}

async function handleFlagExpiringProduct(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const name = input.product_name as string;
  const expiry = input.expiry_date as string;
  const qty = input.quantity as number || 0;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "mkt_stokSorumlusu",
    actionType: "flag_expiring",
    actionData: { product_id: input.product_id, product_name: name, expiry_date: expiry },
    message: `"${name}" son kullanma tarihi yaklasıyor: ${expiry}\nMevcut stok: ${qty}\nIndirim kampanyasi olusturulsun mu?`,
    buttonLabel: "Kampanya olustur",
  });
}

async function handleSuggestReorder(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const name = input.product_name as string;
  const current = input.current_quantity as number;
  const suggested = input.suggested_order_quantity as number;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "mkt_stokSorumlusu",
    actionType: "create_reorder",
    actionData: { product_id: input.product_id, product_name: name, order_quantity: suggested },
    message: `"${name}" stok dusuk (${current} adet). ${suggested} adet siparis olusturulsun mu?`,
    buttonLabel: "Siparis olustur",
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
    agentKey: "mkt_stokSorumlusu",
    actionType: "send_whatsapp",
    actionData: { phone: input.recipient_phone, message: input.message_text },
    message: `*${input.recipient_name}* kisisine mesaj taslagi:\n\n${input.recipient_phone}\n_${input.message_text}_`,
    buttonLabel: "Gonder",
  });
}

const stokToolHandlers: Record<string, ToolHandler> = {
  read_products: (input, ctx) => handleReadProducts(input, ctx),
  read_product_stats: (input, ctx) => handleReadProductStats(input, ctx),
  update_stock_quantity: handleUpdateStockQuantity,
  flag_expiring_product: handleFlagExpiringProduct,
  suggest_reorder: handleSuggestReorder,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const stokSorumlusuAgent: AgentDefinition = {
  key: "mkt_stokSorumlusu",
  name: "Stok Sorumlusu",
  icon: "📦",
  tools: STOK_TOOLS,
  toolHandlers: stokToolHandlers,

  systemPrompt:
    `Sen marketin stok sorumlusun. Gorevlerin:\n` +
    `- Urun stok durumunu takip etmek\n` +
    `- Dusuk stoklu urunleri tespit edip yeniden siparis onermek\n` +
    `- Son kullanma tarihi yaklasan urunleri tespit edip uyarmak\n` +
    `- Stok sayim farklarini raporlamak\n\n` +
    `## Kullanabilecegin Araclar\n` +
    `- read_products: Urunleri oku (filtreli)\n` +
    `- read_product_stats: Stok istatistikleri\n` +
    `- update_stock_quantity: Stok miktari guncelle (onay gerektirir)\n` +
    `- flag_expiring_product: SKT uyarisi olustur (onay gerektirir)\n` +
    `- suggest_reorder: Yeniden siparis onerisi (onay gerektirir)\n` +
    `- draft_message: Taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullaniciya bildirim gonder\n` +
    `- read_db: Veritabanindan veri oku\n\n` +
    `## Kurallar\n` +
    `- Her kritik aksiyon icin kullanici onayi al.\n` +
    `- Once veri topla, sonra analiz et, sonra aksiyon oner.\n` +
    `- Kullanici tercihlerine (agent_config) gore davran.\n` +
    `- Yapilacak bir sey yoksa hicbir tool cagirma, kisa bir Turkce ozet yaz.\n` +
    `- Turkce yanit ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "mkt_stokSorumlusu");

    const { data: products } = await supabase
      .from("mkt_products")
      .select("id, name, quantity, unit, price, category, expiry_date, min_stock")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);

    const recentMessages = await getRecentMessages(ctx.userId, "mkt_stokSorumlusu", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "mkt_stokSorumlusu", 5);

    if (!products?.length) {
      return { count: 0, recentDecisions: [], messageHistory: [], agentConfig: config };
    }

    const count = products.length;
    const lowStock = products.filter((p) => p.quantity <= (p.min_stock || 10));
    const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const expiringSoon = products.filter((p) => p.expiry_date && p.expiry_date <= weekLater);
    const totalValue = products.reduce((s, p) => s + (p.price || 0) * (p.quantity || 0), 0);

    return {
      count,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.slice(0, 5).map((p) => `${p.name}: ${p.quantity} ${p.unit}`),
      expiringCount: expiringSoon.length,
      expiringItems: expiringSoon.slice(0, 5).map((p) => `${p.name}: SKT ${p.expiry_date?.substring(0, 10)}`),
      totalValue,
      agentConfig: config,
      recentDecisions: taskHistory
        .filter((t) => t.status === "done" && t.execution_log?.length)
        .slice(0, 3)
        .map((t) => ({
          date: t.created_at,
          actions: (t.execution_log || []).map((l) => `${l.action}: ${l.status}`),
        })),
      messageHistory: recentMessages.slice(-5).map((m) => ({
        role: m.role,
        content: m.content.substring(0, 200),
      })),
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    if (!data.count || (data.count as number) === 0) return "";

    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    const config = data.agentConfig as Record<string, unknown> | null;
    if (config && Object.keys(config).length > 0) {
      prompt += `\n### Kullanici Tercihleri\n`;
      for (const [key, value] of Object.entries(config)) {
        prompt += `- ${key}: ${value}\n`;
      }
      prompt += `\n`;
    }
    prompt += `### Stok Ozeti\n`;
    prompt += `- Toplam: ${data.count} urun\n`;
    prompt += `- Dusuk stok: ${data.lowStockCount}\n`;
    prompt += `- SKT yaklasan: ${data.expiringCount}\n`;
    prompt += `- Toplam stok degeri: ${Number(data.totalValue).toLocaleString("tr-TR")} TL\n`;

    if ((data.lowStockItems as string[])?.length) {
      prompt += `\n### Dusuk Stok Urunler\n`;
      for (const item of data.lowStockItems as string[]) {
        prompt += `- ${item}\n`;
      }
    }

    if ((data.expiringItems as string[])?.length) {
      prompt += `\n### SKT Yaklasan Urunler\n`;
      for (const item of data.expiringItems as string[]) {
        prompt += `- ${item}\n`;
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
      case "update_stock_quantity": {
        const { error } = await supabase
          .from("mkt_products")
          .update({ quantity: actionData.new_quantity, updated_at: new Date().toISOString() })
          .eq("id", actionData.product_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return `Stok guncellendi: ${actionData.new_quantity}`;
      }

      case "flag_expiring": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `SKT yaklasan: ${actionData.product_name}`,
          title: `SKT yaklasan: ${actionData.product_name}`,
          note: `Urun ID: ${actionData.product_id}, SKT: ${actionData.expiry_date}`,
          remind_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return "SKT hatirlatmasi olusturuldu.";
      }

      case "create_reorder": {
        // Find a supplier for this product or use first supplier
        const { data: supplier } = await supabase
          .from("mkt_suppliers")
          .select("id")
          .eq("tenant_id", ctx.tenantId)
          .eq("is_active", true)
          .limit(1)
          .single();

        if (!supplier) return "Tedarikci bulunamadi. Once tedarikci ekleyin.";

        const { data: order, error } = await supabase
          .from("mkt_orders")
          .insert({ tenant_id: ctx.tenantId, supplier_id: supplier.id, status: "pending" })
          .select("id")
          .single();

        if (error || !order) return "Siparis olusturulamadi.";

        await supabase.from("mkt_order_items").insert({
          order_id: order.id,
          tenant_id: ctx.tenantId,
          product_name: actionData.product_name as string,
          quantity: actionData.order_quantity as number,
        });

        return `Siparis olusturuldu: ${(actionData.product_name as string)} x${actionData.order_quantity}`;
      }

      case "send_whatsapp": {
        const { sendText } = await import("@/platform/whatsapp/send");
        await sendText(actionData.phone as string, actionData.message as string);
        return "Mesaj gonderildi.";
      }

      default:
        return "Islem tamamlandi.";
    }
  },
};
