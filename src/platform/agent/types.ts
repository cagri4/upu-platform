/**
 * UPU AI Agent V1 — Anthropic Tool + ToolContext type'ları.
 *
 * Her tool tenant-aware handler'ı sahip — ctx.tenantId/userId/tenantKey
 * server-side resolved (panel-auth + tenant-profile composite lookup).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantKey = "bayi" | "emlak";

export interface ToolContext {
  sb: SupabaseClient;
  userId: string;       // profile.id (resolved tenant'taki)
  tenantId: string;
  tenantKey: TenantKey; // resolved tenant key — assertTenant defense katmanı
  displayName: string | null;
  role: string | null;  // admin/satis/muhasebe/depocu/user
}

export interface ToolDef {
  name: string;
  description: string;
  /** Tool yalnız bu tenant'ta callable. Handler içi assertTenant runtime guard;
   *  Bu alan doc + catalog filtering için. */
  expectedTenantKey?: TenantKey;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  /** UI'da onay isteği gerekli mi? true ise client iki aşamalı flow uygular. */
  requiresConfirmation?: boolean;
}

/**
 * Defense-in-depth: tool handler'ı yanlış tenant'ta çalıştırılırsa fırlatır.
 * Catalog filtering + endpoint strict resolve dışında 3. güvenlik katmanı —
 * geliştirme sırasında bir tool yanlış catalog'a sokulsa bile bu assert
 * cross-tenant query'yi engeller (data sızıntısı yok).
 */
export class TenantMismatchError extends Error {
  constructor(toolName: string, expected: TenantKey, actual: string) {
    super(`Tool '${toolName}' '${expected}' tenant'ında çalışır, çağrı tenant'ı: '${actual}'.`);
    this.name = "TenantMismatchError";
  }
}

export function assertTenant(ctx: ToolContext, expected: TenantKey, toolName: string): void {
  if (ctx.tenantKey !== expected) {
    throw new TenantMismatchError(toolName, expected, ctx.tenantKey);
  }
}

export type AnthropicMessage =
  | { role: "user"; content: string | unknown[] }
  | { role: "assistant"; content: string | unknown[] };
