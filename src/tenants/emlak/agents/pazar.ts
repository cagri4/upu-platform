/**
 * Pazar Analisti Agent — V2 (tool-using, memory-backed)
 *
 * Compares user's property prices to market averages per district.
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

const PAZAR_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_market_data",
    description:
      "Bölge, mülk tipi, oda sayısı ve emlak tipine göre piyasa verilerini oku. Ortalama fiyat, min/max, m² fiyat, ilan sayısı, oda dağılımı, tip dağılımı.",
    input_schema: {
      type: "object",
      properties: {
        region: { type: "string", description: "Bölge/ilçe/mahalle adı" },
        listing_type: { type: "string", enum: ["satilik", "kiralik"], description: "Satılık veya kiralık (opsiyonel)" },
        property_type: { type: "string", enum: ["daire", "villa", "mustakil", "rezidans", "arsa", "yazlik", "buro_ofis", "dukkan"], description: "Emlak tipi (opsiyonel)" },
        rooms: { type: "string", description: "Oda sayısı filtresi, örn: 3+1, 2+1, stüdyo (opsiyonel)" },
      },
      required: ["region"],
    },
  },
  {
    name: "read_user_properties_vs_market",
    description:
      "Kullanıcının mülklerini piyasa ortalamasıyla karşılaştır. Bölge bazlı fark yüzdesi.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_price_report",
    description: "Bölge bazlı fiyat raporu oluştur. Kullanıcıya bildirim olarak gönderir.",
    input_schema: {
      type: "object",
      properties: {
        region: { type: "string", description: "Bölge adı" },
        report_text: { type: "string", description: "Rapor metni" },
      },
      required: ["region", "report_text"],
    },
  },
  {
    name: "suggest_price_change",
    description: "Mülk için fiyat değişikliği öner. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        property_id: { type: "string", description: "Mülk ID" },
        property_title: { type: "string", description: "Mülk başlığı" },
        current_price: { type: "number", description: "Mevcut fiyat" },
        suggested_price: { type: "number", description: "Önerilen fiyat" },
        reason: { type: "string", description: "Değişiklik nedeni" },
      },
      required: ["property_id", "property_title", "suggested_price", "reason"],
    },
  },
  {
    name: "draft_message",
    description: "Taslak WhatsApp mesajı. Direkt göndermez, kullanıcıya gösterir.",
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

async function handleReadMarketData(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const region = input.region as string;

  // Build query with all available filters
  let query = supabase
    .from("emlak_properties")
    .select("id, price, area, rooms, type, listing_type, location_neighborhood, building_age")
    .or(`location_district.ilike.%${region}%,location_neighborhood.ilike.%${region}%`)
    .not("price", "is", null);

  if (input.listing_type) {
    query = query.eq("listing_type", input.listing_type as string);
  }
  if (input.property_type) {
    query = query.eq("type", input.property_type as string);
  }
  if (input.rooms) {
    query = query.eq("rooms", input.rooms as string);
  }

  const { data, error } = await query.limit(500);
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: `${region} bölgesinde bu kriterlere uyan veri bulunamadı.`, needsApproval: false };

  // Price stats
  const prices = data.map((p) => p.price).filter(Boolean) as number[];
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const median = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];

  // m² price stats
  const m2Prices = data
    .filter((p) => p.price && p.area && p.area > 0)
    .map((p) => Math.round(p.price / p.area));
  const avgM2 = m2Prices.length
    ? Math.round(m2Prices.reduce((s, p) => s + p, 0) / m2Prices.length)
    : 0;

  // Room distribution
  const roomDist: Record<string, number> = {};
  for (const p of data) {
    if (p.rooms) roomDist[p.rooms] = (roomDist[p.rooms] || 0) + 1;
  }
  const roomLines = Object.entries(roomDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([r, c]) => `  ${r}: ${c} ilan`);

  // Property type distribution
  const typeDist: Record<string, number> = {};
  for (const p of data) {
    if (p.type) typeDist[p.type] = (typeDist[p.type] || 0) + 1;
  }
  const typeLines = Object.entries(typeDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, c]) => `  ${t}: ${c} ilan`);

  // Neighborhood distribution
  const neighborhoodDist: Record<string, number> = {};
  for (const p of data) {
    if (p.location_neighborhood) neighborhoodDist[p.location_neighborhood] = (neighborhoodDist[p.location_neighborhood] || 0) + 1;
  }
  const neighborhoodLines = Object.entries(neighborhoodDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([n, c]) => `  ${n}: ${c} ilan`);

  // Filters applied
  const filters = [
    input.listing_type ? `Tip: ${input.listing_type}` : null,
    input.property_type ? `Emlak: ${input.property_type}` : null,
    input.rooms ? `Oda: ${input.rooms}` : null,
  ].filter(Boolean);

  const lines = [
    `📊 ${region} Pazar Analizi${filters.length ? ` (${filters.join(", ")})` : ""}`,
    `─────────────────────`,
    `İlan sayısı: ${data.length}`,
    `Ortalama fiyat: ₺${avg.toLocaleString("tr-TR")}`,
    `Medyan fiyat: ₺${median.toLocaleString("tr-TR")}`,
    `Min: ₺${min.toLocaleString("tr-TR")} / Max: ₺${max.toLocaleString("tr-TR")}`,
    avgM2 ? `Ort. m² fiyatı: ₺${avgM2.toLocaleString("tr-TR")}` : null,
    ``,
    roomLines.length ? `Oda dağılımı:\n${roomLines.join("\n")}` : null,
    typeLines.length ? `\nEmlak tipi dağılımı:\n${typeLines.join("\n")}` : null,
    neighborhoodLines.length ? `\nMahalle dağılımı:\n${neighborhoodLines.join("\n")}` : null,
  ].filter(Boolean);

  return { result: lines.join("\n"), needsApproval: false };
}

async function handleReadUserVsMarket(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: userProps } = await supabase
    .from("emlak_properties")
    .select("id, title, price, area, rooms, type, listing_type, location_district, location_neighborhood")
    .eq("user_id", ctx.userId)
    .not("price", "is", null);

  if (!userProps?.length) return { result: "Portföyde fiyat bilgisi olan mülk yok.", needsApproval: false };

  const lines: string[] = ["📊 Portföy vs Piyasa — Dar Alan Karşılaştırması", "─────────────────────"];

  for (const prop of userProps.slice(0, 10)) {
    // Extract semt from neighborhood (e.g. "Yalıkavak / Geriş Mh." → "Yalıkavak")
    const semt = prop.location_neighborhood
      ? prop.location_neighborhood.split("/")[0]?.trim()
      : null;

    // Build narrowest possible market query: semt + tip + oda
    let marketQuery = supabase
      .from("emlak_properties")
      .select("price, area")
      .not("price", "is", null);

    // 1. Semt filter (neighborhood contains semt name)
    if (semt) {
      marketQuery = marketQuery.ilike("location_neighborhood", `${semt}%`);
    } else if (prop.location_district) {
      marketQuery = marketQuery.eq("location_district", prop.location_district);
    }

    // 2. Listing type filter (satılık/kiralık)
    if (prop.listing_type) {
      marketQuery = marketQuery.eq("listing_type", prop.listing_type);
    }

    // 3. Property type filter (daire/villa/arsa)
    if (prop.type) {
      marketQuery = marketQuery.eq("type", prop.type);
    }

    // 4. Room filter
    if (prop.rooms) {
      marketQuery = marketQuery.eq("rooms", prop.rooms);
    }

    const { data: narrowMarket } = await marketQuery.limit(500);

    // If too few results with narrow filter, widen to semt + type only
    let marketData = narrowMarket;
    let filterLabel = "";
    if (!narrowMarket || narrowMarket.length < 3) {
      let widerQuery = supabase
        .from("emlak_properties")
        .select("price, area")
        .not("price", "is", null);
      if (semt) {
        widerQuery = widerQuery.ilike("location_neighborhood", `${semt}%`);
      } else if (prop.location_district) {
        widerQuery = widerQuery.eq("location_district", prop.location_district);
      }
      if (prop.listing_type) {
        widerQuery = widerQuery.eq("listing_type", prop.listing_type);
      }
      const { data: widerData } = await widerQuery.limit(500);
      marketData = widerData;
      filterLabel = ` (geniş: ${semt || prop.location_district})`;
    } else {
      const parts = [semt || prop.location_district, prop.type, prop.rooms].filter(Boolean);
      filterLabel = ` (${parts.join(", ")})`;
    }

    if (!marketData?.length) {
      lines.push(`\n⚪ ${prop.title?.substring(0, 35)}`);
      lines.push(`  ₺${prop.price.toLocaleString("tr-TR")} — karşılaştırma verisi yok`);
      continue;
    }

    const prices = marketData.map(m => m.price).filter(Boolean) as number[];
    const marketAvg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
    const diff = marketAvg > 0 ? Math.round(((prop.price - marketAvg) / marketAvg) * 100) : 0;
    const diffEmoji = diff > 10 ? "🔴" : diff < -10 ? "🟢" : "🟡";

    // m² comparison
    const m2Price = prop.area && prop.area > 0 ? Math.round(prop.price / prop.area) : 0;
    const marketM2Prices = marketData
      .filter(m => m.price && m.area && m.area > 0)
      .map(m => Math.round(m.price / m.area));
    const marketAvgM2 = marketM2Prices.length
      ? Math.round(marketM2Prices.reduce((s, p) => s + p, 0) / marketM2Prices.length)
      : 0;

    lines.push(`\n${diffEmoji} ${prop.title?.substring(0, 35)}`);
    lines.push(`  Fiyat: ₺${prop.price.toLocaleString("tr-TR")} | Piyasa ort: ₺${marketAvg.toLocaleString("tr-TR")} (${diff > 0 ? "+" : ""}${diff}%)${filterLabel}`);
    if (m2Price && marketAvgM2) {
      lines.push(`  m² fiyat: ₺${m2Price.toLocaleString("tr-TR")} | Piyasa ort: ₺${marketAvgM2.toLocaleString("tr-TR")}/m²`);
    }
    lines.push(`  Karşılaştırma: ${prices.length} benzer ilan`);
  }

  if (userProps.length > 10) {
    lines.push(`\n... ve ${userProps.length - 10} mülk daha`);
  }

  return { result: lines.join("\n"), needsApproval: false };
}

async function handleCreatePriceReport(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const region = input.region as string;
  const text = input.report_text as string;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "pazar",
    actionType: "notification",
    actionData: { region, report_text: text },
    message: `📊 *${region}* Piyasa Raporu:\n\n${text}`,
    buttonLabel: "✅ Tamam",
  });
}

async function handleSuggestPriceChange(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const title = input.property_title as string;
  const current = input.current_price as number | undefined;
  const suggested = input.suggested_price as number;
  const reason = input.reason as string;

  const currentStr = current ? `₺${Number(current).toLocaleString("tr-TR")}` : "bilinmiyor";
  const suggestedStr = `₺${Number(suggested).toLocaleString("tr-TR")}`;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "pazar",
    actionType: "update_property_price",
    actionData: { property_id: input.property_id, new_price: suggested },
    message: `💰 *${title}* fiyat önerisi:\n\nMevcut: ${currentStr}\nÖnerilen: ${suggestedStr}\n📝 ${reason}`,
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
    agentKey: "pazar",
    actionType: "send_whatsapp",
    actionData: { phone: input.customer_phone, message: input.message_text },
    message: `✉️ *${input.customer_name}* kişisine mesaj taslağı:\n\n📱 ${input.customer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const pazarToolHandlers: Record<string, ToolHandler> = {
  read_market_data: (input, ctx) => handleReadMarketData(input, ctx),
  read_user_properties_vs_market: (input, ctx) => handleReadUserVsMarket(input, ctx),
  create_price_report: handleCreatePriceReport,
  suggest_price_change: handleSuggestPriceChange,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const pazarAgent: AgentDefinition = {
  key: "pazar",
  name: "Pazar Analisti",
  icon: "📊",
  tools: PAZAR_TOOLS,
  toolHandlers: pazarToolHandlers,

  systemPrompt:
    `Sen emlak ofisinin pazar analistsin. Görevin bölge bazlı fiyat analizleri yapmak, kullanıcının mülklerini piyasayla karşılaştırmak ve fiyat önerileri sunmak.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_market_data: Bölge, mülk tipi, oda sayısı bazlı piyasa verisi oku (fiyat, m², dağılım)\n` +
    `- read_user_properties_vs_market: Kullanıcı portföyü vs piyasa karşılaştırması\n` +
    `- create_price_report: Fiyat raporu oluştur\n` +
    `- suggest_price_change: Fiyat değişikliği öner (onay gerektirir)\n` +
    `- draft_message: Taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Kimseye ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_market_data, read_user_properties_vs_market), sonra analiz et, sonra aksiyon öner.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran: takip bölgeleri, rapor sıklığı, fırsat bildirimi eşiği.\n` +
    `- Piyasa ortalamasından sapan mülklere (kullanıcı fırsat eşiğine göre) özellikle dikkat et.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Fetch user preferences
    const config = await getAgentConfig(ctx.userId, "pazar");

    const { data: userProps } = await supabase
      .from("emlak_properties")
      .select("id, title, price, area, rooms, type, listing_type, location_district")
      .eq("user_id", ctx.userId)
      .not("location_district", "is", null);

    const recentMessages = await getRecentMessages(ctx.userId, "pazar", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "pazar", 5);

    if (!userProps?.length) {
      return { districtCount: 0, recentDecisions: [], messageHistory: [], agentConfig: config };
    }

    const districts = [...new Set(userProps.map((p) => p.location_district).filter(Boolean))] as string[];

    const districtAnalysis: Array<{
      district: string;
      userAvg: number;
      marketAvg: number;
      userCount: number;
      marketCount: number;
      diffPercent: number;
    }> = [];

    for (const district of districts) {
      const userDistrictProps = userProps.filter((p) => p.location_district === district);
      const userAvg = Math.round(userDistrictProps.reduce((s, p) => s + (p.price || 0), 0) / userDistrictProps.length);

      const { data: marketProps } = await supabase
        .from("emlak_properties")
        .select("price")
        .eq("location_district", district)
        .not("price", "is", null);

      const marketAvg = marketProps?.length
        ? Math.round(marketProps.reduce((s, p) => s + (p.price || 0), 0) / marketProps.length)
        : 0;

      const diffPercent = marketAvg > 0 ? Math.round(((userAvg - marketAvg) / marketAvg) * 100) : 0;

      districtAnalysis.push({
        district,
        userAvg,
        marketAvg,
        userCount: userDistrictProps.length,
        marketCount: marketProps?.length || 0,
        diffPercent,
      });
    }

    return {
      districtCount: districts.length,
      propertyCount: userProps.length,
      analysis: districtAnalysis,
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
    if (!data.districtCount || (data.districtCount as number) === 0) return "";

    const analysis = data.analysis as Array<{
      district: string; userAvg: number; marketAvg: number; userCount: number; marketCount: number; diffPercent: number;
    }>;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;
    const config = data.agentConfig as Record<string, unknown> | null;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    if (config) {
      prompt += `### Kullanıcı Tercihleri\n`;
      if (config.takip_bolgeleri) prompt += `- Takip bölgeleri: ${config.takip_bolgeleri}\n`;
      if (config.rapor_sikligi) prompt += `- Rapor sıklığı: ${config.rapor_sikligi}\n`;
      if (config.karsilastirma) prompt += `- Portföy karşılaştırma: ${config.karsilastirma === "evet" ? "Aktif" : "Kapalı"}\n`;
      if (config.firsat_bildirimi) prompt += `- Fırsat bildirimi: ${config.firsat_bildirimi === "hayir" ? "Kapalı" : `%${config.firsat_bildirimi}+ altında`}\n`;
      prompt += `\n`;
    }

    prompt += `### Piyasa Karşılaştırması (${data.propertyCount} mülk, ${data.districtCount} bölge)\n`;

    for (const a of analysis) {
      const diffLabel = a.diffPercent > 0 ? `+${a.diffPercent}%` : `${a.diffPercent}%`;
      prompt += `- ${a.district}: Sizin ₺${a.userAvg.toLocaleString("tr-TR")} / Piyasa ₺${a.marketAvg.toLocaleString("tr-TR")} (${diffLabel})\n`;
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

      case "send_whatsapp": {
        const { sendText } = await import("@/platform/whatsapp/send");
        await sendText(actionData.phone as string, actionData.message as string);
        return "Mesaj gönderildi.";
      }

      case "notification":
        return "Rapor gönderildi.";

      default:
        return "İşlem tamamlandı.";
    }
  },
};
