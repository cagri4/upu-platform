/**
 * Sekreter Agent — V2 (tool-using, memory-backed)
 *
 * Manages announcements, resident communication, meeting reminders.
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
import { createProposalAndNotify, getUserBuilding } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const SEKRETER_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_residents",
    description:
      "Aktif sakinleri oku. filter: 'all' veya 'with_phone' (telefonu olanlar).",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["all", "with_phone"], description: "Filtre" },
      },
      required: [],
    },
  },
  {
    name: "read_building_activity",
    description: "Son 7 günlük bina aktivitesi: açık arızalar, son işlemler, sakin sayısı.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_announcement",
    description: "Tüm sakinlere duyuru gönder. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Duyuru başlığı" },
        content: { type: "string", description: "Duyuru içeriği" },
        priority: { type: "string", enum: ["normal", "urgent"], description: "Öncelik" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "create_meeting_reminder",
    description: "Toplantı hatırlatması oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Toplantı konusu" },
        date: { type: "string", description: "Toplantı tarihi (ISO format)" },
        note: { type: "string", description: "Ek not (opsiyonel)" },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "draft_message",
    description: "Sakine taslak WhatsApp mesajı hazırla. Direkt göndermez, kullanıcıya gösterir.",
    input_schema: {
      type: "object",
      properties: {
        resident_name: { type: "string", description: "Sakin adı" },
        resident_phone: { type: "string", description: "Telefon numarası" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["resident_name", "resident_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadResidents(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const building = await getUserBuilding(ctx);
  if (!building) return { result: "Bina bulunamadı.", needsApproval: false };

  const supabase = getServiceClient();
  let query = supabase
    .from("sy_residents")
    .select("id, full_name, phone, unit_id, is_active")
    .eq("building_id", building.id)
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(20);

  if (input.filter === "with_phone") {
    query = query.not("phone", "is", null);
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Aktif sakin yok.", needsApproval: false };

  const list = data.map((r) =>
    `- [${r.id}] ${r.full_name} | Daire ${r.unit_id}${r.phone ? ` | 📱 ${r.phone}` : ""}`,
  );
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadBuildingActivity(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const building = await getUserBuilding(ctx);
  if (!building) return { result: "Bina bulunamadı.", needsApproval: false };

  const supabase = getServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count: residentCount } = await supabase
    .from("sy_residents")
    .select("id", { count: "exact", head: true })
    .eq("building_id", building.id)
    .eq("is_active", true);

  const { count: openTickets } = await supabase
    .from("sy_maintenance_tickets")
    .select("id", { count: "exact", head: true })
    .eq("building_id", building.id)
    .eq("status", "acik");

  const { count: recentTxCount } = await supabase
    .from("sy_income_expenses")
    .select("id", { count: "exact", head: true })
    .eq("building_id", building.id)
    .gte("created_at", sevenDaysAgo);

  const lines = [
    `Bina: ${building.name}`,
    `Aktif sakin: ${residentCount || 0}`,
    `Açık arıza: ${openTickets || 0}`,
    `Son 7 gün işlem: ${recentTxCount || 0}`,
  ];
  return { result: lines.join("\n"), needsApproval: false };
}

async function handleCreateAnnouncement(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const title = input.title as string;
  const content = input.content as string;
  const priority = (input.priority as string) || "normal";
  const urgentTag = priority === "urgent" ? "🚨 " : "";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "sy_sekreter",
    actionType: "duyuru_gonder",
    actionData: { title, content, priority },
    message: `${urgentTag}📢 Duyuru gönderilsin mi?\n\n*${title}*\n${content}`,
    buttonLabel: "✅ Gönder",
  });
}

async function handleCreateMeetingReminder(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const title = input.title as string;
  const date = input.date as string;
  const note = (input.note as string) || "";
  const dt = new Date(date).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "sy_sekreter",
    actionType: "toplanti_hatirla",
    actionData: { title, date, note },
    message: `📅 Toplantı hatırlatması oluşturulsun mu?\n\n*${title}*\n⏰ ${dt}${note ? `\n📝 ${note}` : ""}`,
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
    agentKey: "sy_sekreter",
    actionType: "send_whatsapp",
    actionData: { phone: input.resident_phone, message: input.message_text },
    message: `✉️ *${input.resident_name}* kişisine mesaj taslağı:\n\n📱 ${input.resident_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const sekreterToolHandlers: Record<string, ToolHandler> = {
  read_residents: (input, ctx) => handleReadResidents(input, ctx),
  read_building_activity: (input, ctx) => handleReadBuildingActivity(input, ctx),
  create_announcement: handleCreateAnnouncement,
  create_meeting_reminder: handleCreateMeetingReminder,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const sekreterAgent: AgentDefinition = {
  key: "sy_sekreter",
  name: "Sekreter",
  icon: "📝",
  tools: SEKRETER_TOOLS,
  toolHandlers: sekreterToolHandlers,

  systemPrompt:
    `Sen site yönetimi sekreterisin. Görevin bina sakinleriyle iletişimi yönetmek, duyuruları hazırlamak ve toplantıları koordine etmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_residents: Aktif sakinleri oku (all veya with_phone filtresiyle)\n` +
    `- read_building_activity: Son 7 günlük bina aktivitesi\n` +
    `- create_announcement: Tüm sakinlere duyuru gönder (onay gerektirir)\n` +
    `- create_meeting_reminder: Toplantı hatırlatması oluştur (onay gerektirir)\n` +
    `- draft_message: Sakine mesaj taslağı hazırla (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim/öneri gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Sakinlere ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_residents, read_building_activity), sonra analiz et, sonra aksiyon öner.\n` +
    `- Açık arıza veya önemli gelişme varsa duyuru öner.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const config = await getAgentConfig(ctx.userId, "sy_sekreter");
    const building = await getUserBuilding(ctx);
    if (!building) return { noBuilding: true, agentConfig: config };

    const supabase = getServiceClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count: residentCount } = await supabase
      .from("sy_residents")
      .select("id", { count: "exact", head: true })
      .eq("building_id", building.id)
      .eq("is_active", true);

    const { count: openTickets } = await supabase
      .from("sy_maintenance_tickets")
      .select("id", { count: "exact", head: true })
      .eq("building_id", building.id)
      .eq("status", "acik");

    const { count: recentTxCount } = await supabase
      .from("sy_income_expenses")
      .select("id", { count: "exact", head: true })
      .eq("building_id", building.id)
      .gte("created_at", sevenDaysAgo);

    const recentMessages = await getRecentMessages(ctx.userId, "sy_sekreter", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "sy_sekreter", 5);

    return {
      buildingName: building.name,
      buildingId: building.id,
      residentCount: residentCount || 0,
      openTickets: openTickets || 0,
      recentTxCount: recentTxCount || 0,
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
    if (data.noBuilding) return "";

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
    prompt += `### Bina Özeti\n`;
    prompt += `- Bina: ${data.buildingName}\n`;
    prompt += `- Aktif sakin: ${data.residentCount}\n`;
    prompt += `- Açık arıza: ${data.openTickets}\n`;
    prompt += `- Son 7 gün işlem: ${data.recentTxCount}\n`;

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
      case "duyuru_gonder": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Duyuru: ${actionData.title}`,
          title: actionData.title as string,
          note: actionData.content as string,
          remind_at: new Date().toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `Duyuru oluşturuldu: ${actionData.title}`;
      }

      case "toplanti_hatirla": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Toplantı: ${actionData.title}`,
          title: `Toplantı hatırlatması: ${actionData.title}`,
          note: actionData.note || null,
          remind_at: actionData.date as string,
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `Toplantı hatırlatması oluşturuldu: ${actionData.title}`;
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
