/**
 * Siparis Yoneticisi Agent — Supplier management, purchase orders, delivery tracking
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
import { createProposalAndNotify } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const SIPARIS_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_orders",
    description:
      "Siparisleri filtrelerle oku. status: 'pending'|'confirmed'|'delivered'|'cancelled'|'all'.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "confirmed", "delivered", "cancelled", "all"], description: "Siparis durumu" },
      },
      required: [],
    },
  },
  {
    name: "read_order_stats",
    description: "Siparis istatistikleri: toplam siparis, bekleyen, teslim edilen, tedarikci bazli ozet.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_suppliers",
    description: "Tedarikci listesi: ad, telefon, siparis sayisi.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "confirm_order",
    description: "Bekleyen siparisi onayla. Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Siparis ID" },
        supplier_name: { type: "string", description: "Tedarikci adi" },
        item_count: { type: "number", description: "Kalem sayisi" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "mark_delivered",
    description: "Siparisi teslim alindi olarak isaretle. Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Siparis ID" },
        supplier_name: { type: "string", description: "Tedarikci adi" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "draft_supplier_message",
    description: "Tedarikciye taslak mesaj hazirla.",
    input_schema: {
      type: "object",
      properties: {
        supplier_name: { type: "string", description: "Tedarikci adi" },
        supplier_phone: { type: "string", description: "Telefon numarasi" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["supplier_name", "supplier_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadOrders(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  let query = supabase
    .from("mkt_orders")
    .select("id, status, created_at, mkt_suppliers(name)")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status as string);
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Siparis bulunamadi.", needsApproval: false };

  const list = data.map((o: any) => {
    const id8 = o.id.substring(0, 8);
    const supplier = Array.isArray(o.mkt_suppliers) ? o.mkt_suppliers[0] : o.mkt_suppliers;
    const supplierName = supplier?.name || "-";
    return `- [${id8}] ${supplierName} | ${o.status} | ${new Date(o.created_at).toLocaleDateString("tr-TR")}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadOrderStats(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: orders } = await supabase
    .from("mkt_orders")
    .select("id, status, created_at, mkt_suppliers(name)")
    .eq("tenant_id", ctx.tenantId);

  if (!orders?.length) return { result: "Siparis bulunamadi.", needsApproval: false };

  const total = orders.length;
  const pending = orders.filter((o) => o.status === "pending").length;
  const confirmed = orders.filter((o) => o.status === "confirmed").length;
  const delivered = orders.filter((o) => o.status === "delivered").length;

  const lines = [
    `Toplam siparis: ${total}`,
    `Bekleyen: ${pending}`,
    `Onaylanan: ${confirmed}`,
    `Teslim edilen: ${delivered}`,
  ];
  return { result: lines.join("\n"), needsApproval: false };
}

async function handleReadSuppliers(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: suppliers } = await supabase
    .from("mkt_suppliers")
    .select("id, name, phone")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .order("name")
    .limit(20);

  if (!suppliers?.length) return { result: "Tedarikci bulunamadi.", needsApproval: false };

  const list = suppliers.map((s) => `- ${s.name}${s.phone ? " | " + s.phone : ""}`);
  return { result: list.join("\n"), needsApproval: false };
}

async function handleConfirmOrder(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const orderId = (input.order_id as string).substring(0, 8);
  const supplierName = (input.supplier_name as string) || "Tedarikci";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "mkt_siparisYoneticisi",
    actionType: "confirm_order",
    actionData: { order_id: input.order_id },
    message: `Siparis ${orderId} (${supplierName}) onaylansin mi?`,
    buttonLabel: "Onayla",
  });
}

async function handleMarkDelivered(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const orderId = (input.order_id as string).substring(0, 8);
  const supplierName = (input.supplier_name as string) || "Tedarikci";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "mkt_siparisYoneticisi",
    actionType: "mark_delivered",
    actionData: { order_id: input.order_id },
    message: `Siparis ${orderId} (${supplierName}) teslim alindi olarak isaretlensin mi?`,
    buttonLabel: "Teslim alindi",
  });
}

async function handleDraftSupplierMessage(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "mkt_siparisYoneticisi",
    actionType: "send_whatsapp",
    actionData: { phone: input.supplier_phone, message: input.message_text },
    message: `*${input.supplier_name}* kisisine mesaj taslagi:\n\n${input.supplier_phone}\n_${input.message_text}_`,
    buttonLabel: "Gonder",
  });
}

const siparisToolHandlers: Record<string, ToolHandler> = {
  read_orders: (input, ctx) => handleReadOrders(input, ctx),
  read_order_stats: (input, ctx) => handleReadOrderStats(input, ctx),
  read_suppliers: (input, ctx) => handleReadSuppliers(input, ctx),
  confirm_order: handleConfirmOrder,
  mark_delivered: handleMarkDelivered,
  draft_supplier_message: handleDraftSupplierMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const siparisYoneticisiAgent: AgentDefinition = {
  key: "mkt_siparisYoneticisi",
  name: "Siparis Yoneticisi",
  icon: "📋",
  tools: SIPARIS_TOOLS,
  toolHandlers: siparisToolHandlers,

  systemPrompt:
    `Sen marketin siparis yoneticisisin. Gorevlerin:\n` +
    `- Tedarikci iliskilerini yonetmek\n` +
    `- Bekleyen siparisleri takip etmek\n` +
    `- Teslimat surelerini izlemek\n` +
    `- Gecikmeli siparisler icin uyari gondermek\n\n` +
    `## Kullanabilecegin Araclar\n` +
    `- read_orders: Siparisleri oku (filtreli)\n` +
    `- read_order_stats: Siparis istatistikleri\n` +
    `- read_suppliers: Tedarikci listesi\n` +
    `- confirm_order: Siparis onayla (onay gerektirir)\n` +
    `- mark_delivered: Teslim alindi isaretle (onay gerektirir)\n` +
    `- draft_supplier_message: Tedarikciye mesaj (onay gerektirir)\n` +
    `- notify_human: Kullaniciya bildirim gonder\n` +
    `- read_db: Veritabanindan veri oku\n\n` +
    `## Kurallar\n` +
    `- Her kritik aksiyon icin kullanici onayi al.\n` +
    `- Once veri topla, sonra analiz et, sonra aksiyon oner.\n` +
    `- Yapilacak bir sey yoksa hicbir tool cagirma, kisa bir Turkce ozet yaz.\n` +
    `- Turkce yanit ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    const { data: orders } = await supabase
      .from("mkt_orders")
      .select("id, status, created_at, mkt_suppliers(name)")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(30);

    const recentMessages = await getRecentMessages(ctx.userId, "mkt_siparisYoneticisi", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "mkt_siparisYoneticisi", 5);

    if (!orders?.length) {
      return { orderCount: 0, recentDecisions: [], messageHistory: [] };
    }

    const pending = orders.filter((o) => o.status === "pending");
    const confirmed = orders.filter((o) => o.status === "confirmed");
    // Orders pending for more than 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const overdue = pending.filter((o) => o.created_at < threeDaysAgo);

    return {
      orderCount: orders.length,
      pendingCount: pending.length,
      confirmedCount: confirmed.length,
      overdueCount: overdue.length,
      overdueOrders: overdue.slice(0, 5).map((o: any) => {
        const supplier = Array.isArray(o.mkt_suppliers) ? o.mkt_suppliers[0] : o.mkt_suppliers;
        return `${o.id.substring(0, 8)} | ${supplier?.name || "-"} | ${new Date(o.created_at).toLocaleDateString("tr-TR")}`;
      }),
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
    if (!data.orderCount || (data.orderCount as number) === 0) return "";

    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;
    prompt += `### Siparis Ozeti\n`;
    prompt += `- Toplam siparis: ${data.orderCount}\n`;
    prompt += `- Bekleyen: ${data.pendingCount}\n`;
    prompt += `- Onaylanan: ${data.confirmedCount}\n`;
    prompt += `- Gecikmeli (3+ gun): ${data.overdueCount}\n`;

    if ((data.overdueOrders as string[])?.length) {
      prompt += `\n### Gecikmeli Siparisler\n`;
      for (const order of data.overdueOrders as string[]) {
        prompt += `- ${order}\n`;
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
      case "confirm_order": {
        const { error } = await supabase
          .from("mkt_orders")
          .update({ status: "confirmed", updated_at: new Date().toISOString() })
          .eq("id", actionData.order_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return "Siparis onaylandi.";
      }

      case "mark_delivered": {
        const { error } = await supabase
          .from("mkt_orders")
          .update({ status: "delivered", updated_at: new Date().toISOString() })
          .eq("id", actionData.order_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return "Siparis teslim alindi olarak isaretlendi.";
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
