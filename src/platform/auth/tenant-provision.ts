/**
 * Tenant provision — yeni signup için `tenants` satırı yaratır.
 *
 * Multi-tenant izolasyon kararı (2026-06-01): UPU Dev'in tenants/config.ts
 * tenantId'leri DEMO tenant'lar olarak kalır (5 May seed verisini içerir).
 * Yeni signup yapan her kullanıcı KENDİ tenants satırına bağlanır →
 * dashboard'lar boş açılır, demo verisi sızmaz.
 *
 * Helper iki yerde kullanılır:
 *   - WhatsApp organic-signup (runTenantSignup)
 *   - Web /api/auth/otp/verify signup branch
 *
 * Şema (tenants tablosu):
 *   id, name, slug (unique), saas_type, plan, is_active, settings,
 *   trial_ends_at, created_at, updated_at
 * (whatsapp_phone YOK — tenants tablosunda kolon mevcut değil)
 */
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTenantByKey } from "@/tenants/config";

const SUFFIX_BY_SAAS_TYPE: Record<string, string> = {
  bayi: "Bayisi",
  emlak: "Emlak Ofisi",
  market: "Marketi",
  otel: "Oteli",
  restoran: "Restoranı",
  siteyonetim: "Site Yönetimi",
  muhasebe: "Muhasebesi",
};

function suffixForSaasType(saasType: string): string {
  return SUFFIX_BY_SAAS_TYPE[saasType] ?? "Hesabı";
}

export interface CreateTenantInput {
  /** Profile sahibinin display_name'i. Tenant adında prefix olarak kullanılır. */
  ownerName: string;
  /** Tenant config key (bayi, emlak, ...). saas_type ve slug prefix'i bundan. */
  tenantKey: string;
}

export type CreateTenantResult =
  | { ok: true; tenantId: string; slug: string; name: string }
  | { ok: false; error: string };

/**
 * Yeni tenants satırı INSERT eder. Slug `${cfg.slug}-${random-8}` formatında
 * unique; collision olursa 23505 dönüp caller retry yapabilir (şu an retry
 * yok — random çakışma pratikte olmaz).
 */
export async function createTenantForSignup(
  sb: SupabaseClient,
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  const cfg = getTenantByKey(input.tenantKey);
  if (!cfg) return { ok: false, error: `tenant_config_missing:${input.tenantKey}` };

  const suffix = suffixForSaasType(cfg.saasType);
  const trimmedName = (input.ownerName || "").trim();
  const tenantName = trimmedName ? `${trimmedName} ${suffix}` : suffix;
  const slug = `${cfg.slug}-${randomUUID().slice(0, 8)}`;

  const { data, error } = await sb
    .from("tenants")
    .insert({
      name: tenantName,
      slug,
      saas_type: cfg.saasType,
      plan: "trial",
      is_active: true,
    })
    .select("id, slug, name")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "tenant_insert_failed" };
  }
  return { ok: true, tenantId: data.id as string, slug: data.slug as string, name: data.name as string };
}
