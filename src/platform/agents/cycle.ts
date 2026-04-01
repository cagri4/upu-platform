/**
 * Agent Cycle — the core perception → thinking → acting → observing loop
 *
 * Each cycle:
 *   1. PERCEIVE: gather context + memory
 *   2. THINK: Claude decides what to do (tool_use)
 *   3. ACT: execute the chosen tool
 *   4. OBSERVE: log result, evaluate
 *   5. DECIDE: continue / waiting_human / done
 */

import type { AgentTask, AgentContext, AgentDefinition } from "./types";
import { updateTaskStatus, logStep, saveMessage, getRecentMessages } from "./memory";
import { executeTool, PLATFORM_TOOLS } from "./tools";

export async function runAgentCycle(
  task: AgentTask,
  agent: AgentDefinition,
  ctx: AgentContext,
): Promise<void> {
  const maxSteps = task.max_steps || 10;

  for (let step = task.current_step; step < maxSteps; step++) {
    // Update status
    await updateTaskStatus(task.id, "thinking", { current_step: step });

    // ── 1. PERCEIVE ──────────────────────────────────────────────────
    let domainContext: Record<string, unknown> = {};
    try {
      domainContext = await agent.gatherContext(ctx);
    } catch (err) {
      console.error(`[cycle:${agent.key}] gather error:`, err);
    }

    const recentMessages = await getRecentMessages(ctx.userId, agent.key, 20);
    const history = recentMessages.map(m => `[${m.role}] ${m.content}`).join("\n");

    // ── 2. THINK ─────────────────────────────────────────────────────
    const userPrompt = agent.formatPrompt(domainContext);
    if (!userPrompt) {
      await updateTaskStatus(task.id, "done");
      return;
    }

    const systemPrompt = buildSystemPrompt(agent, task, history);

    let toolCall: { name: string; input: Record<string, unknown> } | null = null;
    let textResponse = "";

    try {
      const { askClaudeWithTools } = await import("@/platform/ai/claude");
      const result = await askClaudeWithTools(
        systemPrompt,
        userPrompt,
        [...PLATFORM_TOOLS, ...(agent.tools || [])],
      );
      toolCall = result.toolCall;
      textResponse = result.text;
    } catch (err) {
      console.error(`[cycle:${agent.key}] Claude error:`, err);
      await logStep(task.id, step, "think_error", String(err), "failed");
      await updateTaskStatus(task.id, "failed", { error: String(err) });
      return;
    }

    // Save assistant message
    await saveMessage(ctx.userId, ctx.tenantId, agent.key, task.id, "assistant", textResponse || "(tool call)");

    // ── 3. ACT ───────────────────────────────────────────────────────
    if (toolCall) {
      await updateTaskStatus(task.id, "acting");

      const { result, needsApproval } = await executeTool(
        toolCall.name,
        toolCall.input,
        ctx,
        task.id,
        agent.name,
        agent.icon,
      );

      // Save tool result
      await saveMessage(ctx.userId, ctx.tenantId, agent.key, task.id, "tool_result", result);
      await logStep(task.id, step, toolCall.name, result, needsApproval ? "waiting_human" : "success", toolCall.input);

      // ── 4. OBSERVE ─────────────────────────────────────────────────
      if (needsApproval) {
        // Task paused — will resume when human approves/rejects
        return;
      }

      // Continue to next step
      continue;
    }

    // ── 5. DECIDE — no tool call = agent is done thinking ────────────
    if (textResponse) {
      await logStep(task.id, step, "conclude", textResponse, "success");
    }
    await updateTaskStatus(task.id, "done");
    return;
  }

  // Max steps reached
  await updateTaskStatus(task.id, "done", { error: "max_steps_reached" });
}

// ── System Prompt Builder ──────────────────────────────────────────────

function buildSystemPrompt(agent: AgentDefinition, task: AgentTask, history: string): string {
  let prompt = agent.systemPrompt + "\n\n";
  prompt += "## Kurallar\n";
  prompt += "- Kullanıcıya direkt mesaj GÖNDERME. notify_human tool'u kullan.\n";
  prompt += "- Veritabanına direkt YAZMA. write_db tool'u kullan (onay gerektirir).\n";
  prompt += "- read_db ile veri okuyabilirsin (onaysız).\n";
  prompt += "- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir özet yaz.\n";
  prompt += "- Türkçe yanıt ver.\n\n";

  if (history) {
    prompt += "## Son Mesajlar\n" + history + "\n\n";
  }

  if (task.execution_log && (task.execution_log as unknown[]).length > 0) {
    prompt += "## Bu Görevdeki Adımlar\n";
    for (const log of task.execution_log as Array<{ action: string; result?: string; status: string }>) {
      prompt += `- ${log.action}: ${log.status}${log.result ? " → " + log.result.substring(0, 100) : ""}\n`;
    }
  }

  return prompt;
}
