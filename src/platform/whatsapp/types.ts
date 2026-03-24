/**
 * Shared types for WhatsApp command handlers
 */

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
}

export type CommandHandler = (ctx: WaContext) => Promise<void>;
export type StepHandler = (ctx: WaContext, session: import("./session").CommandSession) => Promise<void>;
export type CallbackHandler = (ctx: WaContext, callbackData: string) => Promise<void>;

export interface TenantCommandRegistry {
  commands: Record<string, CommandHandler>;
  stepHandlers: Record<string, StepHandler>;
  callbackPrefixes: Record<string, CallbackHandler>;
  aliases: Record<string, string>;
}
