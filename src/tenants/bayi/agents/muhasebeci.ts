/**
 * Muhasebeci Agent — V2 (tool-using, memory-backed)
 *
 * Tracks receivables, overdue payments, invoices, balance reports, account statements.
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
import { createProposalAndNotify, formatCurrency, formatDate } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const MUHASEBECI_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_receivables",
    description: "Toplam alacak ve borçlu bayileri oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_overdue_invoices",
    description: "Vadesi geçmiş faturaları oku. Tarihe göre sıralı.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_recent_invoices",
    description: "Son 7 günün faturalarını oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_dealer_statement",
    description: "Belirli bayinin hesap ekstresini oku.",
    input_schema: {
      type: "object",
      properties: {
        dealer_id: { type: "string", description: "Bayi ID" },
        dealer_name: { type: "string", description: "Bayi adi" },
      },
      required: ["dealer_id", "dealer_name"],
    },
  },
  {
    name: "record_payment",
    description: "Odeme kaydi olustur. Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        dealer_id: { type: "string", description: "Bayi ID" },
        dealer_name: { type: "string", description: "Bayi adi" },
        amount: { type: "number", description: "Odeme tutari" },
        note: { type: "string", description: "Odeme notu" },
      },
      required: ["dealer_id", "dealer_name", "amount"],
    },
  },
  {
    name: "draft_message",
    description: "Bayiye taslak WhatsApp mesaji. Direkt gondermez, kullaniciya gosterir.",
    input_schema: {
      type: "object",
      properties: {
        dealer_name: { type: "string", description: "Bayi adi" },
        dealer_phone: { type: "string", description: "Telefon numarasi" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["dealer_name", "dealer_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadReceivables(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: debtDealers, error } = await supabase
    .from("bayi_dealers")
    .select("id, name, balance")
    .eq("tenant_id", ctx.tenantId)
    .lt("balance", 0)
    .order("balance", { ascending: true });

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!debtDealers?.length) return { result: "Borclu bayi yok.", needsApproval: false };

  const totalReceivables = debtDealers.reduce((s, d) => s + Math.abs(d.balance || 0), 0);

  const list = debtDealers.map((d) =>
    `- [${d.id}] ${d.name} | ${formatCurrency(Math.abs(d.balance))} alacak`,
  );

  return {
    result: `Toplam alacak: ${formatCurrency(totalReceivables)} (${debtDealers.length} bayi)\n\n${list.join("\n")}`,
    needsApproval: false,
  };
}

async function handleReadOverdueInvoices(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data: invoices, error } = await supabase
    .from("bayi_dealer_invoices")
    .select("id, dealer_id, amount, due_date, bayi_dealers(name)")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_paid", false)
    .lt("due_date", now)
    .order("due_date", { ascending: true });

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!invoices?.length) return { result: "Vadesi gecmis fatura yok.", needsApproval: false };

  const list = invoices.map((inv) => {
    const daysOverdue = Math.floor(
      (Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24),
    );
    const dealerName = (inv.bayi_dealers as unknown as { name: string })?.name || "?";
    return `- [${inv.id}] ${dealerName} | ${formatCurrency(inv.amount)} | Vade: ${formatDate(inv.due_date)} (${daysOverdue} gun gecti)`;
  });

  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadRecentInvoices(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invoices, error } = await supabase
    .from("bayi_dealer_invoices")
    .select("id, dealer_id, amount, due_date, is_paid, created_at, bayi_dealers(name)")
    .eq("tenant_id", ctx.tenantId)
    .gte("created_at", week)
    .order("created_at", { ascending: false })
    .limit(15);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!invoices?.length) return { result: "Son 7 gunde fatura yok.", needsApproval: false };

  const list = invoices.map((inv) => {
    const dealerName = (inv.bayi_dealers as unknown as { name: string })?.name || "?";
    const status = inv.is_paid ? "Odendi" : "Odenmedi";
    return `- [${inv.id}] ${dealerName} | ${formatCurrency(inv.amount)} | Vade: ${formatDate(inv.due_date)} | ${status}`;
  });

  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadDealerStatement(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const dealerId = input.dealer_id as string;
  const dealerName = input.dealer_name as string;

  const { data: transactions, error } = await supabase
    .from("bayi_dealer_transactions")
    .select("id, type, amount, note, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("dealer_id", dealerId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!transactions?.length) return { result: `${dealerName} icin islem kaydi yok.`, needsApproval: false };

  const list = transactions.map((t) =>
    `- ${formatDate(t.created_at)} | ${t.type} | ${formatCurrency(t.amount)}${t.note ? ` | ${t.note}` : ""}`,
  );

  return {
    result: `${dealerName} - Hesap Ekstresi (son 20 islem)\n\n${list.join("\n")}`,
    needsApproval: false,
  };
}

async function handleRecordPayment(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "bayi_muhasebeci",
    actionType: "record_payment",
    actionData: {
      dealer_id: input.dealer_id,
      dealer_name: input.dealer_name,
      amount: input.amount,
      note: input.note || null,
    },
    message: `💳 *${input.dealer_name}* icin odeme kaydi:\n\n💰 ${formatCurrency(input.amount as number)}${input.note ? `\n📝 ${input.note}` : ""}`,
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
    agentKey: "bayi_muhasebeci",
    actionType: "send_whatsapp",
    actionData: { phone: input.dealer_phone, message: input.message_text },
    message: `✉️ *${input.dealer_name}* kisisine mesaj taslagi:\n\n📱 ${input.dealer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gonder",
  });
}

const muhasebeciToolHandlers: Record<string, ToolHandler> = {
  read_receivables: (input, ctx) => handleReadReceivables(input, ctx),
  read_overdue_invoices: (input, ctx) => handleReadOverdueInvoices(input, ctx),
  read_recent_invoices: (input, ctx) => handleReadRecentInvoices(input, ctx),
  read_dealer_statement: (input, ctx) => handleReadDealerStatement(input, ctx),
  record_payment: handleRecordPayment,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const muhasebeciAgent: AgentDefinition = {
  key: "bayi_muhasebeci",
  name: "Muhasebeci",
  icon: "💳",
  tools: MUHASEBECI_TOOLS,
  toolHandlers: muhasebeciToolHandlers,

  systemPrompt:
    `Sen bayi yonetim sisteminin muhasebecisisin. Gorevin alacaklari, gecikmiş odemeleri, faturalari ve hesap ekstrelerini takip etmek.\n\n` +
    `## Kullanabilecegin Araclar\n` +
    `- read_receivables: Toplam alacak ve borclu bayileri oku\n` +
    `- read_overdue_invoices: Vadesi gecmis faturalari oku\n` +
    `- read_recent_invoices: Son 7 gunun faturalarini oku\n` +
    `- read_dealer_statement: Belirli bayinin hesap ekstresini oku\n` +
    `- record_payment: Odeme kaydi olustur (onay gerektirir)\n` +
    `- draft_message: Bayiye taslak mesaj (onay gerektirir)\n` +
    `- notify_human: Kullaniciya bildirim gonder\n` +
    `- read_db: Veritabanindan veri oku\n\n` +
    `## Kurallar\n` +
    `- Bayiye ASLA direkt mesaj gonderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon icin kullanici onayi al.\n` +
    `- Once veri topla (read_receivables, read_overdue_invoices), sonra analiz et, sonra aksiyon oner.\n` +
    `- Kullanici tercihlerine (agent_config) gore davran: gecikme esigi, bakiye rapor sikligi, otomatik hatirlatma.\n` +
    `- Vadesi gecmis odemelere ve buyuk alacaklara oncelik ver.\n` +
    `- Otonomi seviyesi: HER SEYI SOR — hicbir yazma islemini onaysiz yapma.\n` +
    `- Yapilacak bir sey yoksa hicbir tool cagirma, kisa bir Turkce ozet yaz.\n` +
    `- Turkce yanit ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "bayi_muhasebeci");

    // Total receivables (dealers with negative balance)
    const { data: debtDealers } = await supabase
      .from("bayi_dealers")
      .select("id, name, balance")
      .eq("tenant_id", ctx.tenantId)
      .lt("balance", 0);

    const totalReceivables = (debtDealers || []).reduce((s, d) => s + Math.abs(d.balance || 0), 0);

    // Overdue invoices
    const now = new Date().toISOString();
    const { data: overdueInvoices } = await supabase
      .from("bayi_dealer_invoices")
      .select("id, amount")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_paid", false)
      .lt("due_date", now);

    const overdueTotal = (overdueInvoices || []).reduce((s, i) => s + (i.amount || 0), 0);

    // Recent invoices (last 7 days)
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentInvoiceCount } = await supabase
      .from("bayi_dealer_invoices")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", week);

    const recentMessages = await getRecentMessages(ctx.userId, "bayi_muhasebeci", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "bayi_muhasebeci", 5);

    return {
      totalReceivables,
      debtDealerCount: debtDealers?.length || 0,
      overdueCount: overdueInvoices?.length || 0,
      overdueTotal,
      recentInvoiceCount: recentInvoiceCount || 0,
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
    const totalReceivables = data.totalReceivables as number;
    const debtDealerCount = data.debtDealerCount as number;
    const overdueCount = data.overdueCount as number;
    const overdueTotal = data.overdueTotal as number;
    const recentInvoiceCount = data.recentInvoiceCount as number;
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    if (totalReceivables === 0 && overdueCount === 0 && recentInvoiceCount === 0) return "";

    const config = data.agentConfig as Record<string, unknown> | null;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    if (config) {
      prompt += `### Kullanici Tercihleri\n`;
      if (config.gecikme_esigi) prompt += `- Gecikme uyari esigi: ${config.gecikme_esigi} gun\n`;
      if (config.bakiye_rapor_sikligi) prompt += `- Bakiye rapor sikligi: ${config.bakiye_rapor_sikligi}\n`;
      if (config.otomatik_hatirlatma) prompt += `- Otomatik hatirlatma: ${config.otomatik_hatirlatma === "evet" ? "Aktif" : "Kapali"}\n`;
      prompt += `\n`;
    }

    prompt += `### Alacak Ozeti\n`;
    prompt += `- Toplam alacak: ${formatCurrency(totalReceivables)} (${debtDealerCount} bayi)\n`;

    prompt += `\n### Vadesi Gecen Faturalar\n`;
    prompt += `- Vadesi gecmis: ${overdueCount} adet (${formatCurrency(overdueTotal)})\n`;

    prompt += `\n### Son Faturalar\n`;
    prompt += `- Son 7 gun: ${recentInvoiceCount} adet\n`;

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
      case "record_payment": {
        // Insert transaction
        const { error: txError } = await supabase.from("bayi_dealer_transactions").insert({
          tenant_id: ctx.tenantId,
          dealer_id: actionData.dealer_id,
          type: "payment",
          amount: actionData.amount,
          note: actionData.note || null,
          created_at: new Date().toISOString(),
        });
        if (txError) return `Hata: ${txError.message}`;

        // Update dealer balance
        const { data: dealer } = await supabase
          .from("bayi_dealers")
          .select("balance")
          .eq("id", actionData.dealer_id)
          .eq("tenant_id", ctx.tenantId)
          .single();

        if (dealer) {
          const newBalance = (dealer.balance || 0) + (actionData.amount as number);
          await supabase
            .from("bayi_dealers")
            .update({ balance: newBalance })
            .eq("id", actionData.dealer_id)
            .eq("tenant_id", ctx.tenantId);
        }

        return `${actionData.dealer_name} icin ${formatCurrency(actionData.amount as number)} odeme kaydedildi.`;
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
