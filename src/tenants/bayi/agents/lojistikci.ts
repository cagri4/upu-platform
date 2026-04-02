/**
 * Lojistikci Agent — V2 (tool-using, memory-backed)
 *
 * Deliveries, routes, cargo tracking, delayed shipments.
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
import { createProposalAndNotify, formatCurrency, formatDate } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const LOJISTIKCI_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_pending_deliveries",
    description:
      "Yoldaki teslimatları oku. Gönderilmiş siparişler.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_today_deliveries",
    description:
      "Bugün teslim edilecek siparişleri oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_delayed_shipments",
    description:
      "Geciken sevkiyatları oku. 3+ gün hazırlanıyor durumunda.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_order_status",
    description: "Sipariş durumunu güncelle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Sipariş ID" },
        new_status: {
          type: "string",
          enum: ["preparing", "shipped", "delivered"],
          description: "Yeni durum",
        },
        note: { type: "string", description: "Not (opsiyonel)" },
      },
      required: ["order_id", "new_status"],
    },
  },
  {
    name: "create_delivery_note",
    description: "Teslimat notu oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Sipariş ID" },
        note: { type: "string", description: "Teslimat notu" },
      },
      required: ["order_id", "note"],
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

async function handleReadPendingDeliveries(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("bayi_orders")
    .select("id, dealer_id, total_amount, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "shipped")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Yoldaki teslimat yok.", needsApproval: false };

  const list = data.map((o) =>
    `- [${o.id}] Bayi: ${o.dealer_id} | Tutar: ${formatCurrency(o.total_amount || 0)} | Tarih: ${formatDate(o.created_at)}`,
  );
  return { result: `Yoldaki teslimatlar (${data.length}):\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadTodayDeliveries(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("bayi_orders")
    .select("id, dealer_id, total_amount, estimated_delivery")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "shipped")
    .eq("estimated_delivery", today);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Bugün teslim edilecek sipariş yok.", needsApproval: false };

  const list = data.map((o) =>
    `- [${o.id}] Bayi: ${o.dealer_id} | Tutar: ${formatCurrency(o.total_amount || 0)}`,
  );
  return { result: `Bugün teslim edilecek (${data.length}):\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadDelayedShipments(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("bayi_orders")
    .select("id, dealer_id, total_amount, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "preparing")
    .lt("created_at", threeDaysAgo)
    .order("created_at", { ascending: true });

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Geciken sevkiyat yok.", needsApproval: false };

  const list = data.map((o) => {
    const delayDays = Math.floor((Date.now() - new Date(o.created_at).getTime()) / (24 * 60 * 60 * 1000));
    return `- [${o.id}] Bayi: ${o.dealer_id} | Tutar: ${formatCurrency(o.total_amount || 0)} | ${delayDays} gün gecikmiş`;
  });
  return { result: `Geciken sevkiyatlar (${data.length}):\n${list.join("\n")}`, needsApproval: false };
}

async function handleUpdateOrderStatus(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const statusLabels: Record<string, string> = {
    preparing: "Hazırlanıyor",
    shipped: "Gönderildi",
    delivered: "Teslim Edildi",
  };
  const label = statusLabels[input.new_status as string] || input.new_status;
  const noteText = input.note ? `\n📝 ${input.note}` : "";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "bayi_lojistikci",
    actionType: "update_order_status",
    actionData: {
      order_id: input.order_id,
      new_status: input.new_status,
      note: input.note || null,
    },
    message: `📦 *Sipariş Durum Güncelleme*\n\n🔖 Sipariş: ${input.order_id}\n📊 Yeni durum: ${label}${noteText}`,
    buttonLabel: "✅ Güncelle",
  });
}

async function handleCreateDeliveryNote(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "bayi_lojistikci",
    actionType: "create_delivery_note",
    actionData: {
      order_id: input.order_id,
      note: input.note,
    },
    message: `📋 *Teslimat Notu*\n\n🔖 Sipariş: ${input.order_id}\n📝 ${input.note}`,
    buttonLabel: "✅ Kaydet",
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
    agentKey: "bayi_lojistikci",
    actionType: "send_whatsapp",
    actionData: { phone: input.customer_phone, message: input.message_text },
    message: `✉️ *${input.customer_name}* kişisine mesaj taslağı:\n\n📱 ${input.customer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const lojistikciToolHandlers: Record<string, ToolHandler> = {
  read_pending_deliveries: (input, ctx) => handleReadPendingDeliveries(input, ctx),
  read_today_deliveries: (input, ctx) => handleReadTodayDeliveries(input, ctx),
  read_delayed_shipments: (input, ctx) => handleReadDelayedShipments(input, ctx),
  update_order_status: handleUpdateOrderStatus,
  create_delivery_note: handleCreateDeliveryNote,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const lojistikciAgent: AgentDefinition = {
  key: "bayi_lojistikci",
  name: "Lojistikçi",
  icon: "🚛",
  tools: LOJISTIKCI_TOOLS,
  toolHandlers: lojistikciToolHandlers,

  systemPrompt:
    `Sen bayi yönetim sisteminin lojistikçisisin. Görevin teslimatları takip etmek, geciken sevkiyatları raporlamak ve lojistik süreçleri yönetmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_pending_deliveries: Yoldaki teslimatları oku\n` +
    `- read_today_deliveries: Bugün teslim edilecek siparişler\n` +
    `- read_delayed_shipments: Geciken sevkiyatlar (3+ gün)\n` +
    `- update_order_status: Sipariş durumu güncelle (onay gerektirir)\n` +
    `- create_delivery_note: Teslimat notu oluştur (onay gerektirir)\n` +
    `- draft_message: Taslak WhatsApp mesajı (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_pending_deliveries, read_delayed_shipments), sonra analiz et, sonra aksiyon öner.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran: teslimat bildirimi, gecikme eşiği, rota optimizasyonu.\n` +
    `- Geciken sevkiyatlara özellikle dikkat et, acil müdahale gerektirebilir.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "bayi_lojistikci");
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

    // Memory
    const recentMessages = await getRecentMessages(ctx.userId, "bayi_lojistikci", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "bayi_lojistikci", 5);

    return {
      pendingDeliveries: pendingDeliveries?.length || 0,
      todayDeliveries: todayDeliveries?.length || 0,
      delayedShipments: delayed?.length || 0,
      delayedTotal: (delayed || []).reduce((s, o) => s + (o.total_amount || 0), 0),
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
    const pendingDeliveries = data.pendingDeliveries as number;
    const todayDeliveries = data.todayDeliveries as number;
    const delayedShipments = data.delayedShipments as number;
    const delayedTotal = data.delayedTotal as number;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    if (pendingDeliveries === 0 && delayedShipments === 0) return "";

    const config = data.agentConfig as Record<string, unknown> | null;

    let prompt = `## Lojistik Özeti\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    if (config) {
      prompt += `### Kullanıcı Tercihleri\n`;
      if (config.teslimat_bildirimi) prompt += `- Teslimat bildirimi: ${config.teslimat_bildirimi === "evet" ? "Aktif" : "Kapalı"}\n`;
      if (config.gecikme_esigi) prompt += `- Gecikme eşiği: ${config.gecikme_esigi} gün\n`;
      if (config.rota_optimizasyonu) prompt += `- Rota optimizasyonu: ${config.rota_optimizasyonu === "evet" ? "Aktif" : "Kapalı"}\n`;
      prompt += `\n`;
    }
    prompt += `- Yoldaki teslimat: ${pendingDeliveries}\n`;
    prompt += `- Bugün teslim edilecek: ${todayDeliveries}\n`;
    prompt += `- Geciken sevkiyat: ${delayedShipments} (${formatCurrency(delayedTotal)})\n`;

    if (delayedShipments > 0) {
      prompt += `\n### Geciken Sevkiyatlar\n`;
      prompt += `${delayedShipments} sipariş 3+ gündür "hazırlanıyor" durumunda. Toplam tutar: ${formatCurrency(delayedTotal)}. Acil müdahale gerekebilir.\n`;
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
      case "update_order_status": {
        const updateFields: Record<string, unknown> = { status: actionData.new_status };
        if (actionData.note) updateFields.delivery_notes = actionData.note;
        const { error } = await supabase
          .from("bayi_orders")
          .update(updateFields)
          .eq("id", actionData.order_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return "Sipariş durumu güncellendi.";
      }

      case "create_delivery_note": {
        const { error } = await supabase
          .from("bayi_orders")
          .update({ delivery_notes: actionData.note })
          .eq("id", actionData.order_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return "Teslimat notu kaydedildi.";
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
