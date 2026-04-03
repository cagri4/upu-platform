/**
 * Agent Memory Layer — task lifecycle, message history, step logging
 */

import { getServiceClient } from "@/platform/auth/supabase";
import type { AgentTask, AgentMessage, StepLog } from "./types";

// ── Task Management ────────────────────────────────────────────────────

export async function createTask(
  userId: string,
  tenantId: string,
  agentKey: string,
  triggerType: AgentTask["trigger_type"],
  triggerEvent: Record<string, unknown> = {},
): Promise<AgentTask> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      agent_key: agentKey,
      trigger_type: triggerType,
      trigger_event: triggerEvent,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(`createTask failed: ${error?.message}`);
  return data as AgentTask;
}

export async function updateTaskStatus(
  taskId: string,
  status: AgentTask["status"],
  updates?: Partial<Pick<AgentTask, "context" | "plan" | "execution_log" | "current_step" | "pending_proposal_id" | "error">>,
): Promise<void> {
  const supabase = getServiceClient();
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...updates,
  };
  if (status === "done" || status === "failed") {
    payload.completed_at = new Date().toISOString();
  }
  await supabase.from("agent_tasks").update(payload).eq("id", taskId);
}

export async function getActiveTask(userId: string, agentKey: string): Promise<AgentTask | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_key", agentKey)
    .not("status", "in", '("done","failed")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AgentTask) || null;
}

export async function getTask(taskId: string): Promise<AgentTask | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  return (data as AgentTask) || null;
}

// ── Step Logging ───────────────────────────────────────────────────────

export async function logStep(
  taskId: string,
  step: number,
  action: string,
  result: string,
  status: StepLog["status"],
  input?: Record<string, unknown>,
): Promise<void> {
  const supabase = getServiceClient();
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("execution_log")
    .eq("id", taskId)
    .single();

  const log = (task?.execution_log as StepLog[]) || [];
  log.push({ step, action, input, result, status, timestamp: new Date().toISOString() });

  await supabase.from("agent_tasks").update({
    execution_log: log,
    current_step: step,
    updated_at: new Date().toISOString(),
  }).eq("id", taskId);
}

// ── Message History ────────────────────────────────────────────────────

export async function saveMessage(
  userId: string,
  tenantId: string,
  agentKey: string,
  taskId: string | null,
  role: AgentMessage["role"],
  content: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("agent_messages").insert({
    user_id: userId,
    tenant_id: tenantId,
    agent_key: agentKey,
    task_id: taskId,
    role,
    content,
    metadata: metadata || {},
  });
}

export async function getRecentMessages(
  userId: string,
  agentKey: string,
  limit = 20,
): Promise<AgentMessage[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_key", agentKey)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data as AgentMessage[]) || []).reverse();
}

export async function getTaskHistory(
  userId: string,
  agentKey: string,
  limit = 5,
): Promise<AgentTask[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_key", agentKey)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as AgentTask[]) || [];
}

// ── Agent Learnings ───────────────────────────────────────────────────

export interface AgentLearning {
  id: string;
  agent_key: string;
  user_id: string;
  tenant_id: string | null;
  learning: string;
  category: string;
  confidence: number;
  source_task_id: string | null;
  created_at: string;
}

export async function getLearnings(
  userId: string,
  agentKey: string,
  limit = 20,
): Promise<AgentLearning[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("agent_learnings")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_key", agentKey)
    .order("confidence", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as AgentLearning[]) || [];
}

export async function saveLearning(
  userId: string,
  tenantId: string,
  agentKey: string,
  learning: string,
  category = "general",
  confidence = 0.5,
  sourceTaskId?: string,
): Promise<void> {
  const supabase = getServiceClient();
  // Check for duplicate/similar learning
  const { data: existing } = await supabase
    .from("agent_learnings")
    .select("id, confidence")
    .eq("user_id", userId)
    .eq("agent_key", agentKey)
    .eq("learning", learning)
    .limit(1);

  if (existing?.length) {
    // Increase confidence of existing learning
    const newConf = Math.min((existing[0].confidence || 0.5) + 0.1, 1.0);
    await supabase
      .from("agent_learnings")
      .update({ confidence: newConf, updated_at: new Date().toISOString() })
      .eq("id", existing[0].id);
  } else {
    await supabase.from("agent_learnings").insert({
      user_id: userId,
      tenant_id: tenantId,
      agent_key: agentKey,
      learning,
      category,
      confidence,
      source_task_id: sourceTaskId || null,
    });
  }
}
