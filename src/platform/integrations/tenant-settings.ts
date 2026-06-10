/**
 * tenant_integration_settings DB helper'ları — Faz 3.
 *
 * Provider config + secrets okuma/yazma. Adapter'lar bu modülü çağırıp
 * runtime'da credential'ları alır (env yerine).
 *
 * RLS kapalı çağrı için service_role client kullanılır — secrets only
 * service-side path'lerden erişilir, API GET response'ında redact edilir.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface IntegrationSettingRow {
  id: string;
  tenantId: string;
  provider: string;
  isActive: boolean;
  config: Record<string, unknown>;
  secrets: Record<string, unknown>;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getIntegrationSetting(
  sb: SupabaseClient,
  tenantId: string,
  provider: string,
): Promise<IntegrationSettingRow | null> {
  const { data, error } = await sb
    .from("tenant_integration_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    console.error("[integrations:get]", error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    provider: data.provider as string,
    isActive: Boolean(data.is_active),
    config: (data.config as Record<string, unknown>) || {},
    secrets: (data.secrets as Record<string, unknown>) || {},
    lastSyncedAt: (data.last_synced_at as string) || null,
    lastSyncStatus: (data.last_sync_status as string) || null,
    lastSyncError: (data.last_sync_error as string) || null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export async function listIntegrationSettings(
  sb: SupabaseClient,
  tenantId: string,
): Promise<IntegrationSettingRow[]> {
  const { data } = await sb
    .from("tenant_integration_settings")
    .select("*")
    .eq("tenant_id", tenantId);

  return (data ?? []).map((d) => ({
    id: d.id as string,
    tenantId: d.tenant_id as string,
    provider: d.provider as string,
    isActive: Boolean(d.is_active),
    config: (d.config as Record<string, unknown>) || {},
    secrets: (d.secrets as Record<string, unknown>) || {},
    lastSyncedAt: (d.last_synced_at as string) || null,
    lastSyncStatus: (d.last_sync_status as string) || null,
    lastSyncError: (d.last_sync_error as string) || null,
    createdAt: d.created_at as string,
    updatedAt: d.updated_at as string,
  }));
}

interface UpsertArgs {
  tenantId: string;
  provider: string;
  isActive?: boolean;
  config?: Record<string, unknown>;
  /**
   * Sensitive credentials. Partial update: yeni gönderilenler eskiye
   * MERGE edilir; bir alan boş string gelirse silinmez (UI redact'lı
   * gösterdiği için kullanıcı tekrar girmek zorunda kalmasın).
   * Açıkça silmek için null gönderilir.
   */
  secretsPatch?: Record<string, string | null>;
}

export async function upsertIntegrationSetting(
  sb: SupabaseClient,
  args: UpsertArgs,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await getIntegrationSetting(sb, args.tenantId, args.provider);

  let nextSecrets: Record<string, unknown> = existing?.secrets || {};
  if (args.secretsPatch) {
    nextSecrets = { ...nextSecrets };
    for (const [k, v] of Object.entries(args.secretsPatch)) {
      if (v === null) {
        delete nextSecrets[k];
      } else if (v !== "" && v != null) {
        nextSecrets[k] = v;
      }
      // boş string → değişiklik yok (kullanıcı placeholder gördü)
    }
  }

  const payload: Record<string, unknown> = {
    tenant_id: args.tenantId,
    provider: args.provider,
    is_active: args.isActive ?? existing?.isActive ?? false,
    config: args.config ?? existing?.config ?? {},
    secrets: nextSecrets,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb
    .from("tenant_integration_settings")
    .upsert(payload, { onConflict: "tenant_id,provider" });

  if (error) {
    console.error("[integrations:upsert]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function recordSyncResult(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    provider: string;
    status: "ok" | "error";
    errorMessage?: string;
  },
): Promise<void> {
  await sb
    .from("tenant_integration_settings")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: args.status,
      last_sync_error: args.status === "error" ? args.errorMessage ?? null : null,
    })
    .eq("tenant_id", args.tenantId)
    .eq("provider", args.provider);
}
