/**
 * Shared helpers for bayi agent tool handlers.
 * Reduces boilerplate for the proposal → notify → wait_human pattern.
 */

import type { AgentContext, ToolResult } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import { updateTaskStatus } from "@/platform/agents/memory";

interface ProposalParams {
  ctx: AgentContext;
  taskId: string;
  agentName: string;
  agentIcon: string;
  agentKey: string;
  actionType: string;
  actionData: Record<string, unknown>;
  message: string;
  buttonLabel?: string;
}

/**
 * Creates a proposal in agent_proposals, sets task to waiting_human,
 * and sends approve/reject buttons via WhatsApp.
 */
export async function createProposalAndNotify(params: ProposalParams): Promise<ToolResult> {
  const { ctx, taskId, agentName, agentIcon, agentKey, actionType, actionData, message, buttonLabel } = params;
  const supabase = getServiceClient();

  const { data: proposal } = await supabase
    .from("agent_proposals")
    .insert({
      user_id: ctx.userId,
      tenant_id: ctx.tenantId,
      agent_key: agentKey,
      action_type: actionType,
      action_data: actionData,
      message,
      status: "pending",
    })
    .select("id")
    .single();

  if (!proposal) return { result: "Öneri oluşturulamadı", needsApproval: false };

  await updateTaskStatus(taskId, "waiting_human", { pending_proposal_id: proposal.id });

  await sendButtons(
    ctx.phone,
    `${agentIcon} *${agentName}*\n\n${message}`,
    [
      { id: `agent_ok:${proposal.id}`, title: buttonLabel || "✅ Onayla" },
      { id: `agent_no:${proposal.id}`, title: "❌ Geç" },
    ],
  );

  return { result: `Onay bekleniyor: ${proposal.id}`, needsApproval: true };
}

/** Turkish Lira formatting */
export function formatCurrency(amount: number): string {
  return `₺${Number(amount).toLocaleString("tr-TR")}`;
}

/** Turkish date formatting */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
}

/** Turkish date+time formatting */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
}
