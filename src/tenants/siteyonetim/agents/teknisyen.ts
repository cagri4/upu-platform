/**
 * Teknisyen Agent — V2 (tool-using, memory-backed)
 *
 * Tracks maintenance tickets, overdue repairs, plans maintenance.
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
import { createProposalAndNotify, getUserBuilding } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const TEKNISYEN_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_tickets",
    description:
      "Arıza/bakım taleplerini oku. status: 'acik'|'devam_ediyor'|'all'. old_only: true ise sadece 7+ gün bekleyenleri gösterir.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["acik", "devam_ediyor", "all"], description: "Durum filtresi" },
        old_only: { type: "boolean", description: "Sadece 7+ gün bekleyenleri göster" },
      },
      required: [],
    },
  },
  {
    name: "read_ticket_stats",
    description: "Arıza istatistikleri: toplam açık, kategorilere göre dağılım, eski talepler.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_ticket_priority",
    description: "Arıza talebinin önceliğini güncelle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        ticket_id: { type: "string", description: "Talep ID" },
        ticket_title: { type: "string", description: "Talep başlığı (gösterim için)" },
        new_priority: { type: "string", enum: ["dusuk", "normal", "yuksek", "acil"], description: "Yeni öncelik" },
        reason: { type: "string", description: "Değişiklik nedeni" },
      },
      required: ["ticket_id", "ticket_title", "new_priority"],
    },
  },
  {
    name: "update_ticket_status",
    description: "Arıza talebinin durumunu güncelle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        ticket_id: { type: "string", description: "Talep ID" },
        ticket_title: { type: "string", description: "Talep başlığı" },
        new_status: { type: "string", enum: ["devam_ediyor", "tamamlandi"], description: "Yeni durum" },
        note: { type: "string", description: "Not (opsiyonel)" },
      },
      required: ["ticket_id", "ticket_title", "new_status"],
    },
  },
  {
    name: "draft_message",
    description: "Sakine arıza durumu hakkında taslak mesaj hazırla. Direkt göndermez, kullanıcıya gösterir.",
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

async function handleReadTickets(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const building = await getUserBuilding(ctx);
  if (!building) return { result: "Bina bulunamadı.", needsApproval: false };

  const supabase = getServiceClient();
  let query = supabase
    .from("sy_maintenance_tickets")
    .select("id, category, priority, status, description, created_at, unit_id")
    .eq("building_id", building.id)
    .order("created_at", { ascending: false })
    .limit(15);

  const statusFilter = input.status as string | undefined;
  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  } else {
    query = query.neq("status", "tamamlandi");
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Açık arıza/bakım talebi yok.", needsApproval: false };

  let filtered = data;
  if (input.old_only) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    filtered = data.filter((t) => t.created_at < sevenDaysAgo);
    if (!filtered.length) return { result: "7+ gün bekleyen talep yok.", needsApproval: false };
  }

  const list = filtered.map((t) => {
    const days = Math.floor((Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return `- [${t.id}] ${t.category || "Genel"} | Daire ${t.unit_id} | ${t.priority || "normal"} | ${t.status} | ${days} gün | ${(t.description || "").substring(0, 60)}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadTicketStats(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const building = await getUserBuilding(ctx);
  if (!building) return { result: "Bina bulunamadı.", needsApproval: false };

  const supabase = getServiceClient();

  const { data: openTickets } = await supabase
    .from("sy_maintenance_tickets")
    .select("id, category, priority, status, created_at")
    .eq("building_id", building.id)
    .neq("status", "tamamlandi");

  const openCount = openTickets?.length || 0;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oldCount = (openTickets || []).filter(
    (t) => t.status === "acik" && t.created_at < sevenDaysAgo,
  ).length;

  const categoryMap: Record<string, number> = {};
  for (const t of openTickets || []) {
    const cat = t.category || "diger";
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  }
  const categories = Object.entries(categoryMap)
    .map(([k, v]) => `${k}(${v})`)
    .join(", ");

  const priorityMap: Record<string, number> = {};
  for (const t of openTickets || []) {
    const p = t.priority || "normal";
    priorityMap[p] = (priorityMap[p] || 0) + 1;
  }
  const priorities = Object.entries(priorityMap)
    .map(([k, v]) => `${k}(${v})`)
    .join(", ");

  const lines = [
    `Bina: ${building.name}`,
    `Açık talep: ${openCount}`,
    `7+ gün bekleyen: ${oldCount}`,
    `Kategoriler: ${categories || "yok"}`,
    `Öncelikler: ${priorities || "yok"}`,
  ];
  return { result: lines.join("\n"), needsApproval: false };
}

async function handleUpdateTicketPriority(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const title = input.ticket_title as string;
  const newPriority = input.new_priority as string;
  const reason = (input.reason as string) || "";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "sy_teknisyen",
    actionType: "oncelik_guncelle",
    actionData: { ticket_id: input.ticket_id, new_priority: newPriority },
    message: `🔧 "${title}" önceliği *${newPriority}* yapılsın mı?${reason ? `\n📝 ${reason}` : ""}`,
    buttonLabel: "✅ Güncelle",
  });
}

async function handleUpdateTicketStatus(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const title = input.ticket_title as string;
  const newStatus = input.new_status as string;
  const note = (input.note as string) || "";
  const label = newStatus === "tamamlandi" ? "tamamlandı" : "devam ediyor";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "sy_teknisyen",
    actionType: "durum_guncelle",
    actionData: { ticket_id: input.ticket_id, new_status: newStatus, note },
    message: `🔧 "${title}" durumu *${label}* olarak güncellensin mi?${note ? `\n📝 ${note}` : ""}`,
    buttonLabel: "✅ Güncelle",
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
    agentKey: "sy_teknisyen",
    actionType: "send_whatsapp",
    actionData: { phone: input.resident_phone, message: input.message_text },
    message: `✉️ *${input.resident_name}* kişisine mesaj taslağı:\n\n📱 ${input.resident_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const teknisyenToolHandlers: Record<string, ToolHandler> = {
  read_tickets: (input, ctx) => handleReadTickets(input, ctx),
  read_ticket_stats: (input, ctx) => handleReadTicketStats(input, ctx),
  update_ticket_priority: handleUpdateTicketPriority,
  update_ticket_status: handleUpdateTicketStatus,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const teknisyenAgent: AgentDefinition = {
  key: "sy_teknisyen",
  name: "Teknisyen",
  icon: "🔧",
  tools: TEKNISYEN_TOOLS,
  toolHandlers: teknisyenToolHandlers,

  systemPrompt:
    `Sen site yönetimi teknisyenisin. Görevin arıza ve bakım taleplerini takip etmek, önceliklendirmek ve çözüm süreçlerini yönetmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_tickets: Arıza/bakım taleplerini oku (status filtreli veya old_only)\n` +
    `- read_ticket_stats: Arıza istatistikleri (kategoriler, öncelikler)\n` +
    `- update_ticket_priority: Öncelik güncelle (onay gerektirir)\n` +
    `- update_ticket_status: Durum güncelle (onay gerektirir)\n` +
    `- draft_message: Sakine arıza durumu mesajı hazırla (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim/öneri gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Sakinlere ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_tickets, read_ticket_stats), sonra analiz et, sonra aksiyon öner.\n` +
    `- 7+ gün bekleyen arızaları önceliklendir.\n` +
    `- Acil arızaları yüksek öncelikle işaretle.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const building = await getUserBuilding(ctx);
    if (!building) return { noBuilding: true };

    const supabase = getServiceClient();

    const { data: openTickets } = await supabase
      .from("sy_maintenance_tickets")
      .select("id, category, priority, status, created_at")
      .eq("building_id", building.id)
      .neq("status", "tamamlandi");

    const openCount = openTickets?.length || 0;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oldTickets = (openTickets || []).filter(
      (t) => t.status === "acik" && t.created_at < sevenDaysAgo,
    );
    const oldCount = oldTickets.length;

    const categoryMap: Record<string, number> = {};
    for (const t of openTickets || []) {
      const cat = t.category || "diger";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }
    const categories = Object.entries(categoryMap)
      .map(([k, v]) => `${k}(${v})`)
      .join(", ");

    const recentMessages = await getRecentMessages(ctx.userId, "sy_teknisyen", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "sy_teknisyen", 5);

    return {
      buildingName: building.name,
      buildingId: building.id,
      openCount,
      oldCount,
      categories: categories || "yok",
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
    prompt += `### Arıza Özeti\n`;
    prompt += `- Bina: ${data.buildingName}\n`;
    prompt += `- Açık talep: ${data.openCount}\n`;
    prompt += `- 7+ gün bekleyen: ${data.oldCount}\n`;
    prompt += `- Kategoriler: ${data.categories}\n`;

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
      case "oncelik_guncelle": {
        const { error } = await supabase
          .from("sy_maintenance_tickets")
          .update({ priority: actionData.new_priority, updated_at: new Date().toISOString() })
          .eq("id", actionData.ticket_id);
        if (error) return `Hata: ${error.message}`;
        return `Öncelik güncellendi: ${actionData.new_priority}`;
      }

      case "durum_guncelle": {
        const updates: Record<string, unknown> = {
          status: actionData.new_status,
          updated_at: new Date().toISOString(),
        };
        if (actionData.new_status === "tamamlandi") {
          updates.resolved_at = new Date().toISOString();
        }
        const { error } = await supabase
          .from("sy_maintenance_tickets")
          .update(updates)
          .eq("id", actionData.ticket_id);
        if (error) return `Hata: ${error.message}`;
        return `Durum güncellendi: ${actionData.new_status === "tamamlandi" ? "Tamamlandı" : "Devam ediyor"}`;
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
