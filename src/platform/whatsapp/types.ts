/**
 * Shared types for WhatsApp command handlers
 */

export type UserRole = "admin" | "employee" | "dealer" | "system" | "user";

export interface WaContext {
  phone: string;
  userId: string;
  tenantId: string;
  tenantKey: string;
  userName: string;
  locale: string;
  messageId: string;
  text: string;
  interactiveId: string;
  role: UserRole;
  permissions: Record<string, unknown>;
  dealerId: string | null;
  /**
   * Capability strings from profiles.capabilities. Post-pivot menu
   * filtering and command dispatch read from here. Wildcard "*" grants
   * every capability (owner default).
   */
  capabilities: string[];
}

export type CommandHandler = (ctx: WaContext) => Promise<void>;
export type StepHandler = (ctx: WaContext, session: import("./session").CommandSession) => Promise<void>;
export type CallbackHandler = (ctx: WaContext, callbackData: string) => Promise<void>;

export interface TenantCommandRegistry {
  commands: Record<string, CommandHandler>;
  stepHandlers: Record<string, StepHandler>;
  callbackPrefixes: Record<string, CallbackHandler>;
  aliases: Record<string, string>;
  /**
   * Per-command capability requirement. Menu/dispatch consults this map
   * (if provided) before showing or executing a command. Omit the key —
   * or set to null — for commands anyone can run (menu, help, profile).
   * A single string means "the user needs exactly this capability". An
   * array means "any one of these". "*" wildcard in the user's own
   * capability set grants everything automatically (owner default).
   */
  requiredCapabilities?: Record<string, string | string[] | null>;
}
