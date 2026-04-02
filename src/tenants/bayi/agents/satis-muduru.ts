/**
 * Satış Müdürü Agent — V2 (tool-using, memory-backed)
 *
 * Campaigns, dealer performance, sales targets, segmentation.
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

const SATIS_MUDURU_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_campaigns",
    description:
      "Aktif kampanyaları oku. Kampanya adı, başlangıç/bitiş tarihi.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_dealer_performance",
    description:
      "Bayi performans karşılaştırması. Ciro, sipariş sayısı sıralaması.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_sales_targets",
    description:
      "Satış hedefleri ve gerçekleşme oranlarını oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_campaign_proposal",
    description: "Yeni kampanya önerisi oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Kampanya adı" },
        description: { type: "string", description: "Kampanya açıklaması" },
        start_date: { type: "string", description: "Başlangıç tarihi (ISO)" },
        end_date: { type: "string", description: "Bitiş tarihi (ISO)" },
      },
      required: ["name", "description", "start_date", "end_date"],
    },
  },
  {
    name: "flag_underperformer",
    description: "Düşük performanslı bayiyi işaretle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        dealer_id: { type: "string", description: "Bayi ID" },
        dealer_name: { type: "string", description: "Bayi adı" },
        reason: { type: "string", description: "İşaretleme sebebi" },
      },
      required: ["dealer_id", "dealer_name", "reason"],
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

async function handleReadCampaigns(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("bayi_campaigns")
    .select("id, name, start_date, end_date")
    .eq("tenant_id", ctx.tenantId)
    .lte("start_date", now)
    .gte("end_date", now);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Aktif kampanya yok.", needsApproval: false };

  const list = data.map((c) => {
    const start = new Date(c.start_date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
    const end = new Date(c.end_date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
    return `- [${c.id}] ${c.name} | ${start} – ${end}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadDealerPerformance(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: orders } = await supabase
    .from("bayi_orders")
    .select("dealer_id, total_amount")
    .eq("tenant_id", ctx.tenantId);

  if (!orders?.length) return { result: "Sipariş verisi yok.", needsApproval: false };

  // Aggregate by dealer
  const dealerTotals: Record<string, { total: number; count: number }> = {};
  for (const o of orders) {
    if (o.dealer_id) {
      if (!dealerTotals[o.dealer_id]) {
        dealerTotals[o.dealer_id] = { total: 0, count: 0 };
      }
      dealerTotals[o.dealer_id].total += o.total_amount || 0;
      dealerTotals[o.dealer_id].count += 1;
    }
  }

  // Get dealer names
  const dealerIds = Object.keys(dealerTotals);
  const { data: dealers } = await supabase
    .from("bayi_dealers")
    .select("id, name")
    .in("id", dealerIds);

  const dealerNameMap: Record<string, string> = {};
  for (const d of dealers || []) {
    dealerNameMap[d.id] = d.name;
  }

  // Sort by total descending, top 10
  const sorted = Object.entries(dealerTotals)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  const list = sorted.map(([id, stats], i) => {
    const name = dealerNameMap[id] || id;
    return `${i + 1}. ${name} | Ciro: ${formatCurrency(stats.total)} | Sipariş: ${stats.count}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadSalesTargets(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("bayi_sales_targets")
    .select("period, target_amount, actual_amount")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Satış hedefi kaydı yok.", needsApproval: false };

  const list = data.map((t) => {
    const ratio = t.target_amount
      ? Math.round(((t.actual_amount || 0) / t.target_amount) * 100)
      : 0;
    return `- ${t.period} | Hedef: ${formatCurrency(t.target_amount || 0)} | Gerçekleşen: ${formatCurrency(t.actual_amount || 0)} | %${ratio}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleCreateCampaignProposal(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const start = new Date(input.start_date as string).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  const end = new Date(input.end_date as string).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "bayi_satisMuduru",
    actionType: "create_campaign",
    actionData: {
      name: input.name,
      description: input.description,
      start_date: input.start_date,
      end_date: input.end_date,
    },
    message: `📢 *Yeni Kampanya Önerisi*\n\n📋 ${input.name}\n📝 ${input.description}\n📅 ${start} – ${end}`,
    buttonLabel: "✅ Oluştur",
  });
}

async function handleFlagUnderperformer(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "bayi_satisMuduru",
    actionType: "flag_underperformer",
    actionData: {
      dealer_id: input.dealer_id,
      dealer_name: input.dealer_name,
      reason: input.reason,
    },
    message: `⚠️ *Düşük Performans Uyarısı*\n\n🏪 ${input.dealer_name}\n📉 ${input.reason}`,
    buttonLabel: "✅ İşaretle",
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
    agentKey: "bayi_satisMuduru",
    actionType: "send_whatsapp",
    actionData: { phone: input.customer_phone, message: input.message_text },
    message: `✉️ *${input.customer_name}* kişisine mesaj taslağı:\n\n📱 ${input.customer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const satisMuduruToolHandlers: Record<string, ToolHandler> = {
  read_campaigns: (input, ctx) => handleReadCampaigns(input, ctx),
  read_dealer_performance: (input, ctx) => handleReadDealerPerformance(input, ctx),
  read_sales_targets: (input, ctx) => handleReadSalesTargets(input, ctx),
  create_campaign_proposal: handleCreateCampaignProposal,
  flag_underperformer: handleFlagUnderperformer,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const satisMuduruAgent: AgentDefinition = {
  key: "bayi_satisMuduru",
  name: "Satış Müdürü",
  icon: "💰",
  tools: SATIS_MUDURU_TOOLS,
  toolHandlers: satisMuduruToolHandlers,

  systemPrompt:
    `Sen bayi yönetim sisteminin satış müdürüsün. Görevin kampanyaları yönetmek, bayi performansını izlemek ve satış hedeflerini takip etmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_campaigns: Aktif kampanyaları oku\n` +
    `- read_dealer_performance: Bayi performans sıralaması\n` +
    `- read_sales_targets: Satış hedefleri ve gerçekleşme\n` +
    `- create_campaign_proposal: Yeni kampanya önerisi (onay gerektirir)\n` +
    `- flag_underperformer: Düşük performanslı bayi işaretle (onay gerektirir)\n` +
    `- draft_message: Taslak WhatsApp mesajı (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_campaigns, read_dealer_performance, read_sales_targets), sonra analiz et, sonra aksiyon öner.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran: kampanya bildirimi, performans eşiği, segment analizi sıklığı.\n` +
    `- Düşük performanslı bayilere özellikle dikkat et.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "bayi_satisMuduru");
    const now = new Date().toISOString();

    // Active campaigns
    const { data: campaigns } = await supabase
      .from("bayi_campaigns")
      .select("id, name, start_date, end_date")
      .eq("tenant_id", ctx.tenantId)
      .lte("start_date", now)
      .gte("end_date", now);

    // Dealer performance — aggregate orders
    const { data: orders } = await supabase
      .from("bayi_orders")
      .select("dealer_id, total_amount")
      .eq("tenant_id", ctx.tenantId);

    const dealerTotals: Record<string, number> = {};
    for (const o of orders || []) {
      if (o.dealer_id) {
        dealerTotals[o.dealer_id] = (dealerTotals[o.dealer_id] || 0) + (o.total_amount || 0);
      }
    }
    const sorted = Object.entries(dealerTotals).sort((a, b) => b[1] - a[1]);
    const topDealers = sorted.slice(0, 3);
    const bottomDealers = sorted.slice(-3);

    // Sales targets
    const { data: targets } = await supabase
      .from("bayi_sales_targets")
      .select("period, target_amount, actual_amount")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(3);

    // Memory
    const recentMessages = await getRecentMessages(ctx.userId, "bayi_satisMuduru", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "bayi_satisMuduru", 5);

    return {
      activeCampaigns: campaigns?.length || 0,
      campaignNames: (campaigns || []).map((c) => c.name).join(", "),
      topDealers,
      bottomDealers,
      agentConfig: config,
      targets: (targets || []).map((t) => ({
        period: t.period,
        target: t.target_amount,
        actual: t.actual_amount,
        ratio: t.target_amount ? Math.round(((t.actual_amount || 0) / t.target_amount) * 100) : 0,
      })),
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
    const activeCampaigns = data.activeCampaigns as number;
    const targets = data.targets as Array<{ period: string; target: number; actual: number; ratio: number }>;
    const topDealers = data.topDealers as Array<[string, number]>;
    const bottomDealers = data.bottomDealers as Array<[string, number]>;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    if (activeCampaigns === 0 && (!targets || targets.length === 0)) return "";

    const config = data.agentConfig as Record<string, unknown> | null;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    if (config) {
      prompt += `### Kullanıcı Tercihleri\n`;
      if (config.kampanya_bildirimi) prompt += `- Kampanya bildirimi: ${config.kampanya_bildirimi === "evet" ? "Aktif" : "Kapalı"}\n`;
      if (config.performans_esigi) prompt += `- Performans eşiği: %${config.performans_esigi}\n`;
      if (config.segment_sikligi) prompt += `- Segment analizi: ${config.segment_sikligi}\n`;
      prompt += `\n`;
    }

    prompt += `### Kampanya Özeti\n`;
    prompt += `- Aktif kampanya: ${activeCampaigns}`;
    if (data.campaignNames) prompt += ` (${data.campaignNames})`;
    prompt += `\n`;

    if (targets?.length) {
      prompt += `\n### Hedef Gerçekleşme\n`;
      for (const t of targets) {
        prompt += `- ${t.period} | Hedef: ${formatCurrency(t.target)} | Gerçekleşen: ${formatCurrency(t.actual)} | %${t.ratio}\n`;
      }
    }

    if (topDealers?.length) {
      prompt += `\n### En İyi Bayiler\n`;
      for (const [id, total] of topDealers) {
        prompt += `- ${id}: ${formatCurrency(total)}\n`;
      }
    }

    if (bottomDealers?.length) {
      prompt += `\n### Düşük Bayiler\n`;
      for (const [id, total] of bottomDealers) {
        prompt += `- ${id}: ${formatCurrency(total)}\n`;
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
      case "create_campaign": {
        const { error } = await supabase.from("bayi_campaigns").insert({
          tenant_id: ctx.tenantId,
          name: actionData.name,
          description: actionData.description,
          start_date: actionData.start_date,
          end_date: actionData.end_date,
        });
        if (error) return `Hata: ${error.message}`;
        return "Kampanya oluşturuldu.";
      }

      case "flag_underperformer": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Düşük performans: ${actionData.dealer_name}`,
          title: `Düşük performans: ${actionData.dealer_name}`,
          note: actionData.reason,
          remind_at: new Date().toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `${actionData.dealer_name} için performans uyarısı oluşturuldu.`;
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
