/**
 * UPU AI Agent V1 — Anthropic Tool + ToolContext type'ları.
 *
 * Her tool tenant-aware handler'ı sahip — ctx.tenantId/userId
 * server-side resolved (panel-auth + tenant-profile composite lookup).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ToolContext {
  sb: SupabaseClient;
  userId: string;       // profile.id (bayi tenant'taki)
  tenantId: string;
  displayName: string | null;
  role: string | null;  // admin/satis/muhasebe/depocu/user
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  /** UI'da onay isteği gerekli mi? true ise client iki aşamalı flow uygular. */
  requiresConfirmation?: boolean;
}

export type AnthropicMessage =
  | { role: "user"; content: string | unknown[] }
  | { role: "assistant"; content: string | unknown[] };
