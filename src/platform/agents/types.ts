/**
 * Autonomous Agent Types
 *
 * Each virtual employee is an agent that:
 *   1. Gathers context (DB queries)
 *   2. Evaluates situation (Claude API)
 *   3. Proposes actions (WhatsApp buttons)
 *   4. Executes on approval
 */

export interface AgentContext {
  userId: string;
  tenantId: string;
  phone: string;
  userName: string;
}

export interface AgentProposal {
  actionType: string;
  message: string;           // WhatsApp'ta gösterilecek mesaj
  actionData: Record<string, unknown>;  // Execute için gereken veri
  priority: "high" | "medium" | "low";
}

export interface AgentDefinition {
  key: string;
  name: string;
  icon: string;
  /** DB'den bu agent'ın alanındaki veriyi toplar */
  gatherContext: (ctx: AgentContext) => Promise<Record<string, unknown>>;
  /** Claude'a gönderilecek system prompt */
  systemPrompt: string;
  /** Toplanan veriyi Claude'a gönderilecek user mesajına çevirir */
  formatPrompt: (data: Record<string, unknown>) => string;
  /** Claude yanıtından proposal parse eder */
  parseProposals: (aiResponse: string, data: Record<string, unknown>) => AgentProposal[];
  /** Onaylanan aksiyonu çalıştırır */
  execute: (ctx: AgentContext, actionType: string, actionData: Record<string, unknown>) => Promise<string>;
}
