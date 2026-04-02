/**
 * Muhasebeci Agent — V2 (tool-using, memory-backed)
 *
 * Tracks unpaid dues, late payments, income/expense balance.
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
import { createProposalAndNotify, getUserBuilding } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const MUHASEBECI_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_unpaid_dues",
    description:
      "Ödenmemiş aidatları oku. filter: 'all' (tüm borçlar) veya 'late' (gecikmiş olanlar).",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["all", "late"], description: "Filtre" },
      },
      required: [],
    },
  },
  {
    name: "read_financial_summary",
    description: "Bina mali özeti: toplam gelir, gider, net bakiye, borçlu daire sayısı.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_payment_reminder",
    description: "Gecikmiş aidat için tahsilat hatırlatması oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        unit_number: { type: "string", description: "Daire numarası" },
        resident_name: { type: "string", description: "Sakin adı" },
        amount: { type: "number", description: "Borç tutarı (TL)" },
        period: { type: "string", description: "Borç dönemi (YYYY-MM)" },
      },
      required: ["unit_number", "resident_name", "amount"],
    },
  },
  {
    name: "create_financial_report",
    description: "Mali durum raporu oluşturup yöneticiye gönder. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        report_type: { type: "string", enum: ["monthly", "summary"], description: "Rapor tipi" },
        note: { type: "string", description: "Ek not (opsiyonel)" },
      },
      required: ["report_type"],
    },
  },
  {
    name: "draft_message",
    description: "Sakinlere taslak WhatsApp mesajı hazırla. Direkt göndermez, kullanıcıya gösterir.",
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

async function handleReadUnpaidDues(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const building = await getUserBuilding(ctx);
  if (!building) return { result: "Bina bulunamadı.", needsApproval: false };

  const supabase = getServiceClient();
  let query = supabase
    .from("sy_dues_ledger")
    .select("id, unit_id, period, amount, paid_amount, late_charge_kurus, is_paid")
    .eq("building_id", building.id)
    .eq("is_paid", false)
    .order("period", { ascending: true })
    .limit(15);

  if (input.filter === "late") {
    query = query.gt("late_charge_kurus", 0);
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Ödenmemiş aidat yok.", needsApproval: false };

  const list = data.map((d) => {
    const debt = (d.amount || 0) - (d.paid_amount || 0);
    const late = d.late_charge_kurus ? ` (+₺${(d.late_charge_kurus / 100).toFixed(2)} gecikme)` : "";
    return `- [${d.id}] Daire ${d.unit_id} | ${d.period} | Borç: ₺${debt.toLocaleString("tr-TR")}${late}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadFinancialSummary(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const building = await getUserBuilding(ctx);
  if (!building) return { result: "Bina bulunamadı.", needsApproval: false };

  const supabase = getServiceClient();

  const { data: unpaidDues } = await supabase
    .from("sy_dues_ledger")
    .select("amount, paid_amount, late_charge_kurus")
    .eq("building_id", building.id)
    .eq("is_paid", false);

  const unpaidCount = unpaidDues?.length || 0;
  const totalDebt = (unpaidDues || []).reduce(
    (sum, d) => sum + ((d.amount || 0) - (d.paid_amount || 0)),
    0,
  );
  const lateCount = (unpaidDues || []).filter(
    (d) => d.late_charge_kurus && d.late_charge_kurus > 0,
  ).length;

  const { data: incomeRows } = await supabase
    .from("sy_income_expenses")
    .select("amount_kurus")
    .eq("building_id", building.id)
    .eq("type", "income");

  const { data: expenseRows } = await supabase
    .from("sy_income_expenses")
    .select("amount_kurus")
    .eq("building_id", building.id)
    .eq("type", "expense");

  const income = (incomeRows || []).reduce((s, r) => s + (r.amount_kurus || 0), 0) / 100;
  const expense = (expenseRows || []).reduce((s, r) => s + (r.amount_kurus || 0), 0) / 100;

  const lines = [
    `Bina: ${building.name}`,
    `Borçlu daire: ${unpaidCount}`,
    `Toplam borç: ₺${totalDebt.toLocaleString("tr-TR")}`,
    `Gecikmiş: ${lateCount} daire`,
    `Toplam gelir: ₺${income.toLocaleString("tr-TR")}`,
    `Toplam gider: ₺${expense.toLocaleString("tr-TR")}`,
    `Net bakiye: ₺${(income - expense).toLocaleString("tr-TR")}`,
  ];
  return { result: lines.join("\n"), needsApproval: false };
}

async function handleCreatePaymentReminder(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const unitNumber = input.unit_number as string;
  const residentName = input.resident_name as string;
  const amount = input.amount as number;
  const period = (input.period as string) || "";
  const amountStr = `₺${Number(amount).toLocaleString("tr-TR")}`;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "sy_muhasebeci",
    actionType: "tahsilat_uyari",
    actionData: { unit_number: unitNumber, resident_name: residentName, amount, period },
    message: `💰 Daire ${unitNumber} (${residentName}) — ${amountStr} borç${period ? ` (${period})` : ""}.\nTahsilat hatırlatması gönderilsin mi?`,
    buttonLabel: "✅ Hatırlat",
  });
}

async function handleCreateFinancialReport(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const reportType = input.report_type as string;
  const note = (input.note as string) || "";
  const label = reportType === "monthly" ? "Aylık mali rapor" : "Mali durum özeti";

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "sy_muhasebeci",
    actionType: "gelir_gider_analiz",
    actionData: { report_type: reportType, note },
    message: `📊 ${label} hazırlansın mı?${note ? `\n📝 ${note}` : ""}`,
    buttonLabel: "✅ Hazırla",
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
    agentKey: "sy_muhasebeci",
    actionType: "send_whatsapp",
    actionData: { phone: input.resident_phone, message: input.message_text },
    message: `✉️ *${input.resident_name}* kişisine mesaj taslağı:\n\n📱 ${input.resident_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const muhasebeciToolHandlers: Record<string, ToolHandler> = {
  read_unpaid_dues: (input, ctx) => handleReadUnpaidDues(input, ctx),
  read_financial_summary: (input, ctx) => handleReadFinancialSummary(input, ctx),
  create_payment_reminder: handleCreatePaymentReminder,
  create_financial_report: handleCreateFinancialReport,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const muhasebeciAgent: AgentDefinition = {
  key: "sy_muhasebeci",
  name: "Muhasebeci",
  icon: "💰",
  tools: MUHASEBECI_TOOLS,
  toolHandlers: muhasebeciToolHandlers,

  systemPrompt:
    `Sen site yönetimi muhasebecisisin. Görevin binanın mali durumunu analiz etmek, ödenmemiş aidatları takip etmek ve tahsilat hatırlatmaları göndermek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_unpaid_dues: Ödenmemiş aidatları oku (all veya late filtresiyle)\n` +
    `- read_financial_summary: Bina mali özeti (gelir, gider, borç)\n` +
    `- create_payment_reminder: Tahsilat hatırlatması gönder (onay gerektirir)\n` +
    `- create_financial_report: Mali rapor hazırla (onay gerektirir)\n` +
    `- draft_message: Sakinlere mesaj taslağı hazırla (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim/öneri gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Sakinlere ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_unpaid_dues, read_financial_summary), sonra analiz et, sonra aksiyon öner.\n` +
    `- Gecikmiş aidatlar varsa tahsilat hatırlatması öner.\n` +
    `- Gelir-gider dengesizliği varsa rapor öner.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const config = await getAgentConfig(ctx.userId, "sy_muhasebeci");
    const building = await getUserBuilding(ctx);
    if (!building) return { noBuilding: true, agentConfig: config };

    const supabase = getServiceClient();

    const { data: unpaidDues } = await supabase
      .from("sy_dues_ledger")
      .select("amount, paid_amount, late_charge_kurus")
      .eq("building_id", building.id)
      .eq("is_paid", false);

    const unpaidCount = unpaidDues?.length || 0;
    const totalDebt = (unpaidDues || []).reduce(
      (sum, d) => sum + ((d.amount || 0) - (d.paid_amount || 0)),
      0,
    );
    const lateCount = (unpaidDues || []).filter(
      (d) => d.late_charge_kurus && d.late_charge_kurus > 0,
    ).length;

    const { data: incomeRows } = await supabase
      .from("sy_income_expenses")
      .select("amount_kurus")
      .eq("building_id", building.id)
      .eq("type", "income");

    const { data: expenseRows } = await supabase
      .from("sy_income_expenses")
      .select("amount_kurus")
      .eq("building_id", building.id)
      .eq("type", "expense");

    const income = (incomeRows || []).reduce((s, r) => s + (r.amount_kurus || 0), 0) / 100;
    const expense = (expenseRows || []).reduce((s, r) => s + (r.amount_kurus || 0), 0) / 100;

    const recentMessages = await getRecentMessages(ctx.userId, "sy_muhasebeci", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "sy_muhasebeci", 5);

    return {
      buildingName: building.name,
      buildingId: building.id,
      unpaidCount,
      totalDebt,
      lateCount,
      income,
      expense,
      net: income - expense,
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
    if (data.noBuilding) return "";

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
    prompt += `### Mali Özet\n`;
    prompt += `- Bina: ${data.buildingName}\n`;
    prompt += `- Borçlu daire: ${data.unpaidCount}\n`;
    prompt += `- Toplam borç: ₺${Number(data.totalDebt).toLocaleString("tr-TR")}\n`;
    prompt += `- Gecikmiş: ${data.lateCount} daire\n`;
    prompt += `- Gelir: ₺${Number(data.income).toLocaleString("tr-TR")}\n`;
    prompt += `- Gider: ₺${Number(data.expense).toLocaleString("tr-TR")}\n`;
    prompt += `- Net: ₺${Number(data.net).toLocaleString("tr-TR")}\n`;

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
      case "tahsilat_uyari": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Tahsilat: Daire ${actionData.unit_number} — ${actionData.resident_name}`,
          title: `Tahsilat hatırlatması: Daire ${actionData.unit_number}`,
          note: `Borç: ₺${Number(actionData.amount).toLocaleString("tr-TR")}${actionData.period ? ` (${actionData.period})` : ""}`,
          remind_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `Tahsilat hatırlatması oluşturuldu: Daire ${actionData.unit_number}`;
      }

      case "gelir_gider_analiz": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Mali rapor: ${actionData.report_type === "monthly" ? "Aylık" : "Özet"}`,
          title: `Mali durum raporu`,
          note: actionData.note || "Otomatik oluşturuldu",
          remind_at: new Date().toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return "Mali durum raporu hazırlandı.";
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
