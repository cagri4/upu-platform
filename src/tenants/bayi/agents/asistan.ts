/**
 * Asistan Agent — V2 (tool-using, memory-backed)
 *
 * Daily overview: orders, revenue, stock alerts, deliveries, dealer count,
 * calendar, reminders. Uses domain tools + platform tools within the agent cycle.
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

// -- Domain Tools ------------------------------------------------------------

const ASISTAN_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_daily_summary",
    description:
      "Gunluk siparis, ciro, kritik stok, aktif teslimat ozetini oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_dealer_overview",
    description:
      "Aktif bayi sayisi ve durum dagilimini oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_reminder",
    description:
      "Hatirlatma olustur. Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Hatirlatma basligi" },
        remind_at: { type: "string", description: "ISO tarih (ne zaman hatirlatilacak)" },
        note: { type: "string", description: "Ek not (opsiyonel)" },
      },
      required: ["title", "remind_at"],
    },
  },
  {
    name: "mark_task_done",
    description:
      "Bir gorevi tamamlandi olarak isaretler. Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        task_description: { type: "string", description: "Tamamlanan gorev aciklamasi" },
      },
      required: ["task_description"],
    },
  },
  {
    name: "draft_message",
    description:
      "Bayiye taslak WhatsApp mesaji hazirla. Direkt gondermez, kullaniciya gosterir.",
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string", description: "Bayi/musteri adi" },
        customer_phone: { type: "string", description: "Telefon numarasi" },
        message_text: { type: "string", description: "Gonderilecek mesaj metni" },
      },
      required: ["customer_name", "customer_phone", "message_text"],
    },
  },
];

// -- Domain Tool Handlers ----------------------------------------------------

async function handleReadDailySummary(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Today's orders: count + revenue
  const { data: todayOrders, error: ordErr } = await supabase
    .from("bayi_orders")
    .select("id, total_amount")
    .eq("tenant_id", ctx.tenantId)
    .gte("created_at", `${today}T00:00:00`);

  if (ordErr) return { result: `Hata: ${ordErr.message}`, needsApproval: false };

  const orderCount = todayOrders?.length || 0;
  const revenue = (todayOrders || []).reduce((s, o) => s + (o.total_amount || 0), 0);

  // Critical stock (< 10 units)
  const { count: criticalStockCount, error: stockErr } = await supabase
    .from("bayi_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .lt("stock_quantity", 10);

  if (stockErr) return { result: `Hata: ${stockErr.message}`, needsApproval: false };

  // Active deliveries (shipped or preparing)
  const { count: activeDeliveryCount, error: delErr } = await supabase
    .from("bayi_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["shipped", "preparing"]);

  if (delErr) return { result: `Hata: ${delErr.message}`, needsApproval: false };

  const lines = [
    `Gunluk Ozet (${today})`,
    `- Siparis: ${orderCount}`,
    `- Ciro: ${formatCurrency(revenue)}`,
    `- Kritik stok: ${criticalStockCount || 0} urun`,
    `- Aktif teslimat: ${activeDeliveryCount || 0}`,
  ];

  return { result: lines.join("\n"), needsApproval: false };
}

async function handleReadDealerOverview(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: dealers, error } = await supabase
    .from("bayi_dealers")
    .select("id, is_active")
    .eq("tenant_id", ctx.tenantId);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!dealers?.length) return { result: "Kayitli bayi yok.", needsApproval: false };

  const active = dealers.filter((d) => d.is_active).length;
  const inactive = dealers.length - active;

  const lines = [
    `Bayi Durumu`,
    `- Toplam: ${dealers.length}`,
    `- Aktif: ${active}`,
    `- Pasif: ${inactive}`,
  ];

  return { result: lines.join("\n"), needsApproval: false };
}

async function handleCreateReminder(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const title = input.title as string;
  const remindAt = input.remind_at as string;
  const note = input.note as string | undefined;
  const dt = new Date(remindAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

  return createProposalAndNotify({
    ctx,
    taskId,
    agentName,
    agentIcon,
    agentKey: "bayi_asistan",
    actionType: "create_reminder",
    actionData: { title, remind_at: remindAt, note: note || null },
    message: `Hatirlatma olusturulsun mu?\n\n${title}\n${dt}${note ? `\n${note}` : ""}`,
  });
}

async function handleMarkTaskDone(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const desc = input.task_description as string;

  return createProposalAndNotify({
    ctx,
    taskId,
    agentName,
    agentIcon,
    agentKey: "bayi_asistan",
    actionType: "mark_task_done",
    actionData: { task_description: desc },
    message: `"${desc}" gorevi tamamlandi olarak isaretlensin mi?`,
  });
}

async function handleDraftMessage(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const name = input.customer_name as string;
  const phone = input.customer_phone as string;
  const text = input.message_text as string;

  return createProposalAndNotify({
    ctx,
    taskId,
    agentName,
    agentIcon,
    agentKey: "bayi_asistan",
    actionType: "send_whatsapp",
    actionData: { phone, message: text },
    message: `${name} kisisine mesaj gonderilsin mi?\n\n${phone}\n${text}`,
  });
}

// -- Tool Handlers Map -------------------------------------------------------

const asistanToolHandlers: Record<string, ToolHandler> = {
  read_daily_summary: (input, ctx) => handleReadDailySummary(input, ctx),
  read_dealer_overview: (input, ctx) => handleReadDealerOverview(input, ctx),
  create_reminder: handleCreateReminder,
  mark_task_done: handleMarkTaskDone,
  draft_message: handleDraftMessage,
};

// -- Agent Definition --------------------------------------------------------

export const asistanAgent: AgentDefinition = {
  key: "bayi_asistan",
  name: "Asistan",
  icon: "📊",
  tools: ASISTAN_TOOLS,
  toolHandlers: asistanToolHandlers,

  systemPrompt:
    `Sen bayi yonetim sisteminin asistanisin. Gorevin gunluk siparisleri, ciroyu, stok durumunu, teslimat ve bayi bilgilerini takip etmek.\n\n` +
    `## Kullanabilecegin Araclar\n` +
    `- read_daily_summary: Gunluk siparis, ciro, kritik stok, aktif teslimat ozetini oku\n` +
    `- read_dealer_overview: Aktif bayi sayisi ve durum dagilimini oku\n` +
    `- create_reminder: Hatirlatma olustur (onay gerektirir)\n` +
    `- mark_task_done: Gorevi tamamlandi olarak isaretler (onay gerektirir)\n` +
    `- draft_message: Bayiye taslak WhatsApp mesaji hazirla (direkt gondermez, onay gerektirir)\n` +
    `- notify_human: Kullaniciya bildirim/oneri gonder\n` +
    `- read_db: Veritabanindan veri oku\n\n` +
    `## Kurallar\n` +
    `- Bayiye ASLA direkt mesaj gonderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon icin kullanici onayi al.\n` +
    `- Otonomi seviyesi: HER SEYI SOR — hicbir yazma islemini onaysiz yapma.\n` +
    `- Kullanici tercihlerine (agent_config) gore davran: brifing saati, rapor sikligi, metrik tercihleri.\n` +
    `- Once veri topla (read_daily_summary, read_dealer_overview), sonra analiz et, sonra aksiyon oner.\n` +
    `- Yapilacak bir sey yoksa hicbir tool cagirma, kisa bir Turkce ozet yaz.\n` +
    `- Turkce yanit ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "bayi_asistan");
    const today = new Date().toISOString().slice(0, 10);

    // Today's orders: count + revenue
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

    // Active deliveries
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

    // Memory: recent messages and task history
    const recentMessages = await getRecentMessages(ctx.userId, "bayi_asistan", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "bayi_asistan", 5);

    return {
      orderCount,
      revenue,
      criticalStockCount: criticalStockCount || 0,
      activeDeliveries: activeDeliveryCount || 0,
      dealerCount: dealerCount || 0,
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
    const orderCount = data.orderCount as number;
    const revenue = data.revenue as number;
    const criticalStockCount = data.criticalStockCount as number;
    const activeDeliveries = data.activeDeliveries as number;
    const dealerCount = data.dealerCount as number;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    if (orderCount === 0 && criticalStockCount === 0 && activeDeliveries === 0 && dealerCount === 0) return "";

    const config = data.agentConfig as Record<string, unknown> | null;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    if (config) {
      prompt += `### Kullanici Tercihleri\n`;
      if (config.brifing_saat) prompt += `- Brifing saati: ${config.brifing_saat}\n`;
      if (config.rapor_sikligi) prompt += `- Rapor sikligi: ${config.rapor_sikligi}\n`;
      if (config.metrikler) prompt += `- Takip metrikleri: ${config.metrikler}\n`;
      prompt += `\n`;
    }

    prompt += `### Gunluk Ozet\n`;
    prompt += `- Siparis: ${orderCount}\n`;
    prompt += `- Ciro: ${formatCurrency(revenue)}\n`;
    prompt += `- Kritik stok: ${criticalStockCount} urun\n`;
    prompt += `- Aktif teslimat: ${activeDeliveries}\n`;
    prompt += `- Aktif bayi: ${dealerCount}\n\n`;

    if (recentDecisions?.length) {
      prompt += `### Son Kararlar\n`;
      for (const d of recentDecisions) {
        const dt = new Date(d.date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
        prompt += `- ${dt}: ${d.actions.join(", ")}\n`;
      }
      prompt += "\n";
    }

    if (messageHistory?.length) {
      prompt += `### Son Mesajlar\n`;
      for (const m of messageHistory) {
        prompt += `[${m.role}] ${m.content}\n`;
      }
    }

    return prompt;
  },

  parseProposals(
    aiResponse: string,
    _data: Record<string, unknown>,
  ): AgentProposal[] {
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
    ctx: AgentContext,
    actionType: string,
    actionData: Record<string, unknown>,
  ): Promise<string> {
    const supabase = getServiceClient();

    switch (actionType) {
      case "create_reminder": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: actionData.title,
          title: actionData.title,
          note: actionData.note || null,
          remind_at: actionData.remind_at,
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `Hatirlatma olusturuldu: ${actionData.title}`;
      }

      case "mark_task_done": {
        return "Gorev tamamlandi olarak isaretlendi.";
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
