/**
 * Agent Engine V2 — task-based, tool-using, memory-backed
 *
 * runAgent(): creates task → runs cycle
 * handleAgentApproval(): resumes paused task on human response
 * runAllAgents(): iterates all agents for a user
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import type { AgentContext, AgentDefinition } from "./types";
import { createTask, getActiveTask, getTask, updateTaskStatus, logStep, saveMessage } from "./memory";
import { runAgentCycle } from "./cycle";

const MAX_DAILY_TASKS = 10;

// ── Run a single agent for a user ──────────────────────────────────────

export async function runAgent(
  agent: AgentDefinition,
  ctx: AgentContext,
  triggerType: "cron" | "webhook" | "whatsapp" | "manual" = "cron",
  triggerEvent: Record<string, unknown> = {},
): Promise<void> {
  const supabase = getServiceClient();

  // Check if agent is configured
  const { data: agentCfg } = await supabase
    .from("agent_config")
    .select("config, setup_completed")
    .eq("user_id", ctx.userId)
    .eq("agent_key", agent.key)
    .maybeSingle();

  if (!agentCfg?.setup_completed) return;

  // Check daily limit
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("agent_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("agent_key", agent.key)
    .gte("created_at", `${today}T00:00:00`);

  if ((count || 0) >= MAX_DAILY_TASKS) return;

  // Check for already active task
  const activeTask = await getActiveTask(ctx.userId, agent.key);
  if (activeTask) return; // Don't create new task if one is running

  // Create task and run cycle
  const task = await createTask(ctx.userId, ctx.tenantId, agent.key, triggerType, triggerEvent);

  try {
    await runAgentCycle(task, agent, ctx);
  } catch (err) {
    console.error(`[engine:${agent.key}] cycle error:`, err);
    await updateTaskStatus(task.id, "failed", { error: String(err) });
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

  // Find proposal
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

  // Update proposal status
  await supabase.from("agent_proposals")
    .update({ status: approved ? "approved" : "rejected", resolved_at: new Date().toISOString() })
    .eq("id", proposalId);

  // Find the task linked to this proposal
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("pending_proposal_id", proposalId)
    .eq("status", "waiting_human")
    .maybeSingle();

  if (!approved) {
    // Rejected — mark task as done
    if (task) {
      await logStep(task.id, task.current_step, "human_rejected", "User rejected proposal", "success");
      await updateTaskStatus(task.id, "done", { pending_proposal_id: null });
    }
    await sendButtons(ctx.phone, "Anlaşıldı, geçildi.", [
      { id: "cmd:menu", title: "📋 Ana Menü" },
    ]);
    return;
  }

  // Approved — execute the action
  const agent = agents[proposal.agent_key];

  if (task) {
    // Log approval
    await saveMessage(ctx.userId, ctx.tenantId, proposal.agent_key, task.id, "user", "Onaylandı");
    await logStep(task.id, task.current_step, "human_approved", "User approved", "success");

    // Clear pending proposal and resume
    await updateTaskStatus(task.id, "acting", { pending_proposal_id: null, current_step: task.current_step + 1 });

    // Execute the approved action
    const actionData = proposal.action_data as Record<string, unknown>;
    const actionType = proposal.action_type as string;

    try {
      let resultMsg = "✅ İşlem tamamlandı.";

      if (actionType === "create_reminder" && actionData.title) {
        await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: actionData.title,
          note: actionData.note || null,
          remind_at: actionData.remind_at,
          triggered: false,
        });
        resultMsg = `✅ Hatırlatma oluşturuldu: ${actionData.title}`;
      } else if (actionType === "send_whatsapp" && actionData.phone) {
        const { sendText: send } = await import("@/platform/whatsapp/send");
        await send(actionData.phone as string, actionData.message as string);
        resultMsg = `✅ Mesaj gönderildi.`;
      } else if (actionType.startsWith("db_") && actionData.table) {
        // DB write operations
        const table = actionData.table as string;
        const op = actionData.operation as string;
        if (op === "insert") {
          await supabase.from(table).insert(actionData.data || {});
          resultMsg = `✅ ${table} tablosuna kayıt eklendi.`;
        } else if (op === "update") {
          let q = supabase.from(table).update(actionData.data || {});
          const filters = actionData.filters as Record<string, unknown>;
          if (filters) for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
          await q;
          resultMsg = `✅ ${table} güncellendi.`;
        }
      } else if (agent) {
        // Fallback to agent's execute method
        resultMsg = await agent.execute(ctx, actionType, actionData);
      }

      await sendButtons(ctx.phone, resultMsg, [
        { id: "cmd:menu", title: "📋 Ana Menü" },
      ]);

      // Resume cycle if task has more steps
      const updatedTask = await getTask(task.id);
      if (updatedTask && updatedTask.status === "acting") {
        await runAgentCycle(updatedTask, agent, ctx);
      }
    } catch (err) {
      console.error(`[engine:approve] execute error:`, err);
      await updateTaskStatus(task.id, "failed", { error: String(err) });
      await sendText(ctx.phone, "İşlem sırasında hata oluştu.");
    }
  } else {
    // No task linked — legacy proposal, use agent.execute directly
    if (agent) {
      try {
        const result = await agent.execute(ctx, proposal.action_type, proposal.action_data as Record<string, unknown>);
        await sendButtons(ctx.phone, `✅ ${result}`, [{ id: "cmd:menu", title: "📋 Ana Menü" }]);
      } catch {
        await sendText(ctx.phone, "İşlem sırasında hata oluştu.");
      }
    }
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
      console.error(`[engine:${agent.key}] run error:`, err);
    }
  }
}
