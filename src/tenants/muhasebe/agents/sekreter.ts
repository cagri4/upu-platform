/**
 * Sekreter Agent — V2 (tool-using, memory-backed)
 *
 * Manages taxpayers, declaration calendar, appointments, daily briefing.
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

const SEKRETER_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_mukellefler",
    description: "Mukellef listesini oku. filter: 'active'|'all'.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["active", "all"], description: "Filtre turu" },
      },
      required: [],
    },
  },
  {
    name: "read_calendar",
    description: "Beyanname takvimini oku. filter: 'upcoming'|'overdue'|'all'.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["upcoming", "overdue", "all"], description: "Filtre turu" },
      },
      required: [],
    },
  },
  {
    name: "read_appointments",
    description: "Randevulari oku. filter: 'today'|'upcoming'|'all'.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["today", "upcoming", "all"], description: "Filtre turu" },
      },
      required: [],
    },
  },
  {
    name: "create_reminder",
    description: "Hatirlatma olustur. Kullanici onayiyla kaydedilir.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Hatirlatma turu (beyanname/randevu/genel)" },
        message: { type: "string", description: "Hatirlatma mesaji" },
        deadline_date: { type: "string", description: "Son tarih (YYYY-MM-DD)" },
      },
      required: ["type", "message", "deadline_date"],
    },
  },
  {
    name: "draft_message",
    description: "Mukelleflere taslak mesaj hazirla. Direkt gondermez, kullaniciya gosterir.",
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

async function handleReadMukellefler(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  let query = supabase
    .from("muh_mukellefler")
    .select("id, name, vkn, phone, is_active")
    .eq("tenant_id", ctx.tenantId)
    .order("name", { ascending: true })
    .limit(20);

  if (input.filter === "active") {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Kayitli mukellef yok.", needsApproval: false };

  const list = data.map((m: Record<string, unknown>) =>
    `- [${m.id}] ${m.name} | VKN:${m.vkn || "?"} | Tel:${m.phone || "?"} | ${m.is_active ? "Aktif" : "Pasif"}`
  );
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadCalendar(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("muh_beyanname_statuses")
    .select("id, beyanname_type, period, status, deadline_date")
    .eq("tenant_id", ctx.tenantId)
    .order("deadline_date", { ascending: true })
    .limit(15);

  if (input.filter === "upcoming") {
    query = query.neq("status", "tamamlandi").gte("deadline_date", today);
  } else if (input.filter === "overdue") {
    query = query.neq("status", "tamamlandi").lt("deadline_date", today);
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Beyanname takvimi bos.", needsApproval: false };

  const list = data.map((s: Record<string, unknown>) =>
    `- [${s.id}] ${s.beyanname_type} (${s.period || "-"}) | ${s.status} | Son: ${s.deadline_date || "-"}`
  );
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadAppointments(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("muh_appointments")
    .select("id, date, time, subject, notes")
    .eq("tenant_id", ctx.tenantId)
    .order("date", { ascending: true })
    .limit(10);

  if (input.filter === "today") {
    query = query.eq("date", today);
  } else if (input.filter === "upcoming") {
    query = query.gte("date", today);
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Randevu bulunamadi.", needsApproval: false };

  const list = data.map((a: Record<string, unknown>) =>
    `- [${a.id}] ${a.date} ${a.time || ""} | ${a.subject || "Konu belirtilmemis"}`
  );
  return { result: list.join("\n"), needsApproval: false };
}

async function handleCreateReminder(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "muh_sekreter",
    actionType: "create_reminder",
    actionData: { type: input.type, message: input.message, deadline_date: input.deadline_date },
    message: `Hatirlatma olusturulsun mu?\n\nTur: ${input.type}\nMesaj: ${input.message}\nSon tarih: ${input.deadline_date}`,
    buttonLabel: "Olustur",
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
    agentKey: "muh_sekreter",
    actionType: "send_whatsapp",
    actionData: { phone: input.recipient_phone, message: input.message_text },
    message: `*${input.recipient_name}* icin mesaj taslagi:\n\n${input.recipient_phone}\n_${input.message_text}_`,
    buttonLabel: "Gonder",
  });
}

const sekreterToolHandlers: Record<string, ToolHandler> = {
  read_mukellefler: (input, ctx) => handleReadMukellefler(input, ctx),
  read_calendar: (input, ctx) => handleReadCalendar(input, ctx),
  read_appointments: (input, ctx) => handleReadAppointments(input, ctx),
  create_reminder: handleCreateReminder,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const sekreterAgent: AgentDefinition = {
  key: "muh_sekreter",
  name: "Sekreter",
  icon: "📅",
  tools: SEKRETER_TOOLS,
  toolHandlers: sekreterToolHandlers,

  systemPrompt:
    `Sen muhasebe burosunun sekretersin. Gorevin mukellefleri yonetmek, beyanname takvimini takip etmek, randevulari organize etmek ve gunluk brifing hazirlamak.\n\n` +
    `## Kullanabilecegin Araclar\n` +
    `- read_mukellefler: Mukellef listesi (filtreli)\n` +
    `- read_calendar: Beyanname takvimi (filtreli)\n` +
    `- read_appointments: Randevular (filtreli)\n` +
    `- create_reminder: Hatirlatma olustur (onay gerektirir)\n` +
    `- draft_message: Mukelleflere mesaj taslagi (onay gerektirir)\n` +
    `- notify_human: Kullaniciya bildirim/oneri gonder\n` +
    `- read_db: Veritabanindan veri oku\n\n` +
    `## Kurallar\n` +
    `- Kimseye ASLA direkt mesaj gonderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon icin kullanici onayi al.\n` +
    `- Otonomi seviyesi: HER SEYI SOR — hicbir yazma islemini onaysiz yapma.\n` +
    `- Once veri topla, sonra analiz et, sonra aksiyon oner.\n` +
    `- Kullanici tercihlerine (agent_config) gore davran.\n` +
    `- Yapilacak bir sey yoksa hicbir tool cagirma, kisa bir Turkce ozet yaz.\n` +
    `- Turkce yanit ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "muh_sekreter");
    const today = new Date().toISOString().split("T")[0];

    const { count: mukellefCount } = await supabase
      .from("muh_mukellefler")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);

    const { count: pendingFilings } = await supabase
      .from("muh_beyanname_statuses")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "tamamlandi");

    const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { count: upcomingDeadlines } = await supabase
      .from("muh_beyanname_statuses")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "tamamlandi")
      .gte("deadline_date", today)
      .lte("deadline_date", weekLater);

    const { count: todayAppointments } = await supabase
      .from("muh_appointments")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("date", today);

    const recentMessages = await getRecentMessages(ctx.userId, "muh_sekreter", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "muh_sekreter", 5);

    return {
      mukellefCount: mukellefCount ?? 0,
      pendingFilings: pendingFilings ?? 0,
      upcomingDeadlines: upcomingDeadlines ?? 0,
      todayAppointments: todayAppointments ?? 0,
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
    prompt += `### Genel Bakis\n`;
    prompt += `- Aktif mukellef: ${data.mukellefCount}\n`;
    prompt += `- Bekleyen beyanname: ${data.pendingFilings}\n`;
    prompt += `- 7 gun icinde deadline: ${data.upcomingDeadlines}\n`;
    prompt += `- Bugun randevu: ${data.todayAppointments}\n`;

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
      case "create_reminder": {
        const { error } = await supabase.from("muh_reminders").insert({
          tenant_id: ctx.tenantId,
          type: actionData.type as string,
          message: actionData.message as string,
          deadline_date: actionData.deadline_date as string,
        });
        if (error) return `Hata: ${error.message}`;
        return "Hatirlatma olusturuldu.";
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
