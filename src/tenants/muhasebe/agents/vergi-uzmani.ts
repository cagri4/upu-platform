/**
 * Vergi Uzmani Agent — V2 (tool-using, memory-backed)
 *
 * Tax calculations, declaration tracking, tax rate analysis, compliance checks.
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

const VERGI_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_filing_status",
    description:
      "Beyanname durumlarini oku. filter: 'pending'|'overdue'|'completed'|'all'.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["pending", "overdue", "completed", "all"], description: "Filtre turu" },
      },
      required: [],
    },
  },
  {
    name: "read_tax_summary",
    description: "Vergi ozeti: bu donemki faturalar, tahmini KDV, gelir vergisi, kurumlar vergisi.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["month", "quarter", "year"], description: "Donem" },
      },
      required: [],
    },
  },
  {
    name: "read_tax_rates",
    description: "Guncel vergi oranlarini oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_filing_status",
    description: "Beyanname durumunu guncelle (bekliyor → tamamlandi). Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        filing_id: { type: "string", description: "Beyanname ID" },
        beyanname_type: { type: "string", description: "Beyanname turu" },
        new_status: { type: "string", description: "Yeni durum" },
      },
      required: ["filing_id", "beyanname_type", "new_status"],
    },
  },
  {
    name: "create_tax_alert",
    description: "Vergi uyarisi/hatirlatmasi olustur. Kullanici onayi gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        alert_type: { type: "string", description: "Uyari turu" },
        message: { type: "string", description: "Uyari mesaji" },
        deadline: { type: "string", description: "Son tarih (YYYY-MM-DD)" },
      },
      required: ["alert_type", "message"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadFilingStatus(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("muh_beyanname_statuses")
    .select("id, beyanname_type, period, status, deadline_date")
    .eq("tenant_id", ctx.tenantId)
    .order("deadline_date", { ascending: true })
    .limit(20);

  if (input.filter === "pending") {
    query = query.neq("status", "tamamlandi");
  } else if (input.filter === "overdue") {
    query = query.neq("status", "tamamlandi").lt("deadline_date", today);
  } else if (input.filter === "completed") {
    query = query.eq("status", "tamamlandi");
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Beyanname kaydi bulunamadi.", needsApproval: false };

  const list = data.map((s: Record<string, unknown>) =>
    `- [${s.id}] ${s.beyanname_type} (${s.period || "-"}) | ${s.status} | Son: ${s.deadline_date || "-"}`
  );
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadTaxSummary(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const now = new Date();

  let startDate: string;
  if (input.period === "quarter") {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    startDate = `${now.getFullYear()}-${String(qMonth + 1).padStart(2, "0")}-01`;
  } else if (input.period === "year") {
    startDate = `${now.getFullYear()}-01-01`;
  } else {
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }

  const { data: invoices } = await supabase
    .from("muh_invoices")
    .select("amount")
    .eq("tenant_id", ctx.tenantId)
    .gte("invoice_date", startDate);

  const total = (invoices || []).reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.amount) || 0), 0);
  const count = invoices?.length ?? 0;
  const estimatedKdv = total * 0.20;

  const { count: pendingFilings } = await supabase
    .from("muh_beyanname_statuses")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .neq("status", "tamamlandi");

  const lines = [
    `Donem: ${input.period || "month"}`,
    `Fatura sayisi: ${count}`,
    `Toplam tutar: ${total.toLocaleString("tr-TR")} TL`,
    `Tahmini KDV (%20): ${estimatedKdv.toLocaleString("tr-TR")} TL`,
    `Bekleyen beyanname: ${pendingFilings ?? 0}`,
  ];

  return { result: lines.join("\n"), needsApproval: false };
}

async function handleReadTaxRates(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data: rates } = await supabase
    .from("muh_tax_rates")
    .select("category, name, rate, description")
    .or(`tenant_id.eq.${ctx.tenantId},tenant_id.is.null`)
    .order("category", { ascending: true });

  if (!rates?.length) {
    return { result: "Varsayilan oranlar: KDV %20, Kurumlar %25, Gelir Vergisi dilimli (%15-%40)", needsApproval: false };
  }

  const list = rates.map((r: Record<string, unknown>) =>
    `- ${r.category || "Genel"}: ${r.name} %${r.rate}${r.description ? ` (${r.description})` : ""}`
  );
  return { result: list.join("\n"), needsApproval: false };
}

async function handleUpdateFilingStatus(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "muh_vergiUzmani",
    actionType: "update_filing_status",
    actionData: { filing_id: input.filing_id, new_status: input.new_status },
    message: `"${input.beyanname_type}" beyanname durumu "${input.new_status}" olarak guncellensin mi?`,
    buttonLabel: "Guncelle",
  });
}

async function handleCreateTaxAlert(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "muh_vergiUzmani",
    actionType: "create_tax_alert",
    actionData: { alert_type: input.alert_type, message: input.message, deadline: input.deadline },
    message: `Vergi uyarisi olusturulsun mu?\n\nTur: ${input.alert_type}\n${input.message}${input.deadline ? `\nSon tarih: ${input.deadline}` : ""}`,
    buttonLabel: "Olustur",
  });
}

const vergiToolHandlers: Record<string, ToolHandler> = {
  read_filing_status: (input, ctx) => handleReadFilingStatus(input, ctx),
  read_tax_summary: (input, ctx) => handleReadTaxSummary(input, ctx),
  read_tax_rates: (input, ctx) => handleReadTaxRates(input, ctx),
  update_filing_status: handleUpdateFilingStatus,
  create_tax_alert: handleCreateTaxAlert,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const vergiUzmaniAgent: AgentDefinition = {
  key: "muh_vergiUzmani",
  name: "Vergi Uzmani",
  icon: "🧮",
  tools: VERGI_TOOLS,
  toolHandlers: vergiToolHandlers,

  systemPrompt:
    `Sen muhasebe burosunun vergi uzmanisin. Gorevin vergi hesaplamak, beyanname durumlarini takip etmek, vergi oranlarini analiz etmek ve uyumluluk kontrolleri yapmak.\n\n` +
    `## Kullanabilecegin Araclar\n` +
    `- read_filing_status: Beyanname durumlari (filtreli)\n` +
    `- read_tax_summary: Donem vergi ozeti\n` +
    `- read_tax_rates: Guncel vergi oranlari\n` +
    `- update_filing_status: Beyanname durumu guncelle (onay gerektirir)\n` +
    `- create_tax_alert: Vergi uyarisi olustur (onay gerektirir)\n` +
    `- notify_human: Kullaniciya bildirim/oneri gonder\n` +
    `- read_db: Veritabanindan veri oku\n\n` +
    `## Kurallar\n` +
    `- Her kritik aksiyon icin kullanici onayi al.\n` +
    `- Otonomi seviyesi: HER SEYI SOR — hicbir yazma islemini onaysiz yapma.\n` +
    `- Once veri topla, sonra analiz et, sonra aksiyon oner.\n` +
    `- Kullanici tercihlerine (agent_config) gore davran.\n` +
    `- Yapilacak bir sey yoksa hicbir tool cagirma, kisa bir Turkce ozet yaz.\n` +
    `- Turkce yanit ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "muh_vergiUzmani");
    const today = new Date().toISOString().split("T")[0];

    const { count: pendingFilings } = await supabase
      .from("muh_beyanname_statuses")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "tamamlandi");

    const { count: overdueFilings } = await supabase
      .from("muh_beyanname_statuses")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "tamamlandi")
      .lt("deadline_date", today);

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: monthInvoices } = await supabase
      .from("muh_invoices")
      .select("amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("invoice_date", monthStart);

    const monthTotal = (monthInvoices || []).reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.amount) || 0), 0);

    const recentMessages = await getRecentMessages(ctx.userId, "muh_vergiUzmani", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "muh_vergiUzmani", 5);

    return {
      pendingFilings: pendingFilings ?? 0,
      overdueFilings: overdueFilings ?? 0,
      monthInvoiceCount: monthInvoices?.length ?? 0,
      monthTotal,
      estimatedKdv: monthTotal * 0.20,
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
    prompt += `### Vergi Ozeti\n`;
    prompt += `- Bekleyen beyanname: ${data.pendingFilings}\n`;
    prompt += `- Geciken beyanname: ${data.overdueFilings}\n`;
    prompt += `- Bu ay fatura: ${data.monthInvoiceCount} adet, ${Number(data.monthTotal).toLocaleString("tr-TR")} TL\n`;
    prompt += `- Tahmini KDV: ${Number(data.estimatedKdv).toLocaleString("tr-TR")} TL\n`;

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
      case "update_filing_status": {
        const { error } = await supabase
          .from("muh_beyanname_statuses")
          .update({ status: actionData.new_status, updated_at: new Date().toISOString() })
          .eq("id", actionData.filing_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return `Beyanname durumu guncellendi: ${actionData.new_status}`;
      }

      case "create_tax_alert": {
        const { error } = await supabase.from("muh_reminders").insert({
          tenant_id: ctx.tenantId,
          type: actionData.alert_type as string || "vergi",
          message: actionData.message as string,
          deadline_date: actionData.deadline as string || null,
        });
        if (error) return `Hata: ${error.message}`;
        return "Vergi uyarisi olusturuldu.";
      }

      default:
        return "Islem tamamlandi.";
    }
  },
};
