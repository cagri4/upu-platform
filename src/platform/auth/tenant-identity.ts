/**
 * Multi-tenant identity helpers — Sprint Foundation (2026-05-14).
 *
 * Aynı whatsapp_phone'un birden fazla tenant'ta profile sahibi olabilmesi
 * için lookup tarafını sarmalayan helper. Feature flag (TENANT_AWARE_IDENTITY)
 * KAPALI iken mevcut davranış birebir korunur — sadece tek değişiklik
 * helper'a refactor (side-effect yok).
 *
 * Flag AÇIK iken: mesaj içeriği tenant hint olarak kullanılır (örn.
 * "BAYI: Üye olmak istiyorum" → bayi tenant'a yönelir; mevcut BAYI:CODE
 * alfa-numerik invite pattern'i DOKUNULMAZ — o zaten erken işlenir).
 *
 * Resolution priority chain:
 *   1) (flag on only) Mesaj prefix hint: BAYI:/MARKET:/OTEL:/RESTORAN:/SITEYONETIM:
 *   2) saas_active_session.active_saas_key (degistir komutuyla set edilir)
 *   3) En yeni profile'ın tenant'ı (allProfiles[0], created_at DESC)
 *
 * Profile seç:
 *   - Resolved tenantKey'in profile'ı varsa onu seç
 *   - Yoksa allProfiles[0] (en yeni)
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProfileRow {
  id: string;
  tenant_id: string | null;
  display_name: string | null;
  preferred_locale: string | null;
  role: string | null;
  permissions: Record<string, unknown> | null;
  dealer_id: string | null;
  capabilities?: string[];
}

export interface ActiveSessionRow {
  active_saas_key: string | null;
  view_as_role: string | null;
}

export interface TenantContext {
  tenantKey: string;
  selectedProfile: ProfileRow;
  allProfiles: ProfileRow[];
  activeSession: ActiveSessionRow | null;
}

/** Feature flag — Vercel ENV'de TENANT_AWARE_IDENTITY=true ile açılır. */
export function isTenantAwareIdentityEnabled(): boolean {
  return process.env.TENANT_AWARE_IDENTITY === "true";
}

/**
 * Mesaj prefix'inden tenant key tahmin et. Sadece "TENANT: " (büyük harf
 * + iki nokta + boşluk) pattern'i ile başlayan mesajları yakalar — mevcut
 * "BAYI:CODE" alfa-numerik invite akışıyla çakışmaz (o pattern boşluksuz
 * ve özel olarak whatsapp/route.ts:200+ erken kontrol edilir).
 *
 * Tanınan tenant key'leri: emlak, bayi, market, otel, restoran, siteyonetim,
 * muhasebe.
 *
 * Null dönerse hint yok demek; caller bir sonraki priority'ye geçer.
 */
export function extractTenantHintFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.trim().match(/^(BAYI|EMLAK|MARKET|OTEL|RESTORAN|SITEYONETIM|MUHASEBE):\s+/i);
  if (!m) return null;
  return m[1].toLowerCase();
}

/**
 * Tenant hint prefix'i mesaj metninden temizler. extractTenantHintFromText
 * ile aynı pattern'i kullanır. Webhook ctx.text inşa edilirken çağrılır
 * ki command match (örn. "Üye olmak istiyorum") prefix'siz işlesin.
 *
 * "BAYI:CODE..." gibi boşluksuz alfa-numerik invite kodlarına DOKUNMAZ
 * (regex `\s+` zorunlu — bunlar webhook'un erken BAYI:CODE bloğunda
 * zaten yakalanmış olur).
 */
export function stripTenantPrefix(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/^(BAYI|EMLAK|MARKET|OTEL|RESTORAN|SITEYONETIM|MUHASEBE):\s+/i, "");
}

/**
 * Phone'un profile'larını + aktif session'ı çek, tenant context'i belirle,
 * doğru profile'ı seç. Hiç profile yoksa null döner — caller "davet kodu
 * varsa gönder" mesajı atar.
 */
export async function resolveTenantContext(
  supabase: SupabaseClient,
  phone: string,
  text: string | null | undefined,
): Promise<TenantContext | null> {
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, tenant_id, display_name, preferred_locale, role, permissions, dealer_id, capabilities")
    .eq("whatsapp_phone", phone)
    .order("created_at", { ascending: false });

  if (!allProfiles?.length) return null;

  const { data: activeSession } = await supabase
    .from("saas_active_session")
    .select("active_saas_key, view_as_role")
    .eq("phone", phone)
    .maybeSingle();

  const flagOn = isTenantAwareIdentityEnabled();

  // Priority 1: prefix hint (flag-gated)
  let tenantKey: string | null = null;
  if (flagOn) {
    const hint = extractTenantHintFromText(text);
    if (hint) {
      // Hint only counts if phone has a profile in that tenant — aksi
      // takdirde "yeni üye?" yolu (caller orphan-aware davranır).
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("id")
        .eq("saas_type", hint)
        .maybeSingle();
      if (tenantRow && allProfiles.some((p) => p.tenant_id === tenantRow.id)) {
        tenantKey = hint;
      }
    }
  }

  // Priority 2: active session
  if (!tenantKey && activeSession?.active_saas_key) {
    tenantKey = activeSession.active_saas_key;
  }

  // Priority 3: en yeni profile'ın tenant'ı (mevcut davranış)
  if (!tenantKey && allProfiles[0].tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("saas_type")
      .eq("id", allProfiles[0].tenant_id)
      .maybeSingle();
    if (tenant?.saas_type) tenantKey = tenant.saas_type;
  }

  // Fallback (kayıtlı profile var ama tenant resolve edilemedi)
  if (!tenantKey) tenantKey = "emlak";

  // Profile seç — resolved tenant'a uyan profile veya allProfiles[0]
  let selectedProfile: ProfileRow = allProfiles[0] as ProfileRow;
  if (allProfiles.length > 1) {
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("id")
      .eq("saas_type", tenantKey)
      .maybeSingle();
    if (tenantRow) {
      const match = allProfiles.find((p) => p.tenant_id === tenantRow.id);
      if (match) selectedProfile = match as ProfileRow;
    }
  }

  return {
    tenantKey,
    selectedProfile,
    allProfiles: allProfiles as ProfileRow[],
    activeSession: activeSession as ActiveSessionRow | null,
  };
}
