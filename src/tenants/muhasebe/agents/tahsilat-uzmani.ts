/**
 * Tahsilat Uzmani Agent — V2 (tool-using, memory-backed)
 *
 * Receivables tracking, overdue payments, cash flow analysis, risk assessment.
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

const TAHSILAT_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_receivables",
    description:
      "Alacaklari oku. filter: 'overdue'|'upcoming'|'all'. Vadesi gecen ve yaklasanlari listeler.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["overdue", "upcoming", "all"], description: "Filtre turu" },
      },
      required: [],
    },
  },
  {
    name: "read_cash_flow",
    description: "Nakit akis tahmini: beklenen alacak, geciken alacak, son donem tahsilat.",
    input_schema: {
      type: "object",
      properties: {
        period_days: { type: "number", description: "Kac gunluk tahmin (varsayilan 30)" },
      },
      required: [],
    },
  },
  {
    name: "read_risk_analysis",
    description: "Firma bazli risk degerlendirmesi: gecikme suresi, tutar, fatura sayisi.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_payments",
    description: "Son odemeleri listele.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Kac kayit (varsayilan 10)" },
      },
      required: [],
    },
  },
  {
    name: "send_payment_reminder",
    description: "Odeme hatirlatmasi olustur. Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        vendor_name: { type: "string", description: "Firma adi" },
        amount: { type: "number", description: "Tutar" },
        due_date: { type: "string", description: "Vade tarihi" },
        invoice_id: { type: "string", description: "Fatura ID" },
      },
      required: ["vendor_name", "amount"],
    },
  },
  {
    name: "draft_message",
    description: "Mukelleflere odeme hatirlatma mesaji taslagi hazirla. Direkt gondermez.",
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

async function handleReadReceivables(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("muh_invoices")
    .select("id, vendor_name, amount, due_date, invoice_no")
    .eq("tenant_id", ctx.tenantId)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })
    .limit(20);

  if (input.filter === "overdue") {
    query = query.lt("due_date", today);
  } else if (input.filter === "upcoming") {
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    query = query.gte("due_date", today).lte("due_date", thirtyDays);
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Alacak bulunamadi.", needsApproval: false };

  const total = data.reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.amount) || 0), 0);
  const list = data.map((inv: Record<string, unknown>) => {
    const amount = inv.amount != null ? `${Number(inv.amount).toLocaleString("tr-TR")} TL` : "-";
    return `- [${inv.id}] ${inv.vendor_name || "?"} | ${amount} | Vade: ${inv.due_date || "-"}`;
  });
  list.push(`\nToplam: ${total.toLocaleString("tr-TR")} TL (${data.length} fatura)`);
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadCashFlow(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const days = (input.period_days as number) || 30;
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const pastDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: upcoming } = await supabase
    .from("muh_invoices")
    .select("amount")
    .eq("tenant_id", ctx.tenantId)
    .not("due_date", "is", null)
    .gte("due_date", today)
    .lte("due_date", futureDate);

  const { data: overdue } = await supabase
    .from("muh_invoices")
    .select("amount")
    .eq("tenant_id", ctx.tenantId)
    .not("due_date", "is", null)
    .lt("due_date", today);

  const { data: payments } = await supabase
    .from("muh_payments")
    .select("amount")
    .eq("tenant_id", ctx.tenantId)
    .gte("payment_date", pastDate);

  const totalUpcoming = (upcoming || []).reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.amount) || 0), 0);
  const totalOverdue = (overdue || []).reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.amount) || 0), 0);
  const totalPayments = (payments || []).reduce((s: number, p: Record<string, unknown>) => s + (Number(p.amount) || 0), 0);

  const lines = [
    `Nakit Akis Tahmini (${days} gun)`,
    `Beklenen alacak: ${totalUpcoming.toLocaleString("tr-TR")} TL (${(upcoming || []).length} fatura)`,
    `Geciken alacak: ${totalOverdue.toLocaleString("tr-TR")} TL (${(overdue || []).length} fatura)`,
    `Son ${days} gun tahsilat: ${totalPayments.toLocaleString("tr-TR")} TL (${(payments || []).length} odeme)`,
    `Toplam beklenen: ${(totalUpcoming + totalOverdue).toLocaleString("tr-TR")} TL`,
  ];

  return { result: lines.join("\n"), needsApproval: false };
}

async function handleReadRiskAnalysis(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: overdueInvoices } = await supabase
    .from("muh_invoices")
    .select("vendor_name, amount, due_date")
    .eq("tenant_id", ctx.tenantId)
    .not("due_date", "is", null)
    .lt("due_date", today);

  if (!overdueInvoices?.length) return { result: "Geciken odeme yok, risk degerlendirmesi yapilamadi.", needsApproval: false };

  const vendorRisk: Record<string, { totalOverdue: number; count: number; maxDays: number }> = {};
  for (const inv of overdueInvoices) {
    const vendor = (inv as Record<string, unknown>).vendor_name as string || "Bilinmeyen";
    if (!vendorRisk[vendor]) vendorRisk[vendor] = { totalOverdue: 0, count: 0, maxDays: 0 };
    vendorRisk[vendor].totalOverdue += Number((inv as Record<string, unknown>).amount) || 0;
    vendorRisk[vendor].count += 1;
    if ((inv as Record<string, unknown>).due_date) {
      const daysOverdue = Math.floor((Date.now() - new Date((inv as Record<string, unknown>).due_date as string).getTime()) / (1000 * 60 * 60 * 24));
      vendorRisk[vendor].maxDays = Math.max(vendorRisk[vendor].maxDays, daysOverdue);
    }
  }

  const sorted = Object.entries(vendorRisk)
    .sort(([, a], [, b]) => b.totalOverdue - a.totalOverdue)
    .slice(0, 10);

  const list = sorted.map(([vendor, data]) => {
    const risk = data.maxDays > 90 ? "YUKSEK" : data.maxDays > 30 ? "ORTA" : "DUSUK";
    return `- ${vendor} | ${data.totalOverdue.toLocaleString("tr-TR")} TL | ${data.count} fatura | ${data.maxDays} gun gecikme | Risk: ${risk}`;
  });

  return { result: `Risk Degerlendirmesi:\n${list.join("\n")}`, needsApproval: false };
}

async function handleReadPayments(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const limit = (input.limit as number) || 10;

  const { data, error } = await supabase
    .from("muh_payments")
    .select("id, mukellef_name, amount, method, payment_date")
    .eq("tenant_id", ctx.tenantId)
    .order("payment_date", { ascending: false })
    .limit(limit);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Odeme kaydi bulunamadi.", needsApproval: false };

  const list = data.map((p: Record<string, unknown>) =>
    `- [${p.id}] ${p.mukellef_name || "?"} | ${Number(p.amount).toLocaleString("tr-TR")} TL | ${p.method || "?"} | ${p.payment_date || "-"}`
  );
  return { result: list.join("\n"), needsApproval: false };
}

async function handleSendPaymentReminder(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const amountStr = input.amount ? `${Number(input.amount).toLocaleString("tr-TR")} TL` : "";
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "muh_tahsilatUzmani",
    actionType: "send_payment_reminder",
    actionData: { vendor_name: input.vendor_name, amount: input.amount, invoice_id: input.invoice_id },
    message: `"${input.vendor_name}" icin odeme hatirlatmasi olusturulsun mu?\nTutar: ${amountStr}${input.due_date ? `\nVade: ${input.due_date}` : ""}`,
    buttonLabel: "Hatirlatma Gonder",
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
    agentKey: "muh_tahsilatUzmani",
    actionType: "send_whatsapp",
    actionData: { phone: input.recipient_phone, message: input.message_text },
    message: `*${input.recipient_name}* icin mesaj taslagi:\n\n${input.recipient_phone}\n_${input.message_text}_`,
    buttonLabel: "Gonder",
  });
}

const tahsilatToolHandlers: Record<string, ToolHandler> = {
  read_receivables: (input, ctx) => handleReadReceivables(input, ctx),
  read_cash_flow: (input, ctx) => handleReadCashFlow(input, ctx),
  read_risk_analysis: (input, ctx) => handleReadRiskAnalysis(input, ctx),
  read_payments: (input, ctx) => handleReadPayments(input, ctx),
  send_payment_reminder: handleSendPaymentReminder,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const tahsilatUzmaniAgent: AgentDefinition = {
  key: "muh_tahsilatUzmani",
  name: "Tahsilat Uzmani",
  icon: "💰",
  tools: TAHSILAT_TOOLS,
  toolHandlers: tahsilatToolHandlers,

  systemPrompt:
    `Sen muhasebe burosunun tahsilat uzmanisin. Gorevin alacaklari takip etmek, vadesi gecen odemeleri tespit etmek, nakit akis tahmini yapmak ve risk degerlendirmesi sunmak.\n\n` +
    `## Kullanabilecegin Araclar\n` +
    `- read_receivables: Alacaklari oku (filtreli)\n` +
    `- read_cash_flow: Nakit akis tahmini\n` +
    `- read_risk_analysis: Firma bazli risk degerlendirmesi\n` +
    `- read_payments: Son odemeleri listele\n` +
    `- send_payment_reminder: Odeme hatirlatmasi (onay gerektirir)\n` +
    `- draft_message: Mesaj taslagi hazirla (onay gerektirir)\n` +
    `- notify_human: Kullaniciya bildirim/oneri gonder\n` +
    `- read_db: Veritabanindan veri oku\n\n` +
    `## Kurallar\n` +
    `- Kimseye ASLA direkt mesaj gonderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon icin kullanici onayi al.\n` +
    `- Otonomi seviyesi: HER SEYI SOR — hicbir yazma islemini onaysiz yapma.\n` +
    `- Once veri topla, sonra analiz et, sonra aksiyon oner.\n` +
    `- Yapilacak bir sey yoksa hicbir tool cagirma, kisa bir Turkce ozet yaz.\n` +
    `- Turkce yanit ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const today = new Date().toISOString().split("T")[0];

    const { data: overdue } = await supabase
      .from("muh_invoices")
      .select("amount")
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null)
      .lt("due_date", today);

    const totalOverdue = (overdue || []).reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.amount) || 0), 0);

    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: upcoming } = await supabase
      .from("muh_invoices")
      .select("amount")
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null)
      .gte("due_date", today)
      .lte("due_date", thirtyDays);

    const totalUpcoming = (upcoming || []).reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.amount) || 0), 0);

    const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: payments } = await supabase
      .from("muh_payments")
      .select("amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("payment_date", thirtyAgo);

    const totalPayments = (payments || []).reduce((s: number, p: Record<string, unknown>) => s + (Number(p.amount) || 0), 0);

    const recentMessages = await getRecentMessages(ctx.userId, "muh_tahsilatUzmani", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "muh_tahsilatUzmani", 5);

    return {
      overdueCount: overdue?.length ?? 0,
      totalOverdue,
      upcomingCount: upcoming?.length ?? 0,
      totalUpcoming,
      recentPayments: payments?.length ?? 0,
      totalPayments,
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
    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;
    prompt += `### Tahsilat Ozeti\n`;
    prompt += `- Geciken alacak: ${data.overdueCount} fatura, ${Number(data.totalOverdue).toLocaleString("tr-TR")} TL\n`;
    prompt += `- 30 gun icinde beklenen: ${data.upcomingCount} fatura, ${Number(data.totalUpcoming).toLocaleString("tr-TR")} TL\n`;
    prompt += `- Son 30 gun tahsilat: ${data.recentPayments} odeme, ${Number(data.totalPayments).toLocaleString("tr-TR")} TL\n`;

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
      case "send_payment_reminder": {
        const { error } = await supabase.from("muh_tahsilat_reminders").insert({
          tenant_id: ctx.tenantId,
          invoice_id: actionData.invoice_id || null,
          reminder_type: "agent_auto",
          sent_at: new Date().toISOString(),
          email_sent: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `Odeme hatirlatmasi olusturuldu: ${actionData.vendor_name}`;
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
