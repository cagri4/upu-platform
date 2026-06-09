/**
 * Bayi tenant feature flag tanımları.
 *
 * Faz 0 temizliği (.planning/MILESTONE-B2B-PORTAL-MVP-2026-06-09.md):
 * B2B portal MVP omurgası dışında kalan menüler env-flag arkasına
 * alındı. Default OFF — kullanıcı görmez, sayfa URL'inden de açılmaz
 * (page-level notFound guard'lar `bayi-oneriler/marketing/vitrinim/risk/
 * kampanya` için aktif).
 *
 * Açılmak istendiğinde Vercel env'inden ilgili
 * `NEXT_PUBLIC_FEATURE_BAYI_*` flag'i `true` yap; redeploy gerekir
 * (NEXT_PUBLIC env'leri build-time inline edilir).
 */
import { isFeatureEnabled } from "@/platform/feature-flags";

export type BayiFeatureFlag =
  | "bayi.cross_sell"        // bayi-oneriler (öneri motoru)
  | "bayi.marketing_auto"    // bayi-marketing (drip marketing)
  | "bayi.referral"          // referral sistemi — şu an unbound (rezerve)
  | "bayi.vitrin"            // bayi-vitrinim (online vitrin)
  | "bayi.risk_score"        // bayi-risk (churn skor)
  | "bayi.kampanya_eski"     // bayi-kampanya (Faz 1'de yeniden tasarlanacak)
  | "bayi.musteri_talepleri" // bayi-musteri-talepleri (sidebar-only hide)
  | "bayi.takvim"            // bayi-takvim (sidebar-only hide)
  | "bayi.hakkinda"          // bayi-hakkinda (sidebar-only hide)
  | "bayi.gizlilik";         // bayi-gizlilik (sidebar-only hide)

export function isBayiFeatureEnabled(flag: BayiFeatureFlag): boolean {
  return isFeatureEnabled(flag);
}
