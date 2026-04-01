/**
 * Resepsiyon Agent — V2 (tool-using, memory-backed)
 *
 * Tracks guest messages, VIP guests, escalations, and communication gaps.
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

const RESEPSIYON_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_guest_messages",
    description:
      "Misafir mesajlarını oku. filter: 'unanswered'|'all'. Cevaplanmamış mesajları önceliklendirir.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["unanswered", "all"], description: "Filtre türü" },
      },
      required: [],
    },
  },
  {
    name: "read_today_arrivals",
    description: "Bugünkü check-in listesini oku. Oda hazırlığı ve karşılama için.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_active_guests",
    description: "Otelde konaklayan aktif misafirleri listele.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "escalate_message",
    description: "Cevaplanmamış mesajı eskalasyon olarak işaretle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        message_id: { type: "string", description: "Mesaj ID" },
        guest_name: { type: "string", description: "Misafir adı" },
        reason: { type: "string", description: "Eskalasyon nedeni" },
      },
      required: ["message_id", "guest_name", "reason"],
    },
  },
  {
    name: "mark_message_answered",
    description: "Mesajı cevaplanmış olarak işaretle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        message_id: { type: "string", description: "Mesaj ID" },
        guest_name: { type: "string", description: "Misafir adı" },
      },
      required: ["message_id", "guest_name"],
    },
  },
  {
    name: "draft_message",
    description: "Misafire taslak WhatsApp mesajı hazırla. Direkt göndermez, kullanıcıya gösterir.",
    input_schema: {
      type: "object",
      properties: {
        guest_name: { type: "string", description: "Misafir adı" },
        guest_phone: { type: "string", description: "Telefon numarası" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["guest_name", "guest_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadGuestMessages(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  let query = supabase
    .from("otel_guest_messages")
    .select("id, guest_name, message, created_at, is_answered")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(15);

  if (input.filter === "unanswered") {
    query = query.eq("is_answered", false);
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Mesaj yok.", needsApproval: false };

  const list = data.map((m) => {
    const ago = Math.floor((Date.now() - new Date(m.created_at).getTime()) / 60000);
    const agoStr = ago < 60 ? `${ago}dk` : `${Math.floor(ago / 60)}sa`;
    return `- [${m.id}] ${m.guest_name} (${agoStr} önce)${m.is_answered ? " ✅" : " ⏳"}: ${(m.message || "").substring(0, 80)}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadTodayArrivals(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("otel_reservations")
    .select("id, guest_name, room_number, check_in_date, guest_phone, notes")
    .eq("tenant_id", ctx.tenantId)
    .eq("check_in_date", today)
    .in("status", ["confirmed", "pending"])
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Bugün check-in yok.", needsApproval: false };

  const list = data.map((r) =>
    `- [${r.id}] ${r.guest_name} | Oda: ${r.room_number || "atanmadı"} | Tel: ${r.guest_phone || "?"} ${r.notes ? `| Not: ${r.notes.substring(0, 40)}` : ""}`,
  );
  return { result: `Bugün ${data.length} check-in:\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadActiveGuests(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("otel_reservations")
    .select("id, guest_name, room_number, check_in_date, check_out_date, guest_phone")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "checked_in")
    .limit(30);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Aktif misafir yok.", needsApproval: false };

  const list = data.map((r) => {
    const nights = Math.ceil(
      (new Date(r.check_out_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return `- [${r.id}] ${r.guest_name} | Oda ${r.room_number} | ${nights} gece kaldı`;
  });
  return { result: `${data.length} aktif misafir:\n${list.join("\n")}`, needsApproval: false };
}

async function handleEscalateMessage(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "otel_resepsiyon",
    actionType: "escalate_message",
    actionData: { message_id: input.message_id, guest_name: input.guest_name },
    message: `🚨 *${input.guest_name}* mesajı eskalasyon gerektiriyor:\n\n📝 ${input.reason}`,
    buttonLabel: "✅ Eskalasyon",
  });
}

async function handleMarkMessageAnswered(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "otel_resepsiyon",
    actionType: "mark_message_answered",
    actionData: { message_id: input.message_id },
    message: `✅ *${input.guest_name}* mesajı cevaplanmış olarak işaretlensin mi?`,
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
    agentKey: "otel_resepsiyon",
    actionType: "send_whatsapp",
    actionData: { phone: input.guest_phone, message: input.message_text },
    message: `✉️ *${input.guest_name}* misafirine mesaj taslağı:\n\n📱 ${input.guest_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const resepsiyonToolHandlers: Record<string, ToolHandler> = {
  read_guest_messages: (input, ctx) => handleReadGuestMessages(input, ctx),
  read_today_arrivals: (input, ctx) => handleReadTodayArrivals(input, ctx),
  read_active_guests: (input, ctx) => handleReadActiveGuests(input, ctx),
  escalate_message: handleEscalateMessage,
  mark_message_answered: handleMarkMessageAnswered,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const resepsiyonAgent: AgentDefinition = {
  key: "otel_resepsiyon",
  name: "Resepsiyon",
  icon: "🛎️",
  tools: RESEPSIYON_TOOLS,
  toolHandlers: resepsiyonToolHandlers,

  systemPrompt:
    `Sen otelin resepsiyon görevlisisin. Görevin misafir mesajlarını takip etmek, cevaplanmamışları tespit etmek, VIP misafirleri öne çıkarmak ve eskalasyon gerektiren durumları bildirmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_guest_messages: Misafir mesajlarını oku (unanswered veya all)\n` +
    `- read_today_arrivals: Bugünkü check-in listesi\n` +
    `- read_active_guests: Oteldeki aktif misafirler\n` +
    `- escalate_message: Mesajı eskalasyon yap (onay gerektirir)\n` +
    `- mark_message_answered: Mesajı cevaplanmış işaretle (onay gerektirir)\n` +
    `- draft_message: Misafire taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Misafire ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_guest_messages, read_today_arrivals), sonra analiz et, sonra aksiyon öner.\n` +
    `- 30+ dakika cevaplanmamış mesajlara özellikle dikkat et.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    const { data: messages } = await supabase
      .from("otel_guest_messages")
      .select("id, guest_name, message, created_at, is_answered")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_answered", false)
      .order("created_at", { ascending: false })
      .limit(10);

    const today = new Date().toISOString().slice(0, 10);
    const { count: todayCheckins } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("check_in_date", today)
      .in("status", ["confirmed", "pending"]);

    const { count: activeGuests } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "checked_in");

    const recentMessages = await getRecentMessages(ctx.userId, "otel_resepsiyon", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "otel_resepsiyon", 5);

    return {
      unansweredCount: messages?.length || 0,
      unansweredSample: (messages || []).slice(0, 5).map((m) => ({
        id: m.id,
        guestName: m.guest_name,
        message: m.message?.substring(0, 80),
        minutesAgo: Math.floor((Date.now() - new Date(m.created_at).getTime()) / 60000),
      })),
      todayCheckins: todayCheckins || 0,
      activeGuests: activeGuests || 0,
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
    const unanswered = data.unansweredCount as number;
    const checkins = data.todayCheckins as number;
    const active = data.activeGuests as number;

    if (unanswered === 0 && checkins === 0 && active === 0) return "";

    const sample = data.unansweredSample as Array<{ id: string; guestName: string; message: string; minutesAgo: number }>;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;
    prompt += `### Resepsiyon Özeti\n`;
    prompt += `- Cevaplanmamış mesaj: ${unanswered}\n`;
    prompt += `- Bugün check-in: ${checkins}\n`;
    prompt += `- Aktif misafir: ${active}\n`;

    if (sample?.length) {
      prompt += `\n### Cevaplanmamış Mesajlar\n`;
      for (const m of sample) {
        prompt += `- [${m.id}] ${m.guestName} (${m.minutesAgo}dk önce): ${m.message}\n`;
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
      case "escalate_message": {
        const { error } = await supabase
          .from("otel_guest_messages")
          .update({ is_escalated: true, updated_at: new Date().toISOString() })
          .eq("id", actionData.message_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return `${actionData.guest_name} mesajı eskalasyon olarak işaretlendi.`;
      }

      case "mark_message_answered": {
        const { error } = await supabase
          .from("otel_guest_messages")
          .update({ is_answered: true, updated_at: new Date().toISOString() })
          .eq("id", actionData.message_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return "Mesaj cevaplanmış olarak işaretlendi.";
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
