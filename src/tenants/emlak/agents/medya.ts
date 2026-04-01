/**
 * Medya Uzmani Agent — V2 (tool-using, memory-backed)
 *
 * Tracks properties without photos, unpublished listings, publishing history.
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
import { createProposalAndNotify } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const MEDYA_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_properties_media",
    description:
      "Mülklerin fotoğraf durumunu oku. Her mülk için fotoğraf sayısı ve başlık döner.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_publishing_history",
    description: "Yayın geçmişini oku. Hangi mülk hangi portale yayınlandı.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_listing_text",
    description: "Mülk için ilan metni oluştur ve kaydet. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        property_id: { type: "string", description: "Mülk ID" },
        property_title: { type: "string", description: "Mülk başlığı" },
        text: { type: "string", description: "Oluşturulan ilan metni" },
      },
      required: ["property_id", "property_title", "text"],
    },
  },
  {
    name: "flag_photo_issue",
    description: "Fotoğraf sorunu bildir. Hatırlatma oluşturur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        property_id: { type: "string", description: "Mülk ID" },
        property_title: { type: "string", description: "Mülk başlığı" },
        issue: { type: "string", description: "Sorun açıklaması (ör. fotoğraf yok, kalitesiz)" },
      },
      required: ["property_id", "property_title", "issue"],
    },
  },
  {
    name: "draft_message",
    description: "Mülk sahibine taslak WhatsApp mesajı. Direkt göndermez, kullanıcıya gösterir.",
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string", description: "Kişi adı" },
        customer_phone: { type: "string", description: "Telefon numarası" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["customer_name", "customer_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadPropertiesMedia(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("emlak_properties")
    .select("id, title, photo_count, status")
    .eq("user_id", ctx.userId)
    .order("photo_count", { ascending: true })
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Mülk yok.", needsApproval: false };

  const noPhoto = data.filter((p) => !p.photo_count || p.photo_count === 0);
  const withPhoto = data.filter((p) => p.photo_count && p.photo_count > 0);

  let result = `Toplam: ${data.length} mülk | Fotoğrafsız: ${noPhoto.length}\n\n`;

  if (noPhoto.length) {
    result += "📷 Fotoğrafsız:\n";
    result += noPhoto.map((p) => `- [${p.id}] ${p.title}`).join("\n");
    result += "\n\n";
  }

  if (withPhoto.length) {
    result += "✅ Fotoğraflı:\n";
    result += withPhoto.slice(0, 5).map((p) => `- [${p.id}] ${p.title} (${p.photo_count} foto)`).join("\n");
  }

  return { result, needsApproval: false };
}

async function handleReadPublishingHistory(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title")
    .eq("user_id", ctx.userId);

  const { data: published } = await supabase
    .from("emlak_publishing_history")
    .select("property_id, portal, published_at")
    .eq("user_id", ctx.userId)
    .order("published_at", { ascending: false })
    .limit(20);

  if (!properties?.length) return { result: "Mülk yok.", needsApproval: false };

  const publishedIds = new Set((published || []).map((p) => p.property_id));
  const unpublished = properties.filter((p) => !publishedIds.has(p.id));

  let result = `Toplam: ${properties.length} mülk | Yayınlanmamış: ${unpublished.length}\n\n`;

  if (unpublished.length) {
    result += "📤 Yayınlanmamış:\n";
    result += unpublished.slice(0, 5).map((p) => `- [${p.id}] ${p.title}`).join("\n");
    result += "\n\n";
  }

  if (published?.length) {
    const titleMap = new Map(properties.map((p) => [p.id, p.title]));
    result += "✅ Son Yayınlar:\n";
    result += published.slice(0, 5).map((p) => {
      const dt = new Date(p.published_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
      return `- ${titleMap.get(p.property_id) || p.property_id} → ${p.portal} (${dt})`;
    }).join("\n");
  }

  return { result, needsApproval: false };
}

async function handleCreateListingText(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const title = input.property_title as string;
  const text = input.text as string;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "medya",
    actionType: "create_listing_text",
    actionData: { property_id: input.property_id, text },
    message: `📝 *${title}* için ilan metni:\n\n_${text.substring(0, 500)}_`,
    buttonLabel: "✅ Kaydet",
  });
}

async function handleFlagPhotoIssue(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const title = input.property_title as string;
  const issue = input.issue as string;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "medya",
    actionType: "flag_photo_issue",
    actionData: { property_id: input.property_id, property_title: title, issue },
    message: `📷 *${title}* — fotoğraf sorunu:\n\n⚠️ ${issue}\n\nHatırlatma oluşturulsun mu?`,
    buttonLabel: "✅ Hatırlat",
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
    agentKey: "medya",
    actionType: "send_whatsapp",
    actionData: { phone: input.customer_phone, message: input.message_text },
    message: `✉️ *${input.customer_name}* kişisine mesaj taslağı:\n\n📱 ${input.customer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const medyaToolHandlers: Record<string, ToolHandler> = {
  read_properties_media: (input, ctx) => handleReadPropertiesMedia(input, ctx),
  read_publishing_history: (input, ctx) => handleReadPublishingHistory(input, ctx),
  create_listing_text: handleCreateListingText,
  flag_photo_issue: handleFlagPhotoIssue,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const medyaAgent: AgentDefinition = {
  key: "medya",
  name: "Medya Uzmanı",
  icon: "📸",
  tools: MEDYA_TOOLS,
  toolHandlers: medyaToolHandlers,

  systemPrompt:
    `Sen emlak ofisinin medya uzmanısın. Görevin fotoğraf eksikliklerini tespit etmek, ilan metinleri oluşturmak ve yayın durumunu takip etmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_properties_media: Fotoğraf durumunu oku\n` +
    `- read_publishing_history: Yayın geçmişini oku\n` +
    `- create_listing_text: İlan metni oluştur ve kaydet (onay gerektirir)\n` +
    `- flag_photo_issue: Fotoğraf sorunu bildir (onay gerektirir)\n` +
    `- draft_message: Mülk sahibine taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Kimseye ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_properties_media, read_publishing_history), sonra analiz et, sonra aksiyon öner.\n` +
    `- Fotoğrafsız mülklere ve yayınlanmamış ilanlara özellikle dikkat et.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    const { data: properties } = await supabase
      .from("emlak_properties")
      .select("id, title, photo_count")
      .eq("user_id", ctx.userId);

    const { data: published } = await supabase
      .from("emlak_publishing_history")
      .select("property_id")
      .eq("user_id", ctx.userId);

    const recentMessages = await getRecentMessages(ctx.userId, "medya", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "medya", 5);

    if (!properties?.length) {
      return { totalCount: 0, recentDecisions: [], messageHistory: [] };
    }

    const noPhotoProps = properties.filter((p) => !p.photo_count || p.photo_count === 0);
    const publishedIds = new Set((published || []).map((p) => p.property_id));
    const unpublished = properties.filter((p) => !publishedIds.has(p.id));

    return {
      totalCount: properties.length,
      noPhotoCount: noPhotoProps.length,
      noPhotoSample: noPhotoProps.slice(0, 5).map((p) => ({ id: p.id, title: p.title })),
      unpublishedCount: unpublished.length,
      unpublishedSample: unpublished.slice(0, 5).map((p) => ({ id: p.id, title: p.title })),
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
    if (!data.totalCount || (data.totalCount as number) === 0) return "";

    const noPhotoSample = data.noPhotoSample as Array<{ id: string; title: string }>;
    const unpublishedSample = data.unpublishedSample as Array<{ id: string; title: string }>;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;
    prompt += `### Medya Özeti\n`;
    prompt += `- Toplam mülk: ${data.totalCount}\n`;
    prompt += `- Fotoğrafsız: ${data.noPhotoCount}\n`;
    prompt += `- Yayınlanmamış: ${data.unpublishedCount}\n`;

    if (noPhotoSample?.length) {
      prompt += `\n### Fotoğrafsız Mülkler\n`;
      for (const p of noPhotoSample) {
        prompt += `- [${p.id}] ${p.title}\n`;
      }
    }

    if (unpublishedSample?.length) {
      prompt += `\n### Yayınlanmamış Mülkler\n`;
      for (const p of unpublishedSample) {
        prompt += `- [${p.id}] ${p.title}\n`;
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
      case "create_listing_text": {
        const { error } = await supabase
          .from("emlak_properties")
          .update({ description: actionData.text, updated_at: new Date().toISOString() })
          .eq("id", actionData.property_id)
          .eq("user_id", ctx.userId);
        if (error) return `Hata: ${error.message}`;
        return "İlan metni kaydedildi.";
      }

      case "flag_photo_issue": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Fotoğraf: ${actionData.property_title}`,
          title: `Fotoğraf: ${actionData.property_title}`,
          note: `${actionData.issue} — Mülk ID: ${actionData.property_id}`,
          remind_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return "Fotoğraf sorunu hatırlatması oluşturuldu.";
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
