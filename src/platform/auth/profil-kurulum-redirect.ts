/**
 * Signup (OTP verify) sonrası profil tamamlama redirect helper'ı.
 *
 * Multi-tenant izolasyon kritik bug fix (2026-06-05): OTP verify
 * tüm SaaS'ları emlak-spesifik `/profil-kurulum` sayfasına yönlendiriyordu.
 * Bu helper tenant.key'e göre doğru sayfaya yönlendirir.
 *
 * Eşleme stratejisi:
 *   - Shell-free dedicated page varsa onu kullan (emlak/bayi/restoran)
 *   - Diğerleri için minimal generic `profil-kurulum-mini` (yalnız
 *     display_name + email + briefing — emlak-spesifik field yok)
 *
 * Market/otel/site dedicated sayfaları PANEL ROUTE GROUP içinde (sidebar
 * + nav + role guard); fresh signup'a uygun değil. O yüzden mini'ye
 * yönlendiriliyor; user onboarding'i tamamladıktan sonra panel'e geçer.
 *
 * Yeni SaaS eklenince bu switch'i ve checklist'i güncelle
 * (memory'deki "Yeni SaaS ekleme checklist'i" kaydına bak).
 */

import { getTenantByKey } from "@/tenants/config";

const MINI = "profil-kurulum-mini";

/**
 * tenant.key → relatif redirect path (locale prefix dışında).
 * Bilinmeyen key → mini (güvenli default).
 */
function pathSegmentForTenantKey(tenantKey: string): string {
  switch (tenantKey) {
    case "emlak":
      // /[locale]/profil-kurulum — (emlak) route group içinde, URL aynı
      return "profil-kurulum";
    case "bayi":
      return "bayi-profil";
    case "restoran":
      return "restoran-profil";
    case "market":
    case "otel":
    case "siteyonetim":
    case "muhasebe":
      return MINI;
    default:
      console.warn(`[profilKurulumRedirectFor] bilinmeyen tenantKey="${tenantKey}", mini'ye yönlendiriliyor`);
      return MINI;
  }
}

/**
 * Locale + tenant.key → tam redirect URL.
 *
 * Caller: src/app/api/auth/otp/verify/route.ts post-signup branch.
 */
export function profilKurulumRedirectFor(tenantKey: string, locale: string): string {
  // Config'de tenantKey gerçekten var mı doğrula — silent guard.
  if (!getTenantByKey(tenantKey)) {
    console.warn(`[profilKurulumRedirectFor] geçersiz tenantKey="${tenantKey}", config'de yok`);
  }
  const safeLocale = locale && /^[a-z]{2}$/i.test(locale) ? locale : "tr";
  const segment = pathSegmentForTenantKey(tenantKey);
  return `/${safeLocale}/${segment}`;
}
