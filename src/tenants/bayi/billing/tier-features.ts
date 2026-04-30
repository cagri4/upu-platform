/**
 * Bayi Tier Features — Starter / Growth / Pro paket farkları.
 *
 * Tier yapısı (Aşama 6, 2026-05-01 kararı):
 *   - Birincil eksen: çalışan sayısı (sert limit)
 *   - İkincil eksen: feature seti (boolean flag'ler)
 *   - Tavan: bayi sayısı + WA mesaj/ay (soft fair-use)
 *
 * Müşteriye satış mesajı: "3 kişiyiz → Starter, 5 kişiyiz + vade
 * gecikmesi var → Growth (SEPA Direct Debit), 15 kişiyiz + Belastingdienst
 * denetimi → Pro (Peppol + audit log)."
 */

export type BayiTier = "starter" | "growth" | "pro";

export interface TierFeatures {
  // Sert limitler (aşıldığında engel)
  employees: number | null;          // null = sınırsız

  // Yumuşak limitler (uyarı, engel yok — fair-use cron tarafından)
  dealersFairUse: number | null;
  waMessagesFairUseMonth: number | null;

  // Feature flag'ler (boolean)
  features: {
    multi_accounting: boolean;        // Yuki + Exact + SnelStart paralel
    sepa_direct_debit: boolean;       // Mollie mandate (otomatik vade çekim)
    position_presets: boolean;        // 8 pozisyon preset (sales_manager vb.)
    ai_dunning_text: boolean;         // Kişiselleştirilmiş tahsilat metni
    multi_territory: boolean;         // Bölge müdürü hiyerarşisi
    storecove_peppol: boolean;        // Peppol e-fatura
    custom_api: boolean;              // REST API erişimi
    custom_integrations: boolean;     // Logo NL / Mikro / özel entegrasyonlar
    audit_log: boolean;               // compliance/audit görüntüleme
  };

  // Destek SLA
  supportSla: "email" | "priority" | "dedicated";
  responseHours: number;
  conciergeSetupIncluded: boolean;
}

export const TIER_FEATURES: Record<BayiTier, TierFeatures> = {
  starter: {
    employees: 3,
    dealersFairUse: 50,
    waMessagesFairUseMonth: 1500,
    features: {
      multi_accounting: false,
      sepa_direct_debit: false,
      position_presets: false,
      ai_dunning_text: false,
      multi_territory: false,
      storecove_peppol: false,
      custom_api: false,
      custom_integrations: false,
      audit_log: false,
    },
    supportSla: "email",
    responseHours: 24,
    conciergeSetupIncluded: false,
  },
  growth: {
    employees: 10,
    dealersFairUse: 200,
    waMessagesFairUseMonth: 7500,
    features: {
      multi_accounting: true,
      sepa_direct_debit: true,
      position_presets: true,
      ai_dunning_text: true,
      multi_territory: false,
      storecove_peppol: false,
      custom_api: false,
      custom_integrations: false,
      audit_log: false,
    },
    supportSla: "priority",
    responseHours: 4,
    conciergeSetupIncluded: true,
  },
  pro: {
    employees: null,
    dealersFairUse: null,
    waMessagesFairUseMonth: null,
    features: {
      multi_accounting: true,
      sepa_direct_debit: true,
      position_presets: true,
      ai_dunning_text: true,
      multi_territory: true,
      storecove_peppol: true,
      custom_api: true,
      custom_integrations: true,
      audit_log: true,
    },
    supportSla: "dedicated",
    responseHours: 1,
    conciergeSetupIncluded: true,
  },
};

export type TierFeatureKey = keyof TierFeatures["features"];

/**
 * Feature minimum tier mapping — UI mesajlarında "Bu özellik X paketinde"
 * göstermek için.
 */
export const MIN_TIER_FOR_FEATURE: Record<TierFeatureKey, BayiTier> = {
  multi_accounting: "growth",
  sepa_direct_debit: "growth",
  position_presets: "growth",
  ai_dunning_text: "growth",
  multi_territory: "pro",
  storecove_peppol: "pro",
  custom_api: "pro",
  custom_integrations: "pro",
  audit_log: "pro",
};

/**
 * Owner profilinden mevcut tier'ı oku. Default "starter" — yeni
 * profillerde tier set edilmemişse free tier olarak başlar.
 */
import { getServiceClient } from "@/platform/auth/supabase";

export async function getUserTier(userId: string): Promise<BayiTier> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata, invited_by, role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return "starter";

  // Dealer/employee → ownership chain üzerinden owner tier'ı
  let lookupId = userId;
  if ((profile.role === "dealer" || profile.role === "employee") && profile.invited_by) {
    lookupId = profile.invited_by;
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("metadata")
      .eq("id", lookupId)
      .maybeSingle();
    const meta = (ownerProfile?.metadata || {}) as Record<string, unknown>;
    return (meta.tier as BayiTier) || "starter";
  }

  const meta = (profile.metadata || {}) as Record<string, unknown>;
  return (meta.tier as BayiTier) || "starter";
}

export function tierAllows(tier: BayiTier, feature: TierFeatureKey): boolean {
  return TIER_FEATURES[tier].features[feature] === true;
}

/**
 * Çalışan limit kontrolü — bayi-calisan-davet/save endpoint'inde quota
 * check için. Mevcut çalışan sayısı tier limitine ulaştıysa false döner;
 * upgrade tavsiyesi mesajını çağıran kod oluşturur.
 */
export async function canAddEmployee(ownerId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number | null;
  tier: BayiTier;
}> {
  const tier = await getUserTier(ownerId);
  const limit = TIER_FEATURES[tier].employees;
  if (limit === null) return { allowed: true, current: 0, limit: null, tier };

  const supabase = getServiceClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("invited_by", ownerId)
    .eq("role", "employee");
  const current = count || 0;
  return { allowed: current < limit, current, limit, tier };
}
