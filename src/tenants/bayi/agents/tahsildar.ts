/**
 * Tahsildar Agent — V2 (tool-using, memory-backed)
 *
 * Tracks due payments, overdue invoices, collection activities, payment reminders.
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
import { createProposalAndNotify, formatCurrency, formatDate } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const TAHSILDAR_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_due_today",
    description: "Bugün vadesi gelen faturaları oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_overdue",
    description: "Vadesi geçmiş faturaları oku. Gecikme gün sayısıyla.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_collection_activities",
    description: "Son tahsilat aktivitelerini oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_collection_record",
    description: "Tahsilat kaydı oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        dealer_id: { type: "string", description: "Bayi ID" },
        dealer_name: { type: "string", description: "Bayi adı" },
        amount: { type: "number", description: "Tahsilat tutarı" },
        activity_type: {
          type: "string",
          enum: ["visit", "phone_call", "payment"],
          description: "Aktivite türü",
        },
      },
      required: ["dealer_id", "dealer_name", "amount", "activity_type"],
    },
  },
  {
    name: "send_payment_reminder",
    description: "Bayiye ödeme hatırlatması gönder. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        dealer_id: { type: "string", description: "Bayi ID" },
        dealer_name: { type: "string", description: "Bayi adı" },
        dealer_phone: { type: "string", description: "Bayi telefon numarası" },
        overdue_amount: { type: "number", description: "Vadesi geçmiş tutar" },
      },
      required: ["dealer_id", "dealer_name", "dealer_phone", "overdue_amount"],
    },
  },
  {
    name: "draft_message",
    description: "Bayiye taslak WhatsApp mesajı. Direkt göndermez, kullanıcıya gösterir.",
    input_schema: {
      type: "object",
      properties: {
        dealer_name: { type: "string", description: "Bayi adı" },
        dealer_phone: { type: "string", description: "Telefon numarası" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["dealer_name", "dealer_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadDueToday(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("bayi_dealer_invoices")
    .select("id, dealer_id, amount, due_date, bayi_dealers(name)")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_paid", false)
    .eq("due_date", today);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Bugün vadesi gelen fatura yok.", needsApproval: false };

  const list = data.map((inv) => {
    const dealer = inv.bayi_dealers as unknown as { name: string } | null;
    return `- ${dealer?.name || inv.dealer_id} | ${formatCurrency(inv.amount)} | Vade: ${formatDate(inv.due_date)}`;
  });

  const total = data.reduce((s, i) => s + (i.amount || 0), 0);
  list.push(`\nToplam: ${formatCurrency(total)} (${data.length} fatura)`);

  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadOverdue(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("bayi_dealer_invoices")
    .select("id, dealer_id, amount, due_date, bayi_dealers(name)")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_paid", false)
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(30);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Vadesi geçmiş fatura yok.", needsApproval: false };

  const now = new Date();
  const list = data.map((inv) => {
    const dealer = inv.bayi_dealers as unknown as { name: string } | null;
    const daysOverdue = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
    return `- ${dealer?.name || inv.dealer_id} | ${formatCurrency(inv.amount)} | ${daysOverdue} gün gecikme | Vade: ${formatDate(inv.due_date)}`;
  });

  const total = data.reduce((s, i) => s + (i.amount || 0), 0);
  list.push(`\nToplam: ${formatCurrency(total)} (${data.length} fatura)`);

  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadCollectionActivities(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("bayi_collection_activities")
    .select("id, dealer_id, activity_type, amount, created_at")
    .eq("tenant_id", ctx.tenantId)
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false })
    .limit(15);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Son 7 günde tahsilat aktivitesi yok.", needsApproval: false };

  const typeLabels: Record<string, string> = {
    visit: "Ziyaret",
    phone_call: "Telefon",
    payment: "Ödeme",
  };

  const list = data.map((a) => {
    const typeLabel = typeLabels[a.activity_type] || a.activity_type;
    return `- ${typeLabel} | ${formatCurrency(a.amount)} | ${formatDate(a.created_at)}`;
  });

  const total = data.reduce((s, a) => s + (a.amount || 0), 0);
  list.push(`\nToplam: ${formatCurrency(total)} (${data.length} aktivite)`);

  return { result: list.join("\n"), needsApproval: false };
}

async function handleCreateCollectionRecord(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const typeLabels: Record<string, string> = {
    visit: "Ziyaret",
    phone_call: "Telefon",
    payment: "Ödeme",
  };
  const typeLabel = typeLabels[input.activity_type as string] || (input.activity_type as string);

  return createProposalAndNotify({
    ctx,
    taskId,
    agentName,
    agentIcon,
    agentKey: "bayi_tahsildar",
    actionType: "create_collection_record",
    actionData: {
      dealer_id: input.dealer_id,
      dealer_name: input.dealer_name,
      amount: input.amount,
      activity_type: input.activity_type,
    },
    message: `📋 *${input.dealer_name}* için tahsilat kaydı:\n\nTür: ${typeLabel}\nTutar: ${formatCurrency(input.amount as number)}`,
    buttonLabel: "✅ Kaydet",
  });
}

async function handleSendPaymentReminder(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx,
    taskId,
    agentName,
    agentIcon,
    agentKey: "bayi_tahsildar",
    actionType: "send_payment_reminder",
    actionData: {
      dealer_id: input.dealer_id,
      dealer_name: input.dealer_name,
      dealer_phone: input.dealer_phone,
      overdue_amount: input.overdue_amount,
    },
    message: `💰 *${input.dealer_name}* bayisine ödeme hatırlatması:\n\n📱 ${input.dealer_phone}\n💸 Vadesi geçmiş: ${formatCurrency(input.overdue_amount as number)}`,
    buttonLabel: "✅ Gönder",
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
    ctx,
    taskId,
    agentName,
    agentIcon,
    agentKey: "bayi_tahsildar",
    actionType: "send_whatsapp",
    actionData: { phone: input.dealer_phone, message: input.message_text },
    message: `✉️ *${input.dealer_name}* bayisine mesaj taslağı:\n\n📱 ${input.dealer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const tahsildarToolHandlers: Record<string, ToolHandler> = {
  read_due_today: (input, ctx) => handleReadDueToday(input, ctx),
  read_overdue: (input, ctx) => handleReadOverdue(input, ctx),
  read_collection_activities: (input, ctx) => handleReadCollectionActivities(input, ctx),
  create_collection_record: handleCreateCollectionRecord,
  send_payment_reminder: handleSendPaymentReminder,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const tahsildarAgent: AgentDefinition = {
  key: "bayi_tahsildar",
  name: "Tahsildar",
  icon: "📋",
  tools: TAHSILDAR_TOOLS,
  toolHandlers: tahsildarToolHandlers,

  systemPrompt:
    `Sen bayi yönetim sisteminin tahsildarısın. Görevin vadesi gelen/geçen ödemeleri takip etmek, tahsilat aktivitelerini kaydetmek ve bayilere ödeme hatırlatması göndermek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_due_today: Bugün vadesi gelen faturaları oku\n` +
    `- read_overdue: Vadesi geçmiş faturaları oku (gecikme gün sayısıyla)\n` +
    `- read_collection_activities: Son tahsilat aktivitelerini oku\n` +
    `- create_collection_record: Tahsilat kaydı oluştur (onay gerektirir)\n` +
    `- send_payment_reminder: Bayiye ödeme hatırlatması gönder (onay gerektirir)\n` +
    `- draft_message: Bayiye taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Bayiye ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_due_today, read_overdue, read_collection_activities), sonra analiz et, sonra aksiyon öner.\n` +
    `- 30+ gün gecikmiş ödemelere özellikle dikkat et.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    // Due today
    const { data: dueToday } = await supabase
      .from("bayi_dealer_invoices")
      .select("id, amount")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_paid", false)
      .eq("due_date", today);

    const dueTodayTotal = (dueToday || []).reduce((s, i) => s + (i.amount || 0), 0);

    // Overdue
    const { data: overdue } = await supabase
      .from("bayi_dealer_invoices")
      .select("id, amount")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_paid", false)
      .lt("due_date", today);

    const overdueTotal = (overdue || []).reduce((s, i) => s + (i.amount || 0), 0);

    // Recent collection activities this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activities } = await supabase
      .from("bayi_collection_activities")
      .select("id, amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", weekAgo);

    const collectedThisWeek = (activities || []).reduce((s, a) => s + (a.amount || 0), 0);

    const recentMessages = await getRecentMessages(ctx.userId, "bayi_tahsildar", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "bayi_tahsildar", 5);

    return {
      dueTodayCount: dueToday?.length || 0,
      dueTodayTotal,
      overdueCount: overdue?.length || 0,
      overdueTotal,
      recentActivitiesCount: activities?.length || 0,
      collectedThisWeek,
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
    const dueTodayCount = data.dueTodayCount as number;
    const dueTodayTotal = data.dueTodayTotal as number;
    const overdueCount = data.overdueCount as number;
    const overdueTotal = data.overdueTotal as number;
    const collectedThisWeek = data.collectedThisWeek as number;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    if (dueTodayCount === 0 && overdueCount === 0) return "";

    let prompt = `## Tahsilat Ozeti\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;
    prompt += `- Bugun vadesi gelen: ${dueTodayCount} fatura (${formatCurrency(dueTodayTotal)})\n`;
    prompt += `- Vadesi gecmis: ${overdueCount} fatura (${formatCurrency(overdueTotal)})\n`;
    prompt += `- Bu hafta tahsilat: ${formatCurrency(collectedThisWeek)}\n`;

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
      case "create_collection_record": {
        const { error } = await supabase.from("bayi_collection_activities").insert({
          tenant_id: ctx.tenantId,
          dealer_id: actionData.dealer_id,
          activity_type: actionData.activity_type,
          amount: actionData.amount,
          created_at: new Date().toISOString(),
        });
        if (error) return `Hata: ${error.message}`;
        return "Tahsilat kaydı oluşturuldu.";
      }

      case "send_payment_reminder": {
        const { sendText } = await import("@/platform/whatsapp/send");
        const msg =
          `Sayın ${actionData.dealer_name},\n\n` +
          `${formatCurrency(actionData.overdue_amount as number)} tutarında vadesi geçmiş ödemeniz bulunmaktadır. ` +
          `En kısa sürede ödeme yapmanızı rica ederiz.\n\nİyi günler.`;
        await sendText(actionData.dealer_phone as string, msg);
        return "Ödeme hatırlatması gönderildi.";
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
