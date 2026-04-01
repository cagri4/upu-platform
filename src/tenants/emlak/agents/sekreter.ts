/**
 * Sekreter Agent — V2 (tool-using, memory-backed)
 *
 * Tracks pending reminders, expiring contracts, daily tasks.
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

// ── Domain Tools ────────────────────────────────────────────────────────

const SEKRETER_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_reminders",
    description:
      "Kullanıcının yaklaşan hatırlatmalarını oku. timeRange: 'today' (24 saat) veya 'week' (7 gün).",
    input_schema: {
      type: "object",
      properties: {
        time_range: {
          type: "string",
          enum: ["today", "week"],
          description: "Zaman aralığı",
        },
      },
      required: ["time_range"],
    },
  },
  {
    name: "read_contracts",
    description:
      "Kullanıcının süresi dolan sözleşmelerini oku. timeRange: 'week' (7 gün) veya 'month' (30 gün).",
    input_schema: {
      type: "object",
      properties: {
        time_range: {
          type: "string",
          enum: ["week", "month"],
          description: "Zaman aralığı",
        },
      },
      required: ["time_range"],
    },
  },
  {
    name: "mark_reminder_done",
    description:
      "Bir hatırlatmayı tamamlandı olarak işaretle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        reminder_id: { type: "string", description: "Hatırlatma ID" },
        reminder_title: { type: "string", description: "Hatırlatma başlığı (kullanıcıya göstermek için)" },
      },
      required: ["reminder_id", "reminder_title"],
    },
  },
  {
    name: "create_follow_up",
    description:
      "Yeni bir takip/hatırlatma oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Hatırlatma başlığı" },
        remind_at: { type: "string", description: "ISO tarih (ne zaman hatırlatılacak)" },
        note: { type: "string", description: "Ek not (opsiyonel)" },
      },
      required: ["title", "remind_at"],
    },
  },
  {
    name: "draft_message",
    description:
      "Müşteriye gönderilecek taslak WhatsApp mesajı hazırla. Direkt GÖNDERMEZ — kullanıcıya gösterir, onay bekler.",
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string", description: "Müşteri adı" },
        customer_phone: { type: "string", description: "Müşteri telefon numarası" },
        message_text: { type: "string", description: "Gönderilecek mesaj metni" },
      },
      required: ["customer_name", "customer_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadReminders(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const range = input.time_range === "week" ? 7 : 1;
  const until = new Date(Date.now() + range * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, topic, note, remind_at")
    .eq("user_id", ctx.userId)
    .eq("triggered", false)
    .gte("remind_at", now)
    .lte("remind_at", until)
    .order("remind_at", { ascending: true })
    .limit(10);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Yaklaşan hatırlatma yok.", needsApproval: false };

  const list = data.map((r) => {
    const dt = new Date(r.remind_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
    return `- [${r.id}] ${r.title || r.topic} → ${dt}${r.note ? ` (${r.note})` : ""}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadContracts(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const range = input.time_range === "month" ? 30 : 7;
  const until = new Date(Date.now() + range * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("contracts")
    .select("id, title, end_date, customer_name")
    .eq("user_id", ctx.userId)
    .gte("end_date", now)
    .lte("end_date", until)
    .order("end_date", { ascending: true })
    .limit(10);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Süresi dolan sözleşme yok.", needsApproval: false };

  const list = data.map((c) => {
    const dt = new Date(c.end_date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
    return `- [${c.id}] ${c.title}${c.customer_name ? ` (${c.customer_name})` : ""} → ${dt}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleMarkReminderDone(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  // Delegate to notify_human so user approves first
  const { sendButtons } = await import("@/platform/whatsapp/send");
  const { updateTaskStatus } = await import("@/platform/agents/memory");
  const supabase = getServiceClient();

  const { data: proposal } = await supabase
    .from("agent_proposals")
    .insert({
      user_id: ctx.userId,
      tenant_id: ctx.tenantId,
      agent_key: "sekreter",
      action_type: "mark_reminder_done",
      action_data: { reminder_id: input.reminder_id },
      message: `"${input.reminder_title}" hatırlatması tamamlandı olarak işaretlensin mi?`,
      status: "pending",
    })
    .select("id")
    .single();

  if (!proposal) return { result: "Öneri oluşturulamadı", needsApproval: false };

  await updateTaskStatus(taskId, "waiting_human", { pending_proposal_id: proposal.id });

  await sendButtons(
    ctx.phone,
    `${agentIcon} *${agentName}*\n\n✅ "${input.reminder_title}" hatırlatması tamamlandı olarak işaretlensin mi?`,
    [
      { id: `agent_ok:${proposal.id}`, title: "✅ Tamamla" },
      { id: `agent_no:${proposal.id}`, title: "❌ Geç" },
    ],
  );

  return { result: `Onay bekleniyor: ${proposal.id}`, needsApproval: true };
}

async function handleCreateFollowUp(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const { sendButtons } = await import("@/platform/whatsapp/send");
  const { updateTaskStatus } = await import("@/platform/agents/memory");
  const supabase = getServiceClient();

  const title = input.title as string;
  const remindAt = input.remind_at as string;
  const note = input.note as string | undefined;
  const dt = new Date(remindAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

  const { data: proposal } = await supabase
    .from("agent_proposals")
    .insert({
      user_id: ctx.userId,
      tenant_id: ctx.tenantId,
      agent_key: "sekreter",
      action_type: "create_reminder",
      action_data: { title, remind_at: remindAt, note: note || null },
      message: `Takip oluşturulsun mu?\n\n📌 ${title}\n⏰ ${dt}${note ? `\n📝 ${note}` : ""}`,
      status: "pending",
    })
    .select("id")
    .single();

  if (!proposal) return { result: "Öneri oluşturulamadı", needsApproval: false };

  await updateTaskStatus(taskId, "waiting_human", { pending_proposal_id: proposal.id });

  await sendButtons(
    ctx.phone,
    `${agentIcon} *${agentName}*\n\n📌 Takip oluşturulsun mu?\n\n*${title}*\n⏰ ${dt}${note ? `\n📝 ${note}` : ""}`,
    [
      { id: `agent_ok:${proposal.id}`, title: "✅ Oluştur" },
      { id: `agent_no:${proposal.id}`, title: "❌ Geç" },
    ],
  );

  return { result: `Onay bekleniyor: ${proposal.id}`, needsApproval: true };
}

async function handleDraftMessage(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const { sendButtons } = await import("@/platform/whatsapp/send");
  const { updateTaskStatus } = await import("@/platform/agents/memory");
  const supabase = getServiceClient();

  const name = input.customer_name as string;
  const phone = input.customer_phone as string;
  const text = input.message_text as string;

  const { data: proposal } = await supabase
    .from("agent_proposals")
    .insert({
      user_id: ctx.userId,
      tenant_id: ctx.tenantId,
      agent_key: "sekreter",
      action_type: "send_whatsapp",
      action_data: { phone, message: text },
      message: `${name} kişisine mesaj gönderilsin mi?\n\n📱 ${phone}\n💬 ${text}`,
      status: "pending",
    })
    .select("id")
    .single();

  if (!proposal) return { result: "Öneri oluşturulamadı", needsApproval: false };

  await updateTaskStatus(taskId, "waiting_human", { pending_proposal_id: proposal.id });

  await sendButtons(
    ctx.phone,
    `${agentIcon} *${agentName}*\n\n✉️ *${name}* kişisine mesaj taslağı:\n\n📱 ${phone}\n💬 _${text}_`,
    [
      { id: `agent_ok:${proposal.id}`, title: "✅ Gönder" },
      { id: `agent_no:${proposal.id}`, title: "❌ İptal" },
    ],
  );

  return { result: `Onay bekleniyor: ${proposal.id}`, needsApproval: true };
}

// ── Tool Handlers Map ───────────────────────────────────────────────────

const sekreterToolHandlers: Record<string, ToolHandler> = {
  read_reminders: (input, ctx) => handleReadReminders(input, ctx),
  read_contracts: (input, ctx) => handleReadContracts(input, ctx),
  mark_reminder_done: handleMarkReminderDone,
  create_follow_up: handleCreateFollowUp,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const sekreterAgent: AgentDefinition = {
  key: "sekreter",
  name: "Sekreter",
  icon: "📋",
  tools: SEKRETER_TOOLS,
  toolHandlers: sekreterToolHandlers,

  systemPrompt:
    `Sen emlak ofisinin sekreterisin. Görevin hatırlatmaları, sözleşme sürelerini ve günlük görevleri takip etmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_reminders: Yaklaşan hatırlatmaları oku (today veya week)\n` +
    `- read_contracts: Süresi dolan sözleşmeleri oku (week veya month)\n` +
    `- mark_reminder_done: Hatırlatmayı tamamla (onay gerektirir)\n` +
    `- create_follow_up: Yeni takip/hatırlatma oluştur (onay gerektirir)\n` +
    `- draft_message: Müşteriye mesaj taslağı hazırla (direkt göndermez, onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim/öneri gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Müşteriye ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_reminders, read_contracts), sonra analiz et, sonra aksiyon öner.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Reminders within next 24 hours
    const now = new Date().toISOString();
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: reminders } = await supabase
      .from("reminders")
      .select("id, title, topic, remind_at, note")
      .eq("user_id", ctx.userId)
      .eq("triggered", false)
      .gte("remind_at", now)
      .lte("remind_at", in24h)
      .order("remind_at", { ascending: true });

    // Contracts expiring within 7 days
    const in7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, title, end_date, customer_name")
      .eq("user_id", ctx.userId)
      .gte("end_date", now)
      .lte("end_date", in7d)
      .order("end_date", { ascending: true });

    // Memory: recent messages and task history
    const recentMessages = await getRecentMessages(ctx.userId, "sekreter", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "sekreter", 5);

    const reminderCount = reminders?.length || 0;
    const expiringContracts = contracts?.length || 0;

    return {
      reminderCount,
      reminders: (reminders || []).slice(0, 5).map((r) => ({
        id: r.id,
        title: r.title || r.topic,
        remindAt: r.remind_at,
        note: r.note,
      })),
      expiringContracts,
      contracts: (contracts || []).slice(0, 5).map((c) => ({
        id: c.id,
        title: c.title,
        customerName: c.customer_name,
        endDate: c.end_date,
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
    const reminderCount = data.reminderCount as number;
    const expiringContracts = data.expiringContracts as number;
    const reminders = data.reminders as Array<{ id: string; title: string; remindAt: string; note?: string }>;
    const contracts = data.contracts as Array<{ id: string; title: string; customerName?: string; endDate: string }>;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    if (reminderCount === 0 && expiringContracts === 0) return "";

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    if (reminderCount > 0) {
      prompt += `### Yaklaşan Hatırlatmalar (${reminderCount})\n`;
      for (const r of reminders || []) {
        const dt = new Date(r.remindAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
        prompt += `- [${r.id}] ${r.title} → ${dt}${r.note ? ` — ${r.note}` : ""}\n`;
      }
      prompt += "\n";
    }

    if (expiringContracts > 0) {
      prompt += `### Süresi Dolan Sözleşmeler (${expiringContracts})\n`;
      for (const c of contracts || []) {
        const dt = new Date(c.endDate).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
        prompt += `- [${c.id}] ${c.title}${c.customerName ? ` (${c.customerName})` : ""} → ${dt}\n`;
      }
      prompt += "\n";
    }

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
      case "mark_reminder_done": {
        const { error } = await supabase
          .from("reminders")
          .update({ triggered: true })
          .eq("id", actionData.reminder_id)
          .eq("user_id", ctx.userId);
        if (error) return `Hata: ${error.message}`;
        return "Hatırlatma tamamlandı olarak işaretlendi.";
      }

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
        return `Hatırlatma oluşturuldu: ${actionData.title}`;
      }

      case "sozlesme_yenile": {
        const { error } = await supabase
          .from("contracts")
          .update({
            end_date: actionData.new_end_date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", actionData.contract_id)
          .eq("user_id", ctx.userId);
        if (error) return `Hata: ${error.message}`;
        return "Sözleşme süresi güncellendi.";
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
