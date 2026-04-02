/**
 * Fatura Isleme Uzmani Agent — V2 (tool-using, memory-backed)
 *
 * Analyzes invoices — missing data, duplicates, account code suggestions,
 * monthly summaries, and vendor analysis.
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

const FATURA_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_invoices",
    description:
      "Faturalari filtrelerle oku. filter: 'recent'|'overdue'|'all'. period: 'month'|'quarter'|'year'.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["recent", "overdue", "all"], description: "Filtre turu" },
        period: { type: "string", enum: ["month", "quarter", "year"], description: "Donem filtresi" },
        vendor_name: { type: "string", description: "Firma adi filtresi (opsiyonel)" },
      },
      required: [],
    },
  },
  {
    name: "read_invoice_stats",
    description: "Fatura istatistikleri: toplam fatura, toplam tutar, en buyuk tedarikci, eksik alanlar.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "suggest_account_code",
    description: "Fatura icin hesap kodu onerisi yap. Kullanici onayiyla faturaya yazilir.",
    input_schema: {
      type: "object",
      properties: {
        invoice_id: { type: "string", description: "Fatura ID" },
        vendor_name: { type: "string", description: "Firma adi" },
        amount: { type: "number", description: "Tutar" },
        suggested_code: { type: "string", description: "Onerilen hesap kodu" },
        reason: { type: "string", description: "Oneri nedeni" },
      },
      required: ["invoice_id", "vendor_name", "suggested_code"],
    },
  },
  {
    name: "flag_missing_data",
    description: "Eksik veri olan fatura icin uyari olustur. Kullanici onayiyla hatirlatma kaydedilir.",
    input_schema: {
      type: "object",
      properties: {
        invoice_id: { type: "string", description: "Fatura ID" },
        vendor_name: { type: "string", description: "Firma adi" },
        missing_fields: { type: "string", description: "Eksik alanlar (virgullu)" },
      },
      required: ["invoice_id", "vendor_name", "missing_fields"],
    },
  },
  {
    name: "draft_message",
    description: "Tedarikci veya mukelleflere taslak mesaj hazirla. Direkt gondermez, kullaniciya gosterir.",
    input_schema: {
      type: "object",
      properties: {
        recipient_name: { type: "string", description: "Alici adi" },
        recipient_phone: { type: "string", description: "Telefon numarasi" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["recipient_name", "recipient_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadInvoices(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  let query = supabase
    .from("muh_invoices")
    .select("id, vendor_name, amount, invoice_date, invoice_no, due_date, vkn")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (input.filter === "overdue") {
    const today = new Date().toISOString().split("T")[0];
    query = query.not("due_date", "is", null).lt("due_date", today);
  }

  if (input.period === "month") {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    query = query.gte("invoice_date", monthStart);
  } else if (input.period === "quarter") {
    const now = new Date();
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    const qStart = `${now.getFullYear()}-${String(qMonth + 1).padStart(2, "0")}-01`;
    query = query.gte("invoice_date", qStart);
  }

  if (input.vendor_name) {
    query = query.ilike("vendor_name", `%${input.vendor_name}%`);
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Fatura bulunamadi.", needsApproval: false };

  const list = data.map((inv: Record<string, unknown>) => {
    const amount = inv.amount != null ? `${Number(inv.amount).toLocaleString("tr-TR")} TL` : "tutar yok";
    return `- [${inv.id}] ${inv.vendor_name || "?"} | ${amount} | ${inv.invoice_date || "?"} | No:${inv.invoice_no || "?"} | Vade:${inv.due_date || "-"}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadInvoiceStats(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: invoices } = await supabase
    .from("muh_invoices")
    .select("id, vendor_name, amount, invoice_date, due_date, vkn")
    .eq("tenant_id", ctx.tenantId);

  if (!invoices?.length) return { result: "Kayitli fatura yok.", needsApproval: false };

  const count = invoices.length;
  const total = invoices.reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.amount) || 0), 0);
  const missingVkn = invoices.filter((inv: Record<string, unknown>) => !inv.vkn).length;
  const missingDate = invoices.filter((inv: Record<string, unknown>) => !inv.invoice_date).length;

  const today = new Date().toISOString().split("T")[0];
  const overdue = invoices.filter((inv: Record<string, unknown>) => inv.due_date && (inv.due_date as string) < today).length;

  // Top vendors by total
  const vendorTotals: Record<string, number> = {};
  for (const inv of invoices) {
    const vendor = (inv.vendor_name as string) || "Bilinmeyen";
    vendorTotals[vendor] = (vendorTotals[vendor] || 0) + (Number(inv.amount) || 0);
  }
  const topVendors = Object.entries(vendorTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([v, t]) => `  ${v}: ${t.toLocaleString("tr-TR")} TL`);

  const lines = [
    `Toplam: ${count} fatura`,
    `Toplam tutar: ${total.toLocaleString("tr-TR")} TL`,
    `Vadesi gecen: ${overdue}`,
    `VKN eksik: ${missingVkn}`,
    `Tarih eksik: ${missingDate}`,
    `En buyuk tedarikciler:`,
    ...topVendors,
  ];

  return { result: lines.join("\n"), needsApproval: false };
}

async function handleSuggestAccountCode(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "muh_faturaUzmani",
    actionType: "suggest_account_code",
    actionData: { invoice_id: input.invoice_id, suggested_code: input.suggested_code },
    message: `"${input.vendor_name}" faturasina hesap kodu onerisi: *${input.suggested_code}*${input.reason ? `\n${input.reason}` : ""}`,
    buttonLabel: "Uygula",
  });
}

async function handleFlagMissingData(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "muh_faturaUzmani",
    actionType: "flag_missing_data",
    actionData: { invoice_id: input.invoice_id, missing_fields: input.missing_fields },
    message: `"${input.vendor_name}" faturasinda eksik bilgi: ${input.missing_fields}\nHatirlatma olusturulsun mu?`,
    buttonLabel: "Hatirlatma Olustur",
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
    agentKey: "muh_faturaUzmani",
    actionType: "send_whatsapp",
    actionData: { phone: input.recipient_phone, message: input.message_text },
    message: `*${input.recipient_name}* icin mesaj taslagi:\n\n${input.recipient_phone}\n_${input.message_text}_`,
    buttonLabel: "Gonder",
  });
}

const faturaToolHandlers: Record<string, ToolHandler> = {
  read_invoices: (input, ctx) => handleReadInvoices(input, ctx),
  read_invoice_stats: (input, ctx) => handleReadInvoiceStats(input, ctx),
  suggest_account_code: handleSuggestAccountCode,
  flag_missing_data: handleFlagMissingData,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const faturaUzmaniAgent: AgentDefinition = {
  key: "muh_faturaUzmani",
  name: "Fatura Isleme Uzmani",
  icon: "📄",
  tools: FATURA_TOOLS,
  toolHandlers: faturaToolHandlers,

  systemPrompt:
    `Sen muhasebe burosunun fatura isleme uzmanisin. Gorevin faturalari analiz etmek, eksik verileri tespit etmek ve hesap kodu onerilerinde bulunmak.\n\n` +
    `## Kullanabilecegin Araclar\n` +
    `- read_invoices: Faturalari oku (filtreli)\n` +
    `- read_invoice_stats: Fatura istatistikleri\n` +
    `- suggest_account_code: Hesap kodu onerisi (onay gerektirir)\n` +
    `- flag_missing_data: Eksik veri uyarisi (onay gerektirir)\n` +
    `- draft_message: Tedarikci/mukelleflere mesaj taslagi (onay gerektirir)\n` +
    `- notify_human: Kullaniciya bildirim/oneri gonder\n` +
    `- read_db: Veritabanindan veri oku\n\n` +
    `## Kurallar\n` +
    `- Kimseye ASLA direkt mesaj gonderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon icin kullanici onayi al.\n` +
    `- Otonomi seviyesi: HER SEYI SOR — hicbir yazma islemini onaysiz yapma.\n` +
    `- Once veri topla (read_invoices, read_invoice_stats), sonra analiz et, sonra aksiyon oner.\n` +
    `- Kullanici tercihlerine (agent_config) gore davran.\n` +
    `- Yapilacak bir sey yoksa hicbir tool cagirma, kisa bir Turkce ozet yaz.\n` +
    `- Turkce yanit ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "muh_faturaUzmani");

    const { data: invoices } = await supabase
      .from("muh_invoices")
      .select("id, vendor_name, amount, invoice_date, due_date, vkn, created_at")
      .eq("tenant_id", ctx.tenantId);

    const recentMessages = await getRecentMessages(ctx.userId, "muh_faturaUzmani", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "muh_faturaUzmani", 5);

    if (!invoices?.length) {
      return { count: 0, recentDecisions: [], messageHistory: [], agentConfig: config };
    }

    const count = invoices.length;
    const total = invoices.reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.amount) || 0), 0);
    const missingVkn = invoices.filter((inv: Record<string, unknown>) => !inv.vkn).length;

    const today = new Date().toISOString().split("T")[0];
    const overdue = invoices.filter((inv: Record<string, unknown>) => inv.due_date && (inv.due_date as string) < today).length;

    return {
      count,
      totalAmount: total,
      missingVkn,
      overdueCount: overdue,
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
    prompt += `### Fatura Ozeti\n`;
    prompt += `- Toplam: ${data.count} fatura\n`;
    prompt += `- Toplam tutar: ${Number(data.totalAmount).toLocaleString("tr-TR")} TL\n`;
    prompt += `- VKN eksik: ${data.missingVkn}\n`;
    prompt += `- Vadesi gecen: ${data.overdueCount}\n`;

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
      case "suggest_account_code": {
        const { error } = await supabase
          .from("muh_invoices")
          .update({ account_code: actionData.suggested_code, updated_at: new Date().toISOString() })
          .eq("id", actionData.invoice_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return `Hesap kodu atandi: ${actionData.suggested_code}`;
      }

      case "flag_missing_data": {
        const { error } = await supabase.from("muh_reminders").insert({
          tenant_id: ctx.tenantId,
          type: "eksik_veri",
          message: `Fatura ${actionData.invoice_id}: Eksik alanlar — ${actionData.missing_fields}`,
          deadline_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        });
        if (error) return `Hata: ${error.message}`;
        return "Eksik veri hatirlatmasi olusturuldu.";
      }

      case "send_whatsapp": {
        const { sendText } = await import("@/platform/whatsapp/send");
        await sendText(actionData.phone as string, actionData.message as string);
        return "Mesaj gonderildi.";
      }

      default:
        return "Islem tamamlandi.";
    }
  },
};
