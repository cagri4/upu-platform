/**
 * Multi-tenant helper'ları — runtime tenants ile çalışan sorgular için.
 *
 * Config (src/tenants/config.ts) sadece DEMO tenantId'leri tutar; her signup
 * yeni tenants satırı yaratır (#100). `.eq("tenant_id", cfg.tenantId)` filter'ı
 * runtime tenant'ları atlar. Yerine `saas_type` üzerinden tüm tenant id'leri
 * çek + `.in("tenant_id", ids)` kullan.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Belirli bir saas_type'a ait tüm tenant id'lerini döner (DEMO + signup'lar).
 * Boş array → o saas_type altında hiç tenant yok.
 */
export async function getAllTenantIdsForSaas(
  sb: SupabaseClient,
  saasType: string,
): Promise<string[]> {
  const { data, error } = await sb.from("tenants").select("id").eq("saas_type", saasType);
  if (error) {
    console.error("[getAllTenantIdsForSaas]", saasType, error);
    return [];
  }
  return (data ?? []).map((t) => t.id as string);
}
