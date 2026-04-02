/**
 * Portfoy Sorumlusu Agent — V2 (tool-using, memory-backed)
 *
 * Analyzes user's property portfolio — missing fields, stale listings, value summary.
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
import { createProposalAndNotify } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const PORTFOY_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_properties",
    description:
      "Kullanıcının mülklerini filtrelerle oku. status: 'active'|'all', missing: 'photos'|'m2'|null.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "all"], description: "Mülk durumu" },
        missing: { type: "string", enum: ["photos", "m2"], description: "Eksik alan filtresi (opsiyonel)" },
      },
      required: [],
    },
  },
  {
    name: "read_property_stats",
    description: "Portföy istatistikleri: toplam mülk, fotoğrafsız, m² eksik, toplam değer, en eski ilan.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_property_price",
    description: "Mülk fiyatını güncelle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        property_id: { type: "string", description: "Mülk ID" },
        property_title: { type: "string", description: "Mülk başlığı (gösterim için)" },
        new_price: { type: "number", description: "Yeni fiyat (TL)" },
        reason: { type: "string", description: "Güncelleme nedeni" },
      },
      required: ["property_id", "property_title", "new_price"],
    },
  },
  {
    name: "flag_missing_photos",
    description: "Eksik fotoğraf uyarısı oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        property_id: { type: "string", description: "Mülk ID" },
        property_title: { type: "string", description: "Mülk başlığı" },
      },
      required: ["property_id", "property_title"],
    },
  },
  {
    name: "draft_message",
    description: "Mülk sahibine taslak WhatsApp mesajı hazırla. Direkt göndermez, kullanıcıya gösterir.",
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

async function handleReadProperties(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  let query = supabase
    .from("emlak_properties")
    .select("id, title, price, photo_count, square_meters, listing_type, district, created_at, status")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(15);

  if (input.status === "active") {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Portföyde mülk yok.", needsApproval: false };

  let filtered = data;
  if (input.missing === "photos") {
    filtered = data.filter((p) => !p.photo_count || p.photo_count === 0);
  } else if (input.missing === "m2") {
    filtered = data.filter((p) => !p.square_meters);
  }

  if (!filtered.length) return { result: "Filtre sonucu boş.", needsApproval: false };

  const list = filtered.map((p) => {
    const price = p.price ? `₺${Number(p.price).toLocaleString("tr-TR")}` : "fiyat yok";
    return `- [${p.id}] ${p.title} | ${price} | ${p.square_meters || "?"}m² | foto:${p.photo_count || 0} | ${p.district || "?"} | ${p.listing_type || "?"}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadPropertyStats(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, price, photo_count, square_meters, listing_type, created_at")
    .eq("user_id", ctx.userId);

  if (!properties?.length) return { result: "Portföyde mülk yok.", needsApproval: false };

  const count = properties.length;
  const missingPhotos = properties.filter((p) => !p.photo_count || p.photo_count === 0).length;
  const missingM2 = properties.filter((p) => !p.square_meters).length;

  const satilik = properties
    .filter((p) => p.listing_type === "satilik")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const oldest = satilik[0];
  const daysOld = oldest
    ? Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const totalValue = properties.reduce((s, p) => s + (p.price || 0), 0);

  const lines = [
    `Toplam: ${count} mülk`,
    `Fotoğrafsız: ${missingPhotos}`,
    `m² eksik: ${missingM2}`,
    `Toplam değer: ₺${totalValue.toLocaleString("tr-TR")}`,
    oldest ? `En eski ilan: ${oldest.title} (${daysOld} gün, ID: ${oldest.id})` : null,
  ].filter(Boolean);

  return { result: lines.join("\n"), needsApproval: false };
}

async function handleUpdatePropertyPrice(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const title = input.property_title as string;
  const newPrice = input.new_price as number;
  const reason = (input.reason as string) || "";
  const priceStr = `₺${Number(newPrice).toLocaleString("tr-TR")}`;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "portfoy",
    actionType: "update_property_price",
    actionData: { property_id: input.property_id, new_price: newPrice },
    message: `"${title}" fiyatı ${priceStr} olarak güncellensin mi?${reason ? `\n📝 ${reason}` : ""}`,
    buttonLabel: "✅ Güncelle",
  });
}

async function handleFlagMissingPhotos(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const title = input.property_title as string;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "portfoy",
    actionType: "flag_missing_photos",
    actionData: { property_id: input.property_id, property_title: title },
    message: `📷 "${title}" için fotoğraf eksik. Hatırlatma oluşturulsun mu?`,
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
    agentKey: "portfoy",
    actionType: "send_whatsapp",
    actionData: { phone: input.customer_phone, message: input.message_text },
    message: `✉️ *${input.customer_name}* kişisine mesaj taslağı:\n\n📱 ${input.customer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const portfoyToolHandlers: Record<string, ToolHandler> = {
  read_properties: (input, ctx) => handleReadProperties(input, ctx),
  read_property_stats: (input, ctx) => handleReadPropertyStats(input, ctx),
  update_property_price: handleUpdatePropertyPrice,
  flag_missing_photos: handleFlagMissingPhotos,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const portfoyAgent: AgentDefinition = {
  key: "portfoy",
  name: "Portföy Sorumlusu",
  icon: "🏠",
  tools: PORTFOY_TOOLS,
  toolHandlers: portfoyToolHandlers,

  systemPrompt:
    `Sen emlak ofisinin portföy sorumlusun. Görevin mülk portföyünü analiz etmek, eksikleri tespit etmek ve fiyat güncellemeleri önermek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_properties: Mülkleri oku (filtreli)\n` +
    `- read_property_stats: Portföy istatistikleri\n` +
    `- update_property_price: Fiyat güncelle (onay gerektirir)\n` +
    `- flag_missing_photos: Eksik fotoğraf uyarısı (onay gerektirir)\n` +
    `- draft_message: Mülk sahibine taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim/öneri gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Kimseye ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_properties, read_property_stats), sonra analiz et, sonra aksiyon öner.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran: fiyat eşiği, bölge filtresi, eksik bilgi uyarısı vb.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Fetch user preferences
    const config = await getAgentConfig(ctx.userId, "portfoy");

    const { data: properties } = await supabase
      .from("emlak_properties")
      .select("id, title, price, photo_count, square_meters, listing_type, created_at")
      .eq("user_id", ctx.userId);

    const recentMessages = await getRecentMessages(ctx.userId, "portfoy", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "portfoy", 5);

    if (!properties?.length) {
      return { count: 0, recentDecisions: [], messageHistory: [], agentConfig: config };
    }

    const count = properties.length;
    const missingPhotos = properties.filter((p) => !p.photo_count || p.photo_count === 0).length;
    const missingM2 = properties.filter((p) => !p.square_meters).length;

    const satilik = properties
      .filter((p) => p.listing_type === "satilik")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const oldest = satilik[0];
    const daysOld = oldest
      ? Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const totalValue = properties.reduce((s, p) => s + (p.price || 0), 0);

    return {
      count,
      missingPhotos,
      missingM2,
      oldestTitle: oldest?.title || "-",
      oldestId: oldest?.id || null,
      daysOld,
      totalValue,
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
    if (!data.count || (data.count as number) === 0) return "";

    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;
    const config = data.agentConfig as Record<string, unknown> | null;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    if (config) {
      prompt += `### Kullanıcı Tercihleri\n`;
      if (config.bolge) prompt += `- Takip bölgeleri: ${config.bolge}\n`;
      if (config.mulk_tipleri) prompt += `- Mülk tipleri: ${config.mulk_tipleri}\n`;
      if (config.scrape_bildirim) prompt += `- Yeni ilan bildirimi: ${config.scrape_bildirim}\n`;
      if (config.fiyat_esik) prompt += `- Fiyat değişim eşiği: %${config.fiyat_esik}\n`;
      if (config.eksik_bilgi_uyari) prompt += `- Eksik bilgi uyarısı: ${config.eksik_bilgi_uyari === "evet" ? "Aktif" : "Kapalı"}\n`;
      prompt += `\n`;
    }

    prompt += `### Portföy Özeti\n`;
    prompt += `- Toplam: ${data.count} mülk\n`;
    prompt += `- Fotoğrafsız: ${data.missingPhotos}\n`;
    prompt += `- m² eksik: ${data.missingM2}\n`;
    prompt += `- Toplam değer: ₺${Number(data.totalValue).toLocaleString("tr-TR")}\n`;

    if (data.oldestId) {
      prompt += `- En eski ilan: ${data.oldestTitle} (${data.daysOld} gün)\n`;
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
      case "update_property_price": {
        const { error } = await supabase
          .from("emlak_properties")
          .update({ price: actionData.new_price, updated_at: new Date().toISOString() })
          .eq("id", actionData.property_id)
          .eq("user_id", ctx.userId);
        if (error) return `Hata: ${error.message}`;
        return `Fiyat güncellendi: ₺${Number(actionData.new_price).toLocaleString("tr-TR")}`;
      }

      case "flag_missing_photos": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Fotoğraf ekle: ${actionData.property_title}`,
          title: `Fotoğraf ekle: ${actionData.property_title}`,
          note: `Mülk ID: ${actionData.property_id}`,
          remind_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return "Fotoğraf eksik hatırlatması oluşturuldu.";
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
