/**
 * Finans Analisti Agent — Pricing, campaigns, sales reports, profit margins
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

const FINANS_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_sales",
    description:
      "Satis kayitlarini oku. period: 'today'|'week'|'month'. group_by: 'product'|'day'.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "week", "month"], description: "Donem" },
        group_by: { type: "string", enum: ["product", "day"], description: "Gruplama" },
      },
      required: [],
    },
  },
  {
    name: "read_sales_stats",
    description: "Satis istatistikleri: gunluk ciro, haftalik ciro, en cok satan, ortalama sepet.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_campaigns",
    description: "Aktif kampanya listesi.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "suggest_price_update",
    description: "Fiyat guncelleme onerisi. Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Urun ID" },
        product_name: { type: "string", description: "Urun adi" },
        current_price: { type: "number", description: "Mevcut fiyat" },
        suggested_price: { type: "number", description: "Onerilen fiyat" },
        reason: { type: "string", description: "Oneri nedeni" },
      },
      required: ["product_id", "product_name", "current_price", "suggested_price"],
    },
  },
  {
    name: "suggest_campaign",
    description: "Kampanya onerisi olustur. Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Urun ID" },
        product_name: { type: "string", description: "Urun adi" },
        discount_percent: { type: "number", description: "Indirim yuzdesi" },
        duration_days: { type: "number", description: "Kampanya suresi (gun)" },
        reason: { type: "string", description: "Kampanya nedeni" },
      },
      required: ["product_id", "product_name", "discount_percent", "duration_days"],
    },
  },
  {
    name: "draft_message",
    description: "Yoneticiye veya personele taslak mesaj hazirla.",
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

async function handleReadSales(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const now = new Date();

  let startDate: Date;
  const period = (input.period as string) || "today";
  if (period === "week") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    startDate = new Date(now);
    startDate.setUTCHours(0, 0, 0, 0);
  }

  const { data, error } = await supabase
    .from("mkt_sales")
    .select("product_name, quantity, unit_price, total_amount, sold_at")
    .eq("tenant_id", ctx.tenantId)
    .gte("sold_at", startDate.toISOString())
    .order("sold_at", { ascending: false })
    .limit(100);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: `${period} doneminde satis kaydi yok.`, needsApproval: false };

  if (input.group_by === "product") {
    const map = new Map<string, { qty: number; total: number }>();
    for (const s of data) {
      const existing = map.get(s.product_name) || { qty: 0, total: 0 };
      existing.qty += s.quantity;
      existing.total += s.total_amount;
      map.set(s.product_name, existing);
    }
    const lines = Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, d]) => `- ${name}: ${d.qty} adet, ${d.total.toLocaleString("tr-TR")} TL`);
    return { result: lines.join("\n"), needsApproval: false };
  }

  const grandTotal = data.reduce((s, d) => s + d.total_amount, 0);
  const lines = data.slice(0, 20).map((s) =>
    `- ${s.product_name}: ${s.quantity} x ${s.unit_price} TL = ${s.total_amount} TL`,
  );
  lines.push(`\nToplam: ${grandTotal.toLocaleString("tr-TR")} TL`);
  return { result: lines.join("\n"), needsApproval: false };
}

async function handleReadSalesStats(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const now = new Date();

  // Today's sales
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: todaySales } = await supabase
    .from("mkt_sales")
    .select("total_amount")
    .eq("tenant_id", ctx.tenantId)
    .gte("sold_at", todayStart.toISOString());

  const dailyRevenue = (todaySales || []).reduce((s, d) => s + d.total_amount, 0);

  // This week's sales
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data: weekSales } = await supabase
    .from("mkt_sales")
    .select("total_amount")
    .eq("tenant_id", ctx.tenantId)
    .gte("sold_at", weekStart.toISOString());

  const weeklyRevenue = (weekSales || []).reduce((s, d) => s + d.total_amount, 0);

  // Top selling
  const { data: topSelling } = await supabase.rpc("mkt_top_selling_products", {
    p_tenant_id: ctx.tenantId,
    p_days: 7,
    p_limit: 5,
  });

  const lines = [
    `Gunluk ciro: ${dailyRevenue.toLocaleString("tr-TR")} TL`,
    `Haftalik ciro: ${weeklyRevenue.toLocaleString("tr-TR")} TL`,
    `Islem sayisi bugun: ${todaySales?.length || 0}`,
  ];

  if (topSelling?.length) {
    lines.push("\nEn cok satan (7 gun):");
    for (const item of topSelling) {
      lines.push(`- ${item.product_name}: ${item.total_quantity} adet, ${Number(item.total_revenue).toLocaleString("tr-TR")} TL`);
    }
  }

  return { result: lines.join("\n"), needsApproval: false };
}

async function handleReadCampaigns(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: campaigns } = await supabase
    .from("mkt_campaigns")
    .select("id, discount_percent, starts_at, ends_at, mkt_products(name)")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .gt("ends_at", new Date().toISOString())
    .order("ends_at")
    .limit(10);

  if (!campaigns?.length) return { result: "Aktif kampanya yok.", needsApproval: false };

  const list = campaigns.map((c: any) => {
    const product = Array.isArray(c.mkt_products) ? c.mkt_products[0] : c.mkt_products;
    const productName = product?.name || "-";
    const end = new Date(c.ends_at).toLocaleDateString("tr-TR");
    return `- ${productName}: %${c.discount_percent} indirim (bitis: ${end})`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleSuggestPriceUpdate(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const name = input.product_name as string;
  const currentPrice = input.current_price as number;
  const suggestedPrice = input.suggested_price as number;
  const reason = (input.reason as string) || "";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "mkt_finansAnalisti",
    actionType: "update_price",
    actionData: { product_id: input.product_id, new_price: suggestedPrice },
    message: `"${name}" fiyati ${currentPrice} TL -> ${suggestedPrice} TL olarak guncellensin mi?${reason ? `\n${reason}` : ""}`,
    buttonLabel: "Guncelle",
  });
}

async function handleSuggestCampaign(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const name = input.product_name as string;
  const discount = input.discount_percent as number;
  const days = input.duration_days as number;
  const reason = (input.reason as string) || "";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "mkt_finansAnalisti",
    actionType: "create_campaign",
    actionData: { product_id: input.product_id, discount_percent: discount, duration_days: days },
    message: `"${name}" icin %${discount} indirim, ${days} gun sureli kampanya olusturulsun mu?${reason ? `\n${reason}` : ""}`,
    buttonLabel: "Kampanya olustur",
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
    agentKey: "mkt_finansAnalisti",
    actionType: "send_whatsapp",
    actionData: { phone: input.recipient_phone, message: input.message_text },
    message: `*${input.recipient_name}* kisisine mesaj taslagi:\n\n${input.recipient_phone}\n_${input.message_text}_`,
    buttonLabel: "Gonder",
  });
}

const finansToolHandlers: Record<string, ToolHandler> = {
  read_sales: (input, ctx) => handleReadSales(input, ctx),
  read_sales_stats: (input, ctx) => handleReadSalesStats(input, ctx),
  read_campaigns: (input, ctx) => handleReadCampaigns(input, ctx),
  suggest_price_update: handleSuggestPriceUpdate,
  suggest_campaign: handleSuggestCampaign,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const finansAnalistiAgent: AgentDefinition = {
  key: "mkt_finansAnalisti",
  name: "Finans Analisti",
  icon: "💰",
  tools: FINANS_TOOLS,
  toolHandlers: finansToolHandlers,

  systemPrompt:
    `Sen marketin finans analistisin. Gorevlerin:\n` +
    `- Satis performansini analiz etmek\n` +
    `- Fiyat optimizasyonu onermek\n` +
    `- Kampanya stratejileri olusturmak\n` +
    `- Kar marji ve ciro raporlari hazirlamak\n\n` +
    `## Kullanabilecegin Araclar\n` +
    `- read_sales: Satis kayitlarini oku (filtreli)\n` +
    `- read_sales_stats: Satis istatistikleri\n` +
    `- read_campaigns: Aktif kampanyalar\n` +
    `- suggest_price_update: Fiyat guncelleme onerisi (onay gerektirir)\n` +
    `- suggest_campaign: Kampanya onerisi (onay gerektirir)\n` +
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
    const config = await getAgentConfig(ctx.userId, "mkt_finansAnalisti");
    const now = new Date();

    // Today's sales
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data: todaySales } = await supabase
      .from("mkt_sales")
      .select("product_name, quantity, total_amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("sold_at", todayStart.toISOString());

    // This week's sales
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { data: weekSales } = await supabase
      .from("mkt_sales")
      .select("total_amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("sold_at", weekStart.toISOString());

    // Active campaigns
    const { data: campaigns } = await supabase
      .from("mkt_campaigns")
      .select("id, discount_percent, ends_at, mkt_products(name)")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .gt("ends_at", now.toISOString());

    const recentMessages = await getRecentMessages(ctx.userId, "mkt_finansAnalisti", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "mkt_finansAnalisti", 5);

    const dailyRevenue = (todaySales || []).reduce((s, d) => s + d.total_amount, 0);
    const weeklyRevenue = (weekSales || []).reduce((s, d) => s + d.total_amount, 0);
    const dailyTxCount = todaySales?.length || 0;

    return {
      dailyRevenue,
      weeklyRevenue,
      dailyTxCount,
      activeCampaigns: (campaigns || []).length,
      campaignDetails: (campaigns || []).slice(0, 5).map((c: any) => {
        const product = Array.isArray(c.mkt_products) ? c.mkt_products[0] : c.mkt_products;
        return `${product?.name || "-"}: %${c.discount_percent}`;
      }),
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
    prompt += `### Satis Ozeti\n`;
    prompt += `- Gunluk ciro: ${Number(data.dailyRevenue).toLocaleString("tr-TR")} TL\n`;
    prompt += `- Haftalik ciro: ${Number(data.weeklyRevenue).toLocaleString("tr-TR")} TL\n`;
    prompt += `- Bugunku islem sayisi: ${data.dailyTxCount}\n`;
    prompt += `- Aktif kampanya: ${data.activeCampaigns}\n`;

    if ((data.campaignDetails as string[])?.length) {
      prompt += `\n### Aktif Kampanyalar\n`;
      for (const c of data.campaignDetails as string[]) {
        prompt += `- ${c}\n`;
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
      case "update_price": {
        const { error } = await supabase
          .from("mkt_products")
          .update({ price: actionData.new_price, updated_at: new Date().toISOString() })
          .eq("id", actionData.product_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return `Fiyat guncellendi: ${Number(actionData.new_price).toLocaleString("tr-TR")} TL`;
      }

      case "create_campaign": {
        const now = new Date();
        const days = actionData.duration_days as number;
        const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        const { error } = await supabase.from("mkt_campaigns").insert({
          tenant_id: ctx.tenantId,
          product_id: actionData.product_id,
          discount_percent: actionData.discount_percent,
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
          is_active: true,
        });
        if (error) return `Hata: ${error.message}`;
        return `Kampanya olusturuldu: %${actionData.discount_percent} indirim, ${days} gun.`;
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
