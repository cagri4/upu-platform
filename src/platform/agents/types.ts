/**
 * Autonomous Agent Types — V2 (task-based, tool-using, memory-backed)
 */

// ── DB Row Types ───────────────────────────────────────────────────────

export interface AgentTask {
  id: string;
  user_id: string;
  tenant_id: string;
  agent_key: string;
  trigger_type: "cron" | "webhook" | "whatsapp" | "manual";
  trigger_event: Record<string, unknown>;
  status: "pending" | "thinking" | "acting" | "waiting_human" | "done" | "failed";
  current_step: number;
  max_steps: number;
  context: Record<string, unknown>;
  plan: StepLog[];
  execution_log: StepLog[];
  pending_proposal_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error: string | null;
}

export interface AgentMessage {
  id: string;
  user_id: string;
  tenant_id: string;
  agent_key: string;
  task_id: string | null;
  role: "system" | "assistant" | "user" | "tool_result";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface StepLog {
  step: number;
  action: string;
  input?: Record<string, unknown>;
  result?: string;
  status: "success" | "failed" | "waiting_human";
  timestamp: string;
}

// ── Agent Definition ───────────────────────────────────────────────────

export interface AgentContext {
  userId: string;
  tenantId: string;
  phone: string;
  userName: string;
}

export interface AgentProposal {
  actionType: string;
  message: string;
  actionData: Record<string, unknown>;
  priority: "high" | "medium" | "low";
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AgentAction {
  tool: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  result: string;
  needsApproval: boolean;
}

export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
) => Promise<ToolResult>;

export interface AgentDefinition {
  key: string;
  name: string;
  icon: string;
  gatherContext: (ctx: AgentContext) => Promise<Record<string, unknown>>;
  systemPrompt: string;
  formatPrompt: (data: Record<string, unknown>) => string;
  parseProposals: (aiResponse: string, data: Record<string, unknown>) => AgentProposal[];
  execute: (ctx: AgentContext, actionType: string, actionData: Record<string, unknown>) => Promise<string>;
  tools?: AgentToolDefinition[];
  toolHandlers?: Record<string, ToolHandler>;
}
