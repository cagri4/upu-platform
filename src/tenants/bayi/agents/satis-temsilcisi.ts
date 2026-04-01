/**
 * Satis Temsilcisi Agent — V2 (tool-using, memory-backed)
 *
 * Tracks planned visits, pending orders, dealer issues, visit notes.
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

// -- Domain Tools ------------------------------------------------------------

const SATIS_TEMSILCISI_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_planned_visits",
    description:
      "Yaklaşan bayi ziyaret planlarını oku. Önümüzdeki 7 gün.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_pending_orders",
    description:
      "Bekleyen siparişleri oku. Durum ve tutar.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_problem_dealers",
    description:
      "Sorunlu bayileri oku. Negatif bakiyeli veya pasif bayiler.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "schedule_visit",
    description: "Bayi ziyareti planla. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        dealer_id: { type: "string", description: "Bayi ID" },
        dealer_name: { type: "string", description: "Bayi adı" },
        visit_date: { type: "string", description: "ISO tarih" },
        notes: { type: "string", description: "Ziyaret notları" },
      },
      required: ["dealer_id", "dealer_name", "visit_date"],
    },
  },
  {
    name: "create_visit_note",
    description: "Ziyaret notu ekle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        dealer_id: { type: "string", description: "Bayi ID" },
        dealer_name: { type: "string", description: "Bayi adı" },
        note: { type: "string", description: "Not içeriği" },
      },
      required: ["dealer_id", "dealer_name", "note"],
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

// -- Domain Tool Handlers ----------------------------------------------------

async function handleReadPlannedVisits(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const in7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("bayi_dealer_visits")
    .select("id, dealer_id, visit_date, notes, bayi_dealers(name)")
    .eq("tenant_id", ctx.tenantId)
    .gte("visit_date", today)
    .lte("visit_date", in7d)
    .order("visit_date", { ascending: true })
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Önümüzdeki 7 günde planlanmış ziyaret yok.", needsApproval: false };

  const list = data.map((v) => {
    const dealer = v.bayi_dealers as unknown as { name: string } | null;
    return `- ${formatDate(v.visit_date)} | ${dealer?.name || v.dealer_id}${v.notes ? ` | ${v.notes}` : ""}`;
  });
  return { result: `Planlanan ziyaretler (7 gün):\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadPendingOrders(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("bayi_orders")
    .select("id, dealer_id, total_amount, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Bekleyen sipariş yok.", needsApproval: false };

  const list = data.map((o) =>
    `- [${o.id}] Bayi: ${o.dealer_id} | ${formatCurrency(o.total_amount || 0)} | ${formatDate(o.created_at)}`,
  );
  return { result: `Bekleyen siparişler:\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadProblemDealers(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("bayi_dealers")
    .select("id, name, balance, is_active")
    .eq("tenant_id", ctx.tenantId)
    .or("balance.lt.0,is_active.eq.false")
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Sorunlu bayi yok.", needsApproval: false };

  const list = data.map((d) => {
    const issues: string[] = [];
    if (d.balance < 0) issues.push(`bakiye: ${formatCurrency(d.balance)}`);
    if (!d.is_active) issues.push("pasif");
    return `- [${d.id}] ${d.name} | ${issues.join(", ")}`;
  });
  return { result: `Sorunlu bayiler:\n${list.join("\n")}`, needsApproval: false };
}

async function handleScheduleVisit(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const dt = formatDate(input.visit_date as string);

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "bayi_satisTemsilcisi",
    actionType: "schedule_visit",
    actionData: {
      dealer_id: input.dealer_id,
      dealer_name: input.dealer_name,
      visit_date: input.visit_date,
      notes: input.notes || null,
    },
    message: `📅 *${input.dealer_name}* ziyareti planlansin mi?\n\n📍 Tarih: ${dt}${input.notes ? `\n📝 ${input.notes}` : ""}`,
    buttonLabel: "✅ Planla",
  });
}

async function handleCreateVisitNote(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "bayi_satisTemsilcisi",
    actionType: "create_visit_note",
    actionData: {
      dealer_id: input.dealer_id,
      dealer_name: input.dealer_name,
      note: input.note,
    },
    message: `📝 *${input.dealer_name}* için ziyaret notu eklensin mi?\n\n_${input.note}_`,
    buttonLabel: "✅ Ekle",
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
    agentKey: "bayi_satisTemsilcisi",
    actionType: "send_whatsapp",
    actionData: { phone: input.dealer_phone, message: input.message_text },
    message: `✉️ *${input.dealer_name}* bayisine mesaj taslağı:\n\n📱 ${input.dealer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const satisTemsilcisiToolHandlers: Record<string, ToolHandler> = {
  read_planned_visits: (input, ctx) => handleReadPlannedVisits(input, ctx),
  read_pending_orders: (input, ctx) => handleReadPendingOrders(input, ctx),
  read_problem_dealers: (input, ctx) => handleReadProblemDealers(input, ctx),
  schedule_visit: handleScheduleVisit,
  create_visit_note: handleCreateVisitNote,
  draft_message: handleDraftMessage,
};

// -- Agent Definition --------------------------------------------------------

export const satisTemsilcisiAgent: AgentDefinition = {
  key: "bayi_satisTemsilcisi",
  name: "Satış Temsilcisi",
  icon: "🤝",
  tools: SATIS_TEMSILCISI_TOOLS,
  toolHandlers: satisTemsilcisiToolHandlers,

  systemPrompt:
    `Sen bayi yönetim sisteminin saha satış temsilcisisin. Görevin bayi ziyaret planlaması, sipariş takibi ve sorunlu bayilerin yönetimi.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_planned_visits: Yaklaşan ziyaret planlarını oku (7 gün)\n` +
    `- read_pending_orders: Bekleyen siparişleri oku\n` +
    `- read_problem_dealers: Sorunlu bayileri oku (negatif bakiye / pasif)\n` +
    `- schedule_visit: Bayi ziyareti planla (onay gerektirir)\n` +
    `- create_visit_note: Ziyaret notu ekle (onay gerektirir)\n` +
    `- draft_message: Bayiye taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Bayiye ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Önce veri topla (read_planned_visits, read_pending_orders, read_problem_dealers), sonra analiz et, sonra aksiyon öner.\n` +
    `- Sorunlu bayilere ve gecikmiş ziyaretlere özellikle dikkat et.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const in3d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Planned visits in next 3 days
    const { data: visits } = await supabase
      .from("bayi_dealer_visits")
      .select("id, dealer_id, visit_date, notes, bayi_dealers(name)")
      .eq("tenant_id", ctx.tenantId)
      .gte("visit_date", today)
      .lte("visit_date", in3d)
      .order("visit_date", { ascending: true })
      .limit(10);

    // Pending orders
    const { data: pendingOrders } = await supabase
      .from("bayi_orders")
      .select("id, dealer_id, total_amount, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "pending");

    // Problem dealers (negative balance or inactive)
    const { data: problemDealers } = await supabase
      .from("bayi_dealers")
      .select("id, name, balance, is_active")
      .eq("tenant_id", ctx.tenantId)
      .or("balance.lt.0,is_active.eq.false")
      .limit(10);

    const recentMessages = await getRecentMessages(ctx.userId, "bayi_satisTemsilcisi", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "bayi_satisTemsilcisi", 5);

    return {
      plannedVisits: visits?.length || 0,
      visits: (visits || []).slice(0, 5).map((v) => ({
        id: v.id,
        dealerId: v.dealer_id,
        dealerName: (v.bayi_dealers as unknown as { name: string } | null)?.name || v.dealer_id,
        date: v.visit_date,
        notes: v.notes,
      })),
      pendingOrders: pendingOrders?.length || 0,
      pendingTotal: (pendingOrders || []).reduce((s, o) => s + (o.total_amount || 0), 0),
      problemDealers: (problemDealers || []).map((d) => ({
        id: d.id,
        name: d.name,
        balance: d.balance,
        isActive: d.is_active,
      })),
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
    const plannedVisits = data.plannedVisits as number;
    const pendingOrders = data.pendingOrders as number;
    const problemDealers = data.problemDealers as Array<{ id: string; name: string; balance: number; isActive: boolean }>;
    const visits = data.visits as Array<{ id: string; dealerName: string; date: string; notes?: string }>;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    if (plannedVisits === 0 && pendingOrders === 0 && (!problemDealers || problemDealers.length === 0)) return "";

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    prompt += `### Ziyaret Planı (3 gün)\n`;
    if (visits?.length) {
      for (const v of visits) {
        prompt += `- ${formatDate(v.date)} | ${v.dealerName}${v.notes ? ` | ${v.notes}` : ""}\n`;
      }
    } else {
      prompt += `- Planlanan ziyaret yok\n`;
    }

    prompt += `\n### Bekleyen Siparişler\n`;
    prompt += `- Toplam: ${pendingOrders}`;
    if (data.pendingTotal) {
      prompt += ` (${formatCurrency(data.pendingTotal as number)})`;
    }
    prompt += `\n`;

    if (problemDealers?.length) {
      prompt += `\n### Sorunlu Bayiler\n`;
      for (const d of problemDealers) {
        const issues: string[] = [];
        if (d.balance < 0) issues.push(`bakiye: ${formatCurrency(d.balance)}`);
        if (!d.isActive) issues.push("pasif");
        prompt += `- [${d.id}] ${d.name} | ${issues.join(", ")}\n`;
      }
    }

    if (recentDecisions?.length) {
      prompt += `\n### Son Kararlar\n`;
      for (const dec of recentDecisions) {
        const dt = new Date(dec.date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
        prompt += `- ${dt}: ${dec.actions.join(", ")}\n`;
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
      case "schedule_visit": {
        const { error } = await supabase.from("bayi_dealer_visits").insert({
          tenant_id: ctx.tenantId,
          dealer_id: actionData.dealer_id,
          visit_date: actionData.visit_date,
          notes: actionData.notes || null,
          created_by: ctx.userId,
        });
        if (error) return `Hata: ${error.message}`;
        return `${actionData.dealer_name} için ziyaret planlandı (${formatDate(actionData.visit_date as string)}).`;
      }

      case "create_visit_note": {
        const { error } = await supabase.from("bayi_dealer_visits").insert({
          tenant_id: ctx.tenantId,
          dealer_id: actionData.dealer_id,
          visit_date: new Date().toISOString().slice(0, 10),
          notes: actionData.note,
          created_by: ctx.userId,
        });
        if (error) return `Hata: ${error.message}`;
        return `${actionData.dealer_name} için ziyaret notu eklendi.`;
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
