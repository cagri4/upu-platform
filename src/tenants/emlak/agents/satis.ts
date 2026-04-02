/**
 * Satis Destek Agent — V2 (tool-using, memory-backed)
 *
 * Tracks customers, cold contacts, property-customer matches, monitoring criteria.
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

const SATIS_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_customers",
    description:
      "Müşteri listesini oku. filter: 'all'|'cold' (14+ gün sessiz).",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["all", "cold"], description: "Filtre türü" },
      },
      required: [],
    },
  },
  {
    name: "read_matches",
    description:
      "Müşteri-mülk eşleşme potansiyelini oku. Bütçe ve bölge bazlı eşleşmeleri döndürür.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_customer_note",
    description: "Müşteriye not ekle. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "Müşteri ID" },
        customer_name: { type: "string", description: "Müşteri adı" },
        note: { type: "string", description: "Not içeriği" },
      },
      required: ["customer_id", "customer_name", "note"],
    },
  },
  {
    name: "schedule_followup",
    description: "Müşteri takibi planla. Hatırlatma oluşturur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "Müşteri ID" },
        customer_name: { type: "string", description: "Müşteri adı" },
        date: { type: "string", description: "ISO tarih" },
        note: { type: "string", description: "Takip notu" },
      },
      required: ["customer_id", "customer_name", "date"],
    },
  },
  {
    name: "draft_message",
    description: "Müşteriye taslak WhatsApp mesajı. Direkt göndermez, kullanıcıya gösterir.",
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string", description: "Müşteri adı" },
        customer_phone: { type: "string", description: "Telefon numarası" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["customer_name", "customer_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadCustomers(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("emlak_customers")
    .select("id, name, phone, budget_min, budget_max, preferred_district, preferred_type, updated_at")
    .eq("user_id", ctx.userId)
    .order("updated_at", { ascending: true })
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Müşteri kaydı yok.", needsApproval: false };

  let filtered = data;
  if (input.filter === "cold") {
    const threshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    filtered = data.filter((c) => !c.updated_at || c.updated_at < threshold);
    if (!filtered.length) return { result: "Soğuk müşteri yok (14+ gün sessiz).", needsApproval: false };
  }

  const list = filtered.map((c) => {
    const budget = c.budget_min || c.budget_max
      ? `₺${(c.budget_min || 0).toLocaleString("tr-TR")}–${(c.budget_max || 0).toLocaleString("tr-TR")}`
      : "bütçe yok";
    const daysSince = c.updated_at
      ? Math.floor((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      : "?";
    return `- [${c.id}] ${c.name} | ${c.phone || "?"} | ${budget} | ${c.preferred_district || "?"} | ${daysSince} gün önce`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadMatches(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: customers } = await supabase
    .from("emlak_customers")
    .select("id, name, budget_min, budget_max, preferred_district, preferred_type")
    .eq("user_id", ctx.userId);

  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, price, district, listing_type, rooms")
    .eq("user_id", ctx.userId);

  if (!customers?.length || !properties?.length) {
    return { result: "Eşleşme hesaplanamadı (müşteri veya mülk yok).", needsApproval: false };
  }

  const matches: string[] = [];
  for (const c of customers.slice(0, 10)) {
    const matched = properties.filter((p) => {
      let score = 0;
      if (c.budget_max && p.price && p.price <= c.budget_max) score++;
      if (c.budget_min && p.price && p.price >= c.budget_min) score++;
      if (c.preferred_district && p.district && p.district.toLowerCase() === c.preferred_district.toLowerCase()) score++;
      if (c.preferred_type && p.listing_type === c.preferred_type) score++;
      return score >= 2;
    });
    if (matched.length) {
      matches.push(`${c.name} → ${matched.map((p) => p.title).join(", ")} (${matched.length} eşleşme)`);
    }
  }

  if (!matches.length) return { result: "Güçlü eşleşme bulunamadı.", needsApproval: false };
  return { result: matches.join("\n"), needsApproval: false };
}

async function handleCreateCustomerNote(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "satis",
    actionType: "create_customer_note",
    actionData: { customer_id: input.customer_id, note: input.note },
    message: `📝 *${input.customer_name}* için not eklensin mi?\n\n_${input.note}_`,
    buttonLabel: "✅ Ekle",
  });
}

async function handleScheduleFollowup(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const dt = new Date(input.date as string).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "satis",
    actionType: "schedule_followup",
    actionData: {
      customer_id: input.customer_id,
      customer_name: input.customer_name,
      date: input.date,
      note: input.note || null,
    },
    message: `📅 *${input.customer_name}* için takip planı:\n\n⏰ ${dt}${input.note ? `\n📝 ${input.note}` : ""}`,
    buttonLabel: "✅ Planla",
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
    agentKey: "satis",
    actionType: "send_whatsapp",
    actionData: { phone: input.customer_phone, message: input.message_text },
    message: `✉️ *${input.customer_name}* kişisine mesaj taslağı:\n\n📱 ${input.customer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const satisToolHandlers: Record<string, ToolHandler> = {
  read_customers: (input, ctx) => handleReadCustomers(input, ctx),
  read_matches: (input, ctx) => handleReadMatches(input, ctx),
  create_customer_note: handleCreateCustomerNote,
  schedule_followup: handleScheduleFollowup,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const satisAgent: AgentDefinition = {
  key: "satis",
  name: "Satış Destek",
  icon: "🤝",
  tools: SATIS_TOOLS,
  toolHandlers: satisToolHandlers,

  systemPrompt:
    `Sen emlak ofisinin satış destek uzmanısın. Görevin müşteri takibi, eşleştirme ve soğuk müşterileri ısıtmak.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_customers: Müşteri listesini oku (all veya cold)\n` +
    `- read_matches: Müşteri-mülk eşleşmeleri\n` +
    `- create_customer_note: Müşteriye not ekle (onay gerektirir)\n` +
    `- schedule_followup: Takip planla (onay gerektirir)\n` +
    `- draft_message: Müşteriye taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Müşteriye ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_customers, read_matches), sonra analiz et, sonra aksiyon öner.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran: soğuma süresi, eşleştirme tercihi, takip sıklığı, otonomi seviyesi.\n` +
    `- Soğuma süresi tercihine göre sessiz müşterilere dikkat et.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Fetch user preferences
    const config = await getAgentConfig(ctx.userId, "satis");

    const { data: customers } = await supabase
      .from("emlak_customers")
      .select("id, name, phone, budget_min, budget_max, preferred_district, updated_at")
      .eq("user_id", ctx.userId);

    const recentMessages = await getRecentMessages(ctx.userId, "satis", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "satis", 5);

    if (!customers?.length) {
      return { count: 0, recentDecisions: [], messageHistory: [], agentConfig: config };
    }

    const count = customers.length;
    // Use config soguma_suresi if available, otherwise default to 14 days
    const coldDays = config?.soguma_suresi ? Number(config.soguma_suresi) : 14;
    const coldThreshold = new Date(Date.now() - coldDays * 24 * 60 * 60 * 1000).toISOString();
    const coldCustomers = customers.filter((c) => !c.updated_at || c.updated_at < coldThreshold);

    const { count: propertyCount } = await supabase
      .from("emlak_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId);

    const { count: monitorCount } = await supabase
      .from("emlak_monitoring_criteria")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId);

    return {
      count,
      coldCount: coldCustomers.length,
      coldDays,
      coldCustomers: coldCustomers.slice(0, 5).map((c) => ({ id: c.id, name: c.name })),
      propertyCount: propertyCount || 0,
      monitorCount: monitorCount || 0,
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

    const coldCustomers = data.coldCustomers as Array<{ id: string; name: string }>;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;
    const config = data.agentConfig as Record<string, unknown> | null;
    const coldDays = (data.coldDays as number) || 14;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    if (config) {
      prompt += `### Kullanıcı Tercihleri\n`;
      if (config.soguma_suresi) prompt += `- Soğuma süresi: ${config.soguma_suresi} gün\n`;
      if (config.eslestirme_otomatik) prompt += `- Otomatik eşleştirme: ${config.eslestirme_otomatik}\n`;
      if (config.takip_sikligi) prompt += `- Takip sıklığı: ${config.takip_sikligi}\n`;
      if (config.otomatik_aksiyon) prompt += `- Otonom aksiyon: ${config.otomatik_aksiyon}\n`;
      prompt += `\n`;
    }

    prompt += `### Müşteri Özeti\n`;
    prompt += `- Toplam müşteri: ${data.count}\n`;
    prompt += `- Soğuk müşteri (${coldDays}+ gün): ${data.coldCount}\n`;
    prompt += `- Mülk sayısı: ${data.propertyCount}\n`;
    prompt += `- Aktif takip kriteri: ${data.monitorCount}\n`;

    if (coldCustomers?.length) {
      prompt += `\n### Soğuk Müşteriler\n`;
      for (const c of coldCustomers) {
        prompt += `- [${c.id}] ${c.name}\n`;
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
      case "create_customer_note": {
        const { error } = await supabase
          .from("emlak_customers")
          .update({
            notes: actionData.note,
            updated_at: new Date().toISOString(),
          })
          .eq("id", actionData.customer_id)
          .eq("user_id", ctx.userId);
        if (error) return `Hata: ${error.message}`;
        return "Müşteri notu eklendi.";
      }

      case "schedule_followup": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Takip: ${actionData.customer_name}`,
          title: `Takip: ${actionData.customer_name}`,
          note: actionData.note || null,
          remind_at: actionData.date,
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `${actionData.customer_name} için takip hatırlatması oluşturuldu.`;
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
