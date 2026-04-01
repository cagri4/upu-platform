/**
 * Platform Tools — available to all agents
 *
 * Tools that require human approval create proposals and pause the task.
 * Read-only tools execute immediately.
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import type { AgentContext, AgentToolDefinition, ToolHandler } from "./types";
import { updateTaskStatus, logStep } from "./memory";

// ── Tool Definitions (for Claude tool_use) ─────────────────────────────

export const PLATFORM_TOOLS: AgentToolDefinition[] = [
  {
    name: "notify_human",
    description: "Kullanıcıya bir öneri/bildirim gönder ve onay bekle. Kritik aksiyonlar için kullan.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Kullanıcıya gösterilecek mesaj" },
        action_type: { type: "string", description: "Aksiyon tipi (kısa tanımlayıcı)" },
        action_data: { type: "object", description: "Onaylanırsa kullanılacak veri" },
      },
      required: ["message", "action_type"],
    },
  },
  {
    name: "read_db",
    description: "Veritabanından veri oku. Onay gerektirmez.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Tablo adı" },
        select: { type: "string", description: "Seçilecek alanlar (virgülle ayrılmış)" },
        filters: { type: "object", description: "Filtreler: {alan: değer}" },
        limit: { type: "number", description: "Max satır sayısı" },
      },
      required: ["table"],
    },
  },
  {
    name: "write_db",
    description: "Veritabanına veri yaz. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Tablo adı" },
        operation: { type: "string", enum: ["insert", "update", "delete"], description: "İşlem tipi" },
        data: { type: "object", description: "Yazılacak veri" },
        filters: { type: "object", description: "Update/delete için filtreler" },
      },
      required: ["table", "operation"],
    },
  },
  {
    name: "create_reminder",
    description: "Hatırlatma oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        remind_at: { type: "string", description: "ISO tarih" },
        note: { type: "string" },
      },
      required: ["title", "remind_at"],
    },
  },
  {
    name: "send_whatsapp",
    description: "WhatsApp mesajı gönder. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        phone: { type: "string" },
        message: { type: "string" },
      },
      required: ["phone", "message"],
    },
  },
];

// ── Tool Execution ─────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
  domainHandlers?: Record<string, ToolHandler>,
): Promise<{ result: string; needsApproval: boolean }> {
  switch (toolName) {
    case "read_db":
      return await executeReadDB(input, ctx);

    case "notify_human":
      return await executeNotifyHuman(input, ctx, taskId, agentName, agentIcon);

    case "write_db":
      return await executeWriteDB(input, ctx, taskId, agentName, agentIcon);

    case "create_reminder":
      return await executeCreateReminder(input, ctx, taskId, agentName, agentIcon);

    case "send_whatsapp":
      return await executeSendWhatsApp(input, ctx, taskId, agentName, agentIcon);

    default: {
      // Check domain-specific tool handlers from agent
      const handler = domainHandlers?.[toolName];
      if (handler) {
        return await handler(input, ctx, taskId, agentName, agentIcon);
      }
      return { result: `Unknown tool: ${toolName}`, needsApproval: false };
    }
  }
}

// ── read_db — no approval needed ───────────────────────────────────────

async function executeReadDB(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<{ result: string; needsApproval: boolean }> {
  const supabase = getServiceClient();
  const table = input.table as string;
  const select = (input.select as string) || "*";
  const filters = (input.filters as Record<string, unknown>) || {};
  const limit = (input.limit as number) || 20;

  let query = supabase.from(table).select(select).limit(limit);

  // Always scope to tenant
  query = query.eq("tenant_id", ctx.tenantId);

  for (const [key, val] of Object.entries(filters)) {
    query = query.eq(key, val);
  }

  const { data, error } = await query;
  if (error) return { result: `DB error: ${error.message}`, needsApproval: false };
  return { result: JSON.stringify(data || []), needsApproval: false };
}

// ── notify_human — creates proposal, pauses task ───────────────────────

async function executeNotifyHuman(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<{ result: string; needsApproval: boolean }> {
  const supabase = getServiceClient();

  const { data: proposal } = await supabase
    .from("agent_proposals")
    .insert({
      user_id: ctx.userId,
      tenant_id: ctx.tenantId,
      agent_key: agentName,
      action_type: (input.action_type as string) || "notification",
      action_data: (input.action_data as Record<string, unknown>) || {},
      message: input.message as string,
      status: "pending",
    })
    .select("id")
    .single();

  if (!proposal) return { result: "Failed to create proposal", needsApproval: false };

  // Link proposal to task
  await updateTaskStatus(taskId, "waiting_human", { pending_proposal_id: proposal.id });

  // Send to user
  await sendButtons(
    ctx.phone,
    `${agentIcon} *${agentName}*\n\n${input.message}`,
    [
      { id: `agent_ok:${proposal.id}`, title: "✅ Onayla" },
      { id: `agent_no:${proposal.id}`, title: "❌ Geç" },
    ],
  );

  return { result: `Proposal sent: ${proposal.id}`, needsApproval: true };
}

// ── write_db — creates proposal ────────────────────────────────────────

async function executeWriteDB(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<{ result: string; needsApproval: boolean }> {
  const op = input.operation as string;
  const table = input.table as string;
  const msg = `Veritabanı işlemi: ${op} on ${table}`;

  return executeNotifyHuman(
    { message: msg, action_type: `db_${op}`, action_data: input },
    ctx, taskId, agentName, agentIcon,
  );
}

// ── create_reminder — creates proposal ─────────────────────────────────

async function executeCreateReminder(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<{ result: string; needsApproval: boolean }> {
  const title = input.title as string;
  const msg = `Hatırlatma oluşturulsun mu?\n\n📌 ${title}\n⏰ ${input.remind_at}${input.note ? `\n📝 ${input.note}` : ""}`;

  return executeNotifyHuman(
    { message: msg, action_type: "create_reminder", action_data: input },
    ctx, taskId, agentName, agentIcon,
  );
}

// ── send_whatsapp — creates proposal ───────────────────────────────────

async function executeSendWhatsApp(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<{ result: string; needsApproval: boolean }> {
  const msg = `WhatsApp mesajı gönderilsin mi?\n\n📱 ${input.phone}\n💬 ${input.message}`;

  return executeNotifyHuman(
    { message: msg, action_type: "send_whatsapp", action_data: input },
    ctx, taskId, agentName, agentIcon,
  );
}
