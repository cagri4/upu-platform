/**
 * Rezervasyon Uzmanı Agent — V2 (tool-using, memory-backed)
 *
 * Tracks occupancy, today's check-in/out, pricing opportunities, cancellations.
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

const REZERVASYON_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_occupancy",
    description: "Doluluk oranını hesapla: toplam oda, dolu oda, yüzde.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_today_checkins",
    description: "Bugünkü check-in listesini oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_today_checkouts",
    description: "Bugünkü check-out listesini oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_upcoming_reservations",
    description: "Önümüzdeki 7 gün içindeki rezervasyonları oku.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Kaç gün ileri (varsayılan 7)" },
      },
      required: [],
    },
  },
  {
    name: "update_room_price",
    description: "Oda tip fiyatını güncelle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        room_type: { type: "string", description: "Oda tipi (single, double, suite vb.)" },
        new_price: { type: "number", description: "Yeni gecelik fiyat (TL)" },
        reason: { type: "string", description: "Güncelleme nedeni" },
      },
      required: ["room_type", "new_price"],
    },
  },
  {
    name: "flag_no_show",
    description: "Gelmemiş misafiri no-show olarak işaretle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        reservation_id: { type: "string", description: "Rezervasyon ID" },
        guest_name: { type: "string", description: "Misafir adı" },
      },
      required: ["reservation_id", "guest_name"],
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

async function handleReadOccupancy(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { count: totalRooms } = await supabase
    .from("otel_rooms")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId);

  const { count: occupiedRooms } = await supabase
    .from("otel_reservations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "checked_in");

  const total = totalRooms || 0;
  const occupied = occupiedRooms || 0;
  const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return {
    result: `Toplam oda: ${total}\nDolu: ${occupied}\nBoş: ${total - occupied}\nDoluluk: %${rate}`,
    needsApproval: false,
  };
}

async function handleReadTodayCheckins(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("otel_reservations")
    .select("id, guest_name, room_number, guest_phone, notes")
    .eq("tenant_id", ctx.tenantId)
    .eq("check_in_date", today)
    .in("status", ["confirmed", "pending"])
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Bugün check-in yok.", needsApproval: false };

  const list = data.map((r) =>
    `- [${r.id}] ${r.guest_name} | Oda: ${r.room_number || "atanmadı"} | Tel: ${r.guest_phone || "?"}`,
  );
  return { result: `${data.length} check-in:\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadTodayCheckouts(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("otel_reservations")
    .select("id, guest_name, room_number")
    .eq("tenant_id", ctx.tenantId)
    .eq("check_out_date", today)
    .eq("status", "checked_in")
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Bugün check-out yok.", needsApproval: false };

  const list = data.map((r) =>
    `- [${r.id}] ${r.guest_name} | Oda: ${r.room_number}`,
  );
  return { result: `${data.length} check-out:\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadUpcomingReservations(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const days = (input.days as number) || 7;
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("otel_reservations")
    .select("id, guest_name, room_number, check_in_date, check_out_date, status")
    .eq("tenant_id", ctx.tenantId)
    .gte("check_in_date", today)
    .lte("check_in_date", future)
    .in("status", ["confirmed", "pending"])
    .order("check_in_date", { ascending: true })
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: `Önümüzdeki ${days} gün rezervasyon yok.`, needsApproval: false };

  const list = data.map((r) =>
    `- [${r.id}] ${r.guest_name} | ${r.check_in_date} → ${r.check_out_date} | Oda: ${r.room_number || "atanmadı"} | ${r.status}`,
  );
  return { result: `${data.length} yaklaşan rezervasyon:\n${list.join("\n")}`, needsApproval: false };
}

async function handleUpdateRoomPrice(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const roomType = input.room_type as string;
  const newPrice = input.new_price as number;
  const reason = (input.reason as string) || "";
  const priceStr = `₺${Number(newPrice).toLocaleString("tr-TR")}`;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "otel_rezervasyon",
    actionType: "update_room_price",
    actionData: { room_type: roomType, new_price: newPrice },
    message: `"${roomType}" oda tipi fiyatı ${priceStr}/gece olarak güncellensin mi?${reason ? `\n📝 ${reason}` : ""}`,
    buttonLabel: "✅ Güncelle",
  });
}

async function handleFlagNoShow(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "otel_rezervasyon",
    actionType: "flag_no_show",
    actionData: { reservation_id: input.reservation_id, guest_name: input.guest_name },
    message: `🚫 *${input.guest_name}* gelmedi. No-show olarak işaretlensin mi?`,
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
    agentKey: "otel_rezervasyon",
    actionType: "send_whatsapp",
    actionData: { phone: input.guest_phone, message: input.message_text },
    message: `✉️ *${input.guest_name}* misafirine mesaj taslağı:\n\n📱 ${input.guest_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const rezervasyonToolHandlers: Record<string, ToolHandler> = {
  read_occupancy: (input, ctx) => handleReadOccupancy(input, ctx),
  read_today_checkins: (input, ctx) => handleReadTodayCheckins(input, ctx),
  read_today_checkouts: (input, ctx) => handleReadTodayCheckouts(input, ctx),
  read_upcoming_reservations: (input, ctx) => handleReadUpcomingReservations(input, ctx),
  update_room_price: handleUpdateRoomPrice,
  flag_no_show: handleFlagNoShow,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const rezervasyonAgent: AgentDefinition = {
  key: "otel_rezervasyon",
  name: "Rezervasyon Uzmanı",
  icon: "📅",
  tools: REZERVASYON_TOOLS,
  toolHandlers: rezervasyonToolHandlers,

  systemPrompt:
    `Sen otelin rezervasyon uzmanısın. Görevin doluluk oranını takip etmek, check-in/out süreçlerini yönetmek, fiyat optimizasyonu önermek ve no-show'ları tespit etmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_occupancy: Doluluk oranı\n` +
    `- read_today_checkins: Bugünkü check-in listesi\n` +
    `- read_today_checkouts: Bugünkü check-out listesi\n` +
    `- read_upcoming_reservations: Yaklaşan rezervasyonlar\n` +
    `- update_room_price: Oda fiyatı güncelle (onay gerektirir)\n` +
    `- flag_no_show: No-show işaretle (onay gerektirir)\n` +
    `- draft_message: Misafire taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Misafire ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_occupancy, read_today_checkins), sonra analiz et, sonra aksiyon öner.\n` +
    `- Düşük dolulukta (%50 altı) fiyat önerisi yap.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "otel_rezervasyon");
    const today = new Date().toISOString().slice(0, 10);

    const { count: totalRooms } = await supabase
      .from("otel_rooms")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);

    const { count: occupiedRooms } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "checked_in");

    const { count: todayCheckins } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("check_in_date", today)
      .in("status", ["confirmed", "pending"]);

    const { count: todayCheckouts } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("check_out_date", today)
      .eq("status", "checked_in");

    const total = totalRooms || 0;
    const occupied = occupiedRooms || 0;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    const recentMessages = await getRecentMessages(ctx.userId, "otel_rezervasyon", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "otel_rezervasyon", 5);

    return {
      totalRooms: total,
      occupiedRooms: occupied,
      occupancyRate,
      todayCheckins: todayCheckins || 0,
      todayCheckouts: todayCheckouts || 0,
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
    const total = data.totalRooms as number;
    if (!total) return "";

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
    prompt += `### Rezervasyon Özeti\n`;
    prompt += `- Toplam oda: ${total}\n`;
    prompt += `- Dolu: ${data.occupiedRooms}\n`;
    prompt += `- Doluluk: %${data.occupancyRate}\n`;
    prompt += `- Bugün check-in: ${data.todayCheckins}\n`;
    prompt += `- Bugün check-out: ${data.todayCheckouts}\n`;

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
      case "update_room_price": {
        const { error } = await supabase
          .from("otel_rooms")
          .update({ price_per_night: actionData.new_price, updated_at: new Date().toISOString() })
          .eq("tenant_id", ctx.tenantId)
          .eq("room_type", actionData.room_type);
        if (error) return `Hata: ${error.message}`;
        return `${actionData.room_type} oda fiyatı güncellendi: ₺${Number(actionData.new_price).toLocaleString("tr-TR")}/gece`;
      }

      case "flag_no_show": {
        const { error } = await supabase
          .from("otel_reservations")
          .update({ status: "no_show", updated_at: new Date().toISOString() })
          .eq("id", actionData.reservation_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return `${actionData.guest_name} no-show olarak işaretlendi.`;
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
