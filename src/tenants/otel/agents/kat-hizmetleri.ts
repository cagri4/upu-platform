/**
 * Kat Hizmetleri Agent — V2 (tool-using, memory-backed)
 *
 * Tracks room cleaning status, maintenance needs, and housekeeping task assignment.
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

const KAT_HIZMETLERI_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_room_status",
    description:
      "Oda durumlarını oku. filter: 'dirty'|'maintenance'|'all'. Temizlenmesi gereken odaları listeler.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["dirty", "maintenance", "all"], description: "Filtre türü" },
      },
      required: [],
    },
  },
  {
    name: "read_checkout_rooms",
    description: "Bugün check-out yapacak odaları oku (temizlik planlaması için).",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_checkin_rooms",
    description: "Bugün check-in beklenen odaları oku (hazır olmalı).",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_cleaning_status",
    description: "Oda temizlik durumunu güncelle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        room_id: { type: "string", description: "Oda ID" },
        room_number: { type: "string", description: "Oda numarası" },
        new_status: { type: "string", enum: ["clean", "dirty", "in_progress"], description: "Yeni durum" },
      },
      required: ["room_id", "room_number", "new_status"],
    },
  },
  {
    name: "set_room_maintenance",
    description: "Odayı bakıma al veya bakımdan çıkar. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        room_id: { type: "string", description: "Oda ID" },
        room_number: { type: "string", description: "Oda numarası" },
        maintenance: { type: "boolean", description: "true=bakıma al, false=bakımdan çıkar" },
        reason: { type: "string", description: "Bakım nedeni" },
      },
      required: ["room_id", "room_number", "maintenance"],
    },
  },
  {
    name: "create_cleaning_task",
    description: "Temizlik görevi oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        room_number: { type: "string", description: "Oda numarası" },
        task_type: { type: "string", enum: ["standard", "deep", "checkout"], description: "Temizlik türü" },
        priority: { type: "string", enum: ["high", "normal"], description: "Öncelik" },
        notes: { type: "string", description: "Ek notlar" },
      },
      required: ["room_number", "task_type"],
    },
  },
  {
    name: "draft_message",
    description: "Personele taslak WhatsApp mesajı hazırla. Direkt göndermez, kullanıcıya gösterir.",
    input_schema: {
      type: "object",
      properties: {
        staff_name: { type: "string", description: "Personel adı" },
        staff_phone: { type: "string", description: "Telefon numarası" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["staff_name", "staff_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadRoomStatus(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  let query = supabase
    .from("otel_rooms")
    .select("id, room_number, room_type, status, cleaning_status")
    .eq("tenant_id", ctx.tenantId)
    .order("room_number", { ascending: true })
    .limit(30);

  if (input.filter === "dirty") {
    query = query.eq("cleaning_status", "dirty");
  } else if (input.filter === "maintenance") {
    query = query.eq("status", "maintenance");
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Filtre sonucu boş.", needsApproval: false };

  const list = data.map((r) =>
    `- [${r.id}] Oda ${r.room_number} | ${r.room_type} | Durum: ${r.status} | Temizlik: ${r.cleaning_status}`,
  );
  return { result: `${data.length} oda:\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadCheckoutRooms(
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
    `- Oda ${r.room_number} | ${r.guest_name} (check-out sonrası temizlik gerekecek)`,
  );
  return { result: `${data.length} check-out odası:\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadCheckinRooms(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("otel_reservations")
    .select("id, guest_name, room_number")
    .eq("tenant_id", ctx.tenantId)
    .eq("check_in_date", today)
    .in("status", ["confirmed", "pending"])
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Bugün check-in yok.", needsApproval: false };

  // Check which rooms are dirty
  const roomNumbers = data.map((r) => r.room_number).filter(Boolean);
  const { data: rooms } = await supabase
    .from("otel_rooms")
    .select("room_number, cleaning_status")
    .eq("tenant_id", ctx.tenantId)
    .in("room_number", roomNumbers);

  const dirtyMap = new Map((rooms || []).map((r) => [r.room_number, r.cleaning_status]));

  const list = data.map((r) => {
    const status = dirtyMap.get(r.room_number) || "?";
    const warn = status === "dirty" ? " ⚠️ TEMİZ DEĞİL" : status === "clean" ? " ✅" : "";
    return `- Oda ${r.room_number} | ${r.guest_name}${warn}`;
  });
  return { result: `${data.length} check-in odası (hazır olmalı):\n${list.join("\n")}`, needsApproval: false };
}

async function handleUpdateCleaningStatus(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const statusLabels: Record<string, string> = { clean: "Temiz", dirty: "Kirli", in_progress: "Temizleniyor" };
  const label = statusLabels[input.new_status as string] || input.new_status;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "otel_katHizmetleri",
    actionType: "update_cleaning_status",
    actionData: { room_id: input.room_id, new_status: input.new_status },
    message: `🧹 Oda ${input.room_number} temizlik durumu → *${label}* olarak güncellensin mi?`,
    buttonLabel: "✅ Güncelle",
  });
}

async function handleSetRoomMaintenance(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const action = input.maintenance ? "bakıma alınsın" : "bakımdan çıkarılsın";
  const reason = (input.reason as string) || "";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "otel_katHizmetleri",
    actionType: "set_room_maintenance",
    actionData: { room_id: input.room_id, maintenance: input.maintenance },
    message: `🔧 Oda ${input.room_number} ${action} mı?${reason ? `\n📝 ${reason}` : ""}`,
    buttonLabel: input.maintenance ? "✅ Bakıma Al" : "✅ Aktif Et",
  });
}

async function handleCreateCleaningTask(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const typeLabels: Record<string, string> = { standard: "Standart", deep: "Derin", checkout: "Check-out" };
  const label = typeLabels[input.task_type as string] || input.task_type;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "otel_katHizmetleri",
    actionType: "create_cleaning_task",
    actionData: input,
    message: `📋 Oda ${input.room_number} için *${label}* temizlik görevi oluşturulsun mu?${input.notes ? `\n📝 ${input.notes}` : ""}${input.priority === "high" ? "\n🔴 Yüksek öncelik" : ""}`,
    buttonLabel: "✅ Oluştur",
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
    agentKey: "otel_katHizmetleri",
    actionType: "send_whatsapp",
    actionData: { phone: input.staff_phone, message: input.message_text },
    message: `✉️ *${input.staff_name}* personeline mesaj taslağı:\n\n📱 ${input.staff_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const katHizmetleriToolHandlers: Record<string, ToolHandler> = {
  read_room_status: (input, ctx) => handleReadRoomStatus(input, ctx),
  read_checkout_rooms: (input, ctx) => handleReadCheckoutRooms(input, ctx),
  read_checkin_rooms: (input, ctx) => handleReadCheckinRooms(input, ctx),
  update_cleaning_status: handleUpdateCleaningStatus,
  set_room_maintenance: handleSetRoomMaintenance,
  create_cleaning_task: handleCreateCleaningTask,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const katHizmetleriAgent: AgentDefinition = {
  key: "otel_katHizmetleri",
  name: "Kat Hizmetleri",
  icon: "🧹",
  tools: KAT_HIZMETLERI_TOOLS,
  toolHandlers: katHizmetleriToolHandlers,

  systemPrompt:
    `Sen otelin kat hizmetleri sorumlusun. Görevin oda temizlik durumunu takip etmek, bakım ihtiyaçlarını tespit etmek ve temizlik görevlerini planlamak.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_room_status: Oda durumlarını oku (dirty, maintenance, all)\n` +
    `- read_checkout_rooms: Bugün check-out odaları (temizlenecek)\n` +
    `- read_checkin_rooms: Bugün check-in odaları (hazır olmalı)\n` +
    `- update_cleaning_status: Temizlik durumu güncelle (onay gerektirir)\n` +
    `- set_room_maintenance: Bakıma al/çıkar (onay gerektirir)\n` +
    `- create_cleaning_task: Temizlik görevi oluştur (onay gerektirir)\n` +
    `- draft_message: Personele taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Personele ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_room_status, read_checkin_rooms), sonra analiz et, sonra aksiyon öner.\n` +
    `- Check-in öncesi temiz olmayan odalara yüksek öncelik ver.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "otel_katHizmetleri");

    const { data: dirtyRooms } = await supabase
      .from("otel_rooms")
      .select("id, room_number, room_type")
      .eq("tenant_id", ctx.tenantId)
      .eq("cleaning_status", "dirty");

    const { count: maintenanceCount } = await supabase
      .from("otel_rooms")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "maintenance");

    const today = new Date().toISOString().slice(0, 10);
    const { count: todayCheckouts } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("check_out_date", today)
      .eq("status", "checked_in");

    const { count: todayCheckins } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("check_in_date", today)
      .in("status", ["confirmed", "pending"]);

    const recentMessages = await getRecentMessages(ctx.userId, "otel_katHizmetleri", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "otel_katHizmetleri", 5);

    return {
      dirtyCount: dirtyRooms?.length || 0,
      dirtySample: (dirtyRooms || []).slice(0, 5).map((r) => ({
        id: r.id, roomNumber: r.room_number, roomType: r.room_type,
      })),
      maintenanceCount: maintenanceCount || 0,
      todayCheckouts: todayCheckouts || 0,
      todayCheckins: todayCheckins || 0,
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
    const dirty = data.dirtyCount as number;
    const maintenance = data.maintenanceCount as number;
    const checkouts = data.todayCheckouts as number;
    const checkins = data.todayCheckins as number;

    if (dirty === 0 && maintenance === 0 && checkouts === 0 && checkins === 0) return "";

    const dirtySample = data.dirtySample as Array<{ id: string; roomNumber: string; roomType: string }>;
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
    prompt += `### Kat Hizmetleri Özeti\n`;
    prompt += `- Kirli oda: ${dirty}\n`;
    prompt += `- Bakımda: ${maintenance}\n`;
    prompt += `- Bugün check-out: ${checkouts} (temizlenecek)\n`;
    prompt += `- Bugün check-in: ${checkins} (hazır olmalı)\n`;

    if (dirtySample?.length) {
      prompt += `\n### Kirli Odalar\n`;
      for (const r of dirtySample) {
        prompt += `- [${r.id}] Oda ${r.roomNumber} (${r.roomType})\n`;
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
      case "update_cleaning_status": {
        const { error } = await supabase
          .from("otel_rooms")
          .update({ cleaning_status: actionData.new_status, updated_at: new Date().toISOString() })
          .eq("id", actionData.room_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return "Oda temizlik durumu güncellendi.";
      }

      case "set_room_maintenance": {
        const newStatus = actionData.maintenance ? "maintenance" : "available";
        const { error } = await supabase
          .from("otel_rooms")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", actionData.room_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return actionData.maintenance ? "Oda bakıma alındı." : "Oda bakımdan çıkarıldı.";
      }

      case "create_cleaning_task": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Temizlik: Oda ${actionData.room_number} (${actionData.task_type})`,
          title: `Temizlik: Oda ${actionData.room_number}`,
          note: actionData.notes || null,
          remind_at: new Date().toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `Oda ${actionData.room_number} temizlik görevi oluşturuldu.`;
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
