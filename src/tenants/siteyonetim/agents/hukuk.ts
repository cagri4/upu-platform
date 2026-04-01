/**
 * Hukuk Müşaviri Agent — V2 (tool-using, memory-backed)
 *
 * Legal compliance, KMK regulations, overdue dues tracking, enforcement.
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
import { createProposalAndNotify, getUserBuilding } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const HUKUK_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_overdue_dues",
    description:
      "3+ ay gecikmiş aidatları oku. Hukuki işlem potansiyeli olan borçları listeler.",
    input_schema: {
      type: "object",
      properties: {
        min_months: { type: "number", description: "Minimum gecikme ayı (varsayılan 3)" },
      },
      required: [],
    },
  },
  {
    name: "read_legal_summary",
    description: "Bina hukuki özeti: daire sayısı, doluluk, 3+ ay gecikmiş borçlar, toplam risk.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_legal_notice",
    description: "Yasal ihtar/uyarı oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        unit_number: { type: "string", description: "Daire numarası" },
        resident_name: { type: "string", description: "Sakin adı" },
        debt_amount: { type: "number", description: "Borç tutarı (TL)" },
        overdue_months: { type: "number", description: "Gecikme süresi (ay)" },
        notice_type: { type: "string", enum: ["uyari", "ihtar", "icra_uyari"], description: "İhtar tipi" },
      },
      required: ["unit_number", "resident_name", "debt_amount", "notice_type"],
    },
  },
  {
    name: "flag_enforcement",
    description: "İcra takibi önerisi oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        unit_number: { type: "string", description: "Daire numarası" },
        resident_name: { type: "string", description: "Sakin adı" },
        debt_amount: { type: "number", description: "Toplam borç (TL)" },
        overdue_months: { type: "number", description: "Gecikme süresi (ay)" },
        reason: { type: "string", description: "İcra gerekçesi" },
      },
      required: ["unit_number", "resident_name", "debt_amount", "reason"],
    },
  },
  {
    name: "draft_message",
    description: "Sakine hukuki bilgilendirme taslağı hazırla. Direkt göndermez, kullanıcıya gösterir.",
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

async function handleReadOverdueDues(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const building = await getUserBuilding(ctx);
  if (!building) return { result: "Bina bulunamadı.", needsApproval: false };

  const supabase = getServiceClient();
  const minMonths = (input.min_months as number) || 3;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - minMonths);
  const cutoffPeriod = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("sy_dues_ledger")
    .select("id, unit_id, period, amount, paid_amount")
    .eq("building_id", building.id)
    .eq("is_paid", false)
    .lte("period", cutoffPeriod)
    .order("period", { ascending: true })
    .limit(15);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: `${minMonths}+ ay gecikmiş borç yok.`, needsApproval: false };

  const list = data.map((d) => {
    const debt = (d.amount || 0) - (d.paid_amount || 0);
    return `- [${d.id}] Daire ${d.unit_id} | ${d.period} | Borç: ₺${debt.toLocaleString("tr-TR")}`;
  });
  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadLegalSummary(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const building = await getUserBuilding(ctx);
  if (!building) return { result: "Bina bulunamadı.", needsApproval: false };

  const supabase = getServiceClient();

  const { count: unitCount } = await supabase
    .from("sy_units")
    .select("id", { count: "exact", head: true })
    .eq("building_id", building.id);

  const { data: occupiedUnits } = await supabase
    .from("sy_residents")
    .select("unit_id")
    .eq("building_id", building.id)
    .eq("is_active", true);

  const uniqueOccupied = new Set((occupiedUnits || []).map((r) => r.unit_id)).size;

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsPeriod = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, "0")}`;

  const { data: severelyLate } = await supabase
    .from("sy_dues_ledger")
    .select("amount, paid_amount")
    .eq("building_id", building.id)
    .eq("is_paid", false)
    .lte("period", threeMonthsPeriod);

  const severelyLateCount = severelyLate?.length || 0;
  const lateDebt = (severelyLate || []).reduce(
    (sum, d) => sum + ((d.amount || 0) - (d.paid_amount || 0)),
    0,
  );

  const lines = [
    `Bina: ${building.name}`,
    `Toplam daire: ${unitCount || 0}`,
    `Dolu daire: ${uniqueOccupied}`,
    `Boş daire: ${(unitCount || 0) - uniqueOccupied}`,
    `3+ ay gecikmiş: ${severelyLateCount} kayıt`,
    `Toplam gecikmiş borç: ₺${lateDebt.toLocaleString("tr-TR")}`,
  ];
  return { result: lines.join("\n"), needsApproval: false };
}

async function handleCreateLegalNotice(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const unitNumber = input.unit_number as string;
  const residentName = input.resident_name as string;
  const debtAmount = input.debt_amount as number;
  const noticeType = input.notice_type as string;
  const overdueMonths = (input.overdue_months as number) || 0;
  const amountStr = `₺${Number(debtAmount).toLocaleString("tr-TR")}`;

  const typeLabels: Record<string, string> = {
    uyari: "Uyarı",
    ihtar: "İhtar",
    icra_uyari: "İcra uyarısı",
  };

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "sy_hukukMusaviri",
    actionType: "yasal_uyari",
    actionData: { unit_number: unitNumber, resident_name: residentName, debt_amount: debtAmount, notice_type: noticeType, overdue_months: overdueMonths },
    message: `⚖️ *${typeLabels[noticeType] || noticeType}* — Daire ${unitNumber} (${residentName})\nBorç: ${amountStr}${overdueMonths ? ` | ${overdueMonths} ay gecikme` : ""}\n\nYasal bildirim oluşturulsun mu?`,
    buttonLabel: "✅ Oluştur",
  });
}

async function handleFlagEnforcement(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const unitNumber = input.unit_number as string;
  const residentName = input.resident_name as string;
  const debtAmount = input.debt_amount as number;
  const reason = input.reason as string;
  const amountStr = `₺${Number(debtAmount).toLocaleString("tr-TR")}`;

  return createProposalAndNotify({
    ctx, taskId, agentName, agentIcon,
    agentKey: "sy_hukukMusaviri",
    actionType: "icra_takip",
    actionData: { unit_number: unitNumber, resident_name: residentName, debt_amount: debtAmount, reason },
    message: `⚖️ *İcra Takip Önerisi*\nDaire ${unitNumber} (${residentName}) — ${amountStr}\n📝 ${reason}\n\nİcra takip kaydı oluşturulsun mu?`,
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
    agentKey: "sy_hukukMusaviri",
    actionType: "send_whatsapp",
    actionData: { phone: input.resident_phone, message: input.message_text },
    message: `✉️ *${input.resident_name}* kişisine mesaj taslağı:\n\n📱 ${input.resident_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const hukukToolHandlers: Record<string, ToolHandler> = {
  read_overdue_dues: (input, ctx) => handleReadOverdueDues(input, ctx),
  read_legal_summary: (input, ctx) => handleReadLegalSummary(input, ctx),
  create_legal_notice: handleCreateLegalNotice,
  flag_enforcement: handleFlagEnforcement,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const hukukAgent: AgentDefinition = {
  key: "sy_hukukMusaviri",
  name: "Hukuk Müşaviri",
  icon: "⚖️",
  tools: HUKUK_TOOLS,
  toolHandlers: hukukToolHandlers,

  systemPrompt:
    `Sen site yönetimi hukuk müşavirisin. Görevin KMK mevzuatı çerçevesinde yasal uyum, borç takibi ve icra süreçlerini yönetmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_overdue_dues: 3+ ay gecikmiş aidatları oku\n` +
    `- read_legal_summary: Bina hukuki özeti (doluluk, borç, risk)\n` +
    `- create_legal_notice: Yasal ihtar/uyarı oluştur (onay gerektirir)\n` +
    `- flag_enforcement: İcra takip önerisi (onay gerektirir)\n` +
    `- draft_message: Sakine hukuki bilgilendirme mesajı hazırla (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim/öneri gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Sakinlere ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Önce veri topla (read_overdue_dues, read_legal_summary), sonra analiz et, sonra aksiyon öner.\n` +
    `- 3+ ay gecikmiş borçlarda yasal uyarı öner.\n` +
    `- 6+ ay gecikmiş borçlarda icra takip önerisi değerlendir.\n` +
    `- KMK 20. madde: her kat maliki gider ve avans payını ödemekle yükümlüdür.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const building = await getUserBuilding(ctx);
    if (!building) return { noBuilding: true };

    const supabase = getServiceClient();

    const { count: unitCount } = await supabase
      .from("sy_units")
      .select("id", { count: "exact", head: true })
      .eq("building_id", building.id);

    const { data: occupiedUnits } = await supabase
      .from("sy_residents")
      .select("unit_id")
      .eq("building_id", building.id)
      .eq("is_active", true);

    const uniqueOccupied = new Set((occupiedUnits || []).map((r) => r.unit_id)).size;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsPeriod = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, "0")}`;

    const { data: severelyLate } = await supabase
      .from("sy_dues_ledger")
      .select("amount, paid_amount")
      .eq("building_id", building.id)
      .eq("is_paid", false)
      .lte("period", threeMonthsPeriod);

    const severelyLateCount = severelyLate?.length || 0;
    const lateDebt = (severelyLate || []).reduce(
      (sum, d) => sum + ((d.amount || 0) - (d.paid_amount || 0)),
      0,
    );

    const recentMessages = await getRecentMessages(ctx.userId, "sy_hukukMusaviri", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "sy_hukukMusaviri", 5);

    return {
      buildingName: building.name,
      buildingId: building.id,
      unitCount: unitCount || 0,
      occupiedCount: uniqueOccupied,
      emptyCount: (unitCount || 0) - uniqueOccupied,
      severelyLateCount,
      lateDebt,
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
    prompt += `### Hukuki Özet\n`;
    prompt += `- Bina: ${data.buildingName}\n`;
    prompt += `- Toplam daire: ${data.unitCount}\n`;
    prompt += `- Dolu: ${data.occupiedCount}, Boş: ${data.emptyCount}\n`;
    prompt += `- 3+ ay gecikmiş: ${data.severelyLateCount} kayıt\n`;
    prompt += `- Toplam gecikmiş borç: ₺${Number(data.lateDebt).toLocaleString("tr-TR")}\n`;

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
      case "yasal_uyari": {
        const typeLabels: Record<string, string> = {
          uyari: "Uyarı",
          ihtar: "İhtar",
          icra_uyari: "İcra uyarısı",
        };
        const label = typeLabels[(actionData.notice_type as string) || ""] || "Yasal bildirim";
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `${label}: Daire ${actionData.unit_number} — ${actionData.resident_name}`,
          title: `${label}: Daire ${actionData.unit_number}`,
          note: `Borç: ₺${Number(actionData.debt_amount).toLocaleString("tr-TR")}${actionData.overdue_months ? ` | ${actionData.overdue_months} ay gecikme` : ""}`,
          remind_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `${label} oluşturuldu: Daire ${actionData.unit_number}`;
      }

      case "icra_takip": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `İcra takip: Daire ${actionData.unit_number} — ${actionData.resident_name}`,
          title: `İcra takip önerisi: Daire ${actionData.unit_number}`,
          note: `Borç: ₺${Number(actionData.debt_amount).toLocaleString("tr-TR")} | ${actionData.reason}`,
          remind_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `İcra takip kaydı oluşturuldu: Daire ${actionData.unit_number}`;
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
