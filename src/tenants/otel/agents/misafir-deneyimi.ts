/**
 * Misafir Deneyimi Agent — V2 (tool-using, memory-backed)
 *
 * Tracks guest satisfaction, reviews, special requests, and experience improvements.
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

const MISAFIR_DENEYIMI_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_reviews",
    description:
      "Misafir yorumlarını oku. filter: 'low'|'recent'|'all'. low = 3 puan ve altı.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["low", "recent", "all"], description: "Filtre türü" },
      },
      required: [],
    },
  },
  {
    name: "read_guest_requests",
    description:
      "Misafir özel isteklerini oku. filter: 'pending'|'all'.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["pending", "all"], description: "Filtre türü" },
      },
      required: [],
    },
  },
  {
    name: "read_satisfaction_stats",
    description: "Memnuniyet istatistikleri: haftalık ortalama puan, yorum sayısı, düşük puanlar.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "respond_to_review",
    description: "Yoruma yanıt oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        review_id: { type: "string", description: "Yorum ID" },
        guest_name: { type: "string", description: "Misafir adı" },
        response_text: { type: "string", description: "Yanıt metni" },
      },
      required: ["review_id", "guest_name", "response_text"],
    },
  },
  {
    name: "fulfill_request",
    description: "Özel isteği tamamlanmış olarak işaretle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        request_id: { type: "string", description: "İstek ID" },
        guest_name: { type: "string", description: "Misafir adı" },
        resolution: { type: "string", description: "Çözüm açıklaması" },
      },
      required: ["request_id", "guest_name"],
    },
  },
  {
    name: "create_improvement_note",
    description: "Deneyim iyileştirme notu oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Kategori (temizlik, servis, yemek, tesis vb.)" },
        suggestion: { type: "string", description: "İyileştirme önerisi" },
        based_on: { type: "string", description: "Hangi veriye dayanarak (yorum ID, istek vb.)" },
      },
      required: ["category", "suggestion"],
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

async function handleReadReviews(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  let query = supabase
    .from("otel_guest_reviews")
    .select("id, guest_name, rating, comment, created_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(15);

  if (input.filter === "low") {
    query = query.lte("rating", 3);
  } else if (input.filter === "recent") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", weekAgo);
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Yorum yok.", needsApproval: false };

  const list = data.map((r) => {
    const date = new Date(r.created_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
    return `- [${r.id}] ${r.guest_name} | ${"⭐".repeat(r.rating || 0)} (${r.rating}/5) | ${date}\n  ${(r.comment || "").substring(0, 100)}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadGuestRequests(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  let query = supabase
    .from("otel_guest_requests")
    .select("id, guest_name, request_type, description, status, created_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(15);

  if (input.filter === "pending") {
    query = query.eq("status", "pending");
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "İstek yok.", needsApproval: false };

  const list = data.map((r) =>
    `- [${r.id}] ${r.guest_name} | ${r.request_type || "genel"} | ${r.status} | ${(r.description || "").substring(0, 80)}`,
  );
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadSatisfactionStats(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: reviews } = await supabase
    .from("otel_guest_reviews")
    .select("rating")
    .eq("tenant_id", ctx.tenantId)
    .gte("created_at", weekAgo);

  const count = reviews?.length || 0;
  const avg = count > 0
    ? (reviews!.reduce((s, r) => s + (r.rating || 0), 0) / count).toFixed(1)
    : "-";
  const lowCount = (reviews || []).filter((r) => r.rating && r.rating <= 3).length;

  const { count: pendingRequests } = await supabase
    .from("otel_guest_requests")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "pending");

  const lines = [
    `Haftalık yorum: ${count}`,
    `Ortalama puan: ${avg}/5`,
    `Düşük puan (≤3): ${lowCount}`,
    `Bekleyen özel istek: ${pendingRequests || 0}`,
  ];
  return { result: lines.join("\n"), needsApproval: false };
}

async function handleRespondToReview(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "otel_misafirDeneyimi",
    actionType: "respond_to_review",
    actionData: { review_id: input.review_id, response_text: input.response_text },
    message: `📝 *${input.guest_name}* yorumuna yanıt:\n\n_${input.response_text}_`,
    buttonLabel: "✅ Yanıtla",
  });
}

async function handleFulfillRequest(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "otel_misafirDeneyimi",
    actionType: "fulfill_request",
    actionData: { request_id: input.request_id, resolution: input.resolution },
    message: `✅ *${input.guest_name}* isteği tamamlanmış olarak işaretlensin mi?${input.resolution ? `\n📝 ${input.resolution}` : ""}`,
    buttonLabel: "✅ Tamamla",
  });
}

async function handleCreateImprovementNote(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "otel_misafirDeneyimi",
    actionType: "create_improvement_note",
    actionData: input,
    message: `💡 İyileştirme önerisi [${input.category}]:\n\n${input.suggestion}${input.based_on ? `\n📊 Kaynak: ${input.based_on}` : ""}`,
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
    agentKey: "otel_misafirDeneyimi",
    actionType: "send_whatsapp",
    actionData: { phone: input.guest_phone, message: input.message_text },
    message: `✉️ *${input.guest_name}* misafirine mesaj taslağı:\n\n📱 ${input.guest_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const misafirDeneyimiToolHandlers: Record<string, ToolHandler> = {
  read_reviews: (input, ctx) => handleReadReviews(input, ctx),
  read_guest_requests: (input, ctx) => handleReadGuestRequests(input, ctx),
  read_satisfaction_stats: (input, ctx) => handleReadSatisfactionStats(input, ctx),
  respond_to_review: handleRespondToReview,
  fulfill_request: handleFulfillRequest,
  create_improvement_note: handleCreateImprovementNote,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const misafirDeneyimiAgent: AgentDefinition = {
  key: "otel_misafirDeneyimi",
  name: "Misafir Deneyimi",
  icon: "⭐",
  tools: MISAFIR_DENEYIMI_TOOLS,
  toolHandlers: misafirDeneyimiToolHandlers,

  systemPrompt:
    `Sen otelin misafir deneyimi sorumlusun. Görevin misafir memnuniyetini izlemek, düşük puanlı yorumlara dikkat çekmek, özel istekleri takip etmek ve deneyim iyileştirme önerileri sunmak.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_reviews: Yorumları oku (low, recent, all)\n` +
    `- read_guest_requests: Özel istekleri oku (pending, all)\n` +
    `- read_satisfaction_stats: Memnuniyet istatistikleri\n` +
    `- respond_to_review: Yoruma yanıt (onay gerektirir)\n` +
    `- fulfill_request: İsteği tamamla (onay gerektirir)\n` +
    `- create_improvement_note: İyileştirme notu (onay gerektirir)\n` +
    `- draft_message: Misafire taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Misafire ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_reviews, read_guest_requests, read_satisfaction_stats), sonra analiz et, sonra aksiyon öner.\n` +
    `- 3 puan ve altı yorumlara özellikle dikkat et.\n` +
    `- Bekleyen özel isteklere yüksek öncelik ver.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "otel_misafirDeneyimi");
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: reviews } = await supabase
      .from("otel_guest_reviews")
      .select("id, guest_name, rating, comment, created_at")
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    const reviewCount = reviews?.length || 0;
    const avgRating = reviewCount > 0
      ? Math.round((reviews!.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount) * 10) / 10
      : 0;
    const lowRatings = (reviews || []).filter((r) => r.rating && r.rating <= 3);

    const { data: requests } = await supabase
      .from("otel_guest_requests")
      .select("id, guest_name, request_type, description")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "pending")
      .limit(10);

    const { count: activeGuests } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "checked_in");

    const recentMessages = await getRecentMessages(ctx.userId, "otel_misafirDeneyimi", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "otel_misafirDeneyimi", 5);

    return {
      reviewCount,
      avgRating,
      lowRatingCount: lowRatings.length,
      lowRatingSample: lowRatings.slice(0, 3).map((r) => ({
        id: r.id,
        guestName: r.guest_name,
        rating: r.rating,
        comment: r.comment?.substring(0, 80),
      })),
      pendingRequests: requests?.length || 0,
      requestSample: (requests || []).slice(0, 5).map((r) => ({
        id: r.id,
        guestName: r.guest_name,
        type: r.request_type,
        description: r.description?.substring(0, 60),
      })),
      activeGuests: activeGuests || 0,
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
    const reviews = data.reviewCount as number;
    const pending = data.pendingRequests as number;
    const active = data.activeGuests as number;

    if (reviews === 0 && pending === 0 && active === 0) return "";

    const lowSample = data.lowRatingSample as Array<{ id: string; guestName: string; rating: number; comment: string }>;
    const requestSample = data.requestSample as Array<{ id: string; guestName: string; type: string; description: string }>;
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
    prompt += `### Misafir Deneyimi Özeti\n`;
    prompt += `- Haftalık yorum: ${reviews} (ort. ${data.avgRating}/5)\n`;
    prompt += `- Düşük puan (≤3): ${data.lowRatingCount}\n`;
    prompt += `- Bekleyen özel istek: ${pending}\n`;
    prompt += `- Aktif misafir: ${active}\n`;

    if (lowSample?.length) {
      prompt += `\n### Düşük Puanlı Yorumlar\n`;
      for (const r of lowSample) {
        prompt += `- [${r.id}] ${r.guestName} (${r.rating}/5): ${r.comment}\n`;
      }
    }

    if (requestSample?.length) {
      prompt += `\n### Bekleyen İstekler\n`;
      for (const r of requestSample) {
        prompt += `- [${r.id}] ${r.guestName} | ${r.type}: ${r.description}\n`;
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
      case "respond_to_review": {
        const { error } = await supabase
          .from("otel_guest_reviews")
          .update({ response: actionData.response_text, responded_at: new Date().toISOString() })
          .eq("id", actionData.review_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return "Yorum yanıtı kaydedildi.";
      }

      case "fulfill_request": {
        const { error } = await supabase
          .from("otel_guest_requests")
          .update({
            status: "fulfilled",
            resolution: actionData.resolution || "Tamamlandı",
            fulfilled_at: new Date().toISOString(),
          })
          .eq("id", actionData.request_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return "Özel istek tamamlanmış olarak işaretlendi.";
      }

      case "create_improvement_note": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `İyileştirme [${actionData.category}]: ${(actionData.suggestion as string).substring(0, 60)}`,
          title: `İyileştirme: ${actionData.category}`,
          note: actionData.suggestion as string,
          remind_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return "İyileştirme notu kaydedildi.";
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
