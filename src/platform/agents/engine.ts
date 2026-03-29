/**
 * Agent Engine — runs autonomous agents, manages proposals, handles approvals
 *
 * Flow:
 *   runAgent(agent, ctx) → gather → evaluate (Claude) → propose (WhatsApp) → wait
 *   handleApproval(proposalId) → execute → notify
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import type { AgentContext, AgentDefinition, AgentProposal } from "./types";

const MAX_PROPOSALS_PER_RUN = 3;
const MAX_DAILY_PROPOSALS = 10;

// ── Run a single agent for a user ──────────────────────────────────────

export async function runAgent(agent: AgentDefinition, ctx: AgentContext): Promise<void> {
  const supabase = getServiceClient();

  // Check daily limit
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("agent_proposals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("agent_key", agent.key)
    .gte("created_at", `${today}T00:00:00`);

  if ((count || 0) >= MAX_DAILY_PROPOSALS) return;

  // Check for pending proposals — don't spam if user hasn't responded
  const { count: pending } = await supabase
    .from("agent_proposals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("agent_key", agent.key)
    .eq("status", "pending");

  if ((pending || 0) >= 2) return;

  // 1. Gather context
  let data: Record<string, unknown>;
  try {
    data = await agent.gatherContext(ctx);
  } catch (err) {
    console.error(`[agent:${agent.key}] gather error:`, err);
    return;
  }

  // 2. Evaluate with Claude
  let aiResponse = "";
  try {
    const { askClaude } = await import("@/platform/ai/claude");
    const userPrompt = agent.formatPrompt(data);
    if (!userPrompt) return; // No data to evaluate
    aiResponse = await askClaude(agent.systemPrompt, userPrompt, 1024);
  } catch (err) {
    console.error(`[agent:${agent.key}] claude error:`, err);
    return;
  }

  if (!aiResponse) return;

  // 3. Parse proposals
  let proposals: AgentProposal[];
  try {
    proposals = agent.parseProposals(aiResponse, data);
  } catch {
    proposals = [];
  }

  if (proposals.length === 0) return;

  // Limit proposals per run
  const toSend = proposals.slice(0, MAX_PROPOSALS_PER_RUN);

  // 4. Save proposals and send to user
  for (const proposal of toSend) {
    const { data: saved } = await supabase
      .from("agent_proposals")
      .insert({
        user_id: ctx.userId,
        tenant_id: ctx.tenantId,
        agent_key: agent.key,
        action_type: proposal.actionType,
        action_data: proposal.actionData,
        message: proposal.message,
        status: "pending",
      })
      .select("id")
      .single();

    if (!saved) continue;

    await sendButtons(
      ctx.phone,
      `${agent.icon} *${agent.name}*\n\n${proposal.message}`,
      [
        { id: `agent_ok:${saved.id}`, title: "✅ Onayla" },
        { id: `agent_no:${saved.id}`, title: "❌ Geç" },
      ],
    );
  }
}

// ── Handle approval/rejection callback ─────────────────────────────────

export async function handleAgentApproval(
  ctx: AgentContext,
  proposalId: string,
  approved: boolean,
  agents: Record<string, AgentDefinition>,
): Promise<void> {
  const supabase = getServiceClient();

  const { data: proposal } = await supabase
    .from("agent_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("status", "pending")
    .single();

  if (!proposal) {
    await sendText(ctx.phone, "Bu öneri artık geçerli değil.");
    return;
  }

  if (!approved) {
    await supabase.from("agent_proposals")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", proposalId);
    await sendButtons(ctx.phone, "Anlaşıldı, geçildi.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  // Execute the action
  const agent = agents[proposal.agent_key];
  if (!agent) {
    await sendText(ctx.phone, "Bu eleman tanımlı değil.");
    return;
  }

  try {
    const result = await agent.execute(
      ctx,
      proposal.action_type,
      proposal.action_data as Record<string, unknown>,
    );

    await supabase.from("agent_proposals")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", proposalId);

    await sendButtons(ctx.phone, `✅ ${result}`, [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    console.error(`[agent:${proposal.agent_key}] execute error:`, err);
    await sendText(ctx.phone, "İşlem sırasında hata oluştu. Lütfen tekrar deneyin.");
  }
}

// ── Run all agents for a user ──────────────────────────────────────────

export async function runAllAgents(
  agents: Record<string, AgentDefinition>,
  ctx: AgentContext,
): Promise<void> {
  for (const agent of Object.values(agents)) {
    try {
      await runAgent(agent, ctx);
    } catch (err) {
      console.error(`[agent:${agent.key}] run error:`, err);
    }
  }
}
