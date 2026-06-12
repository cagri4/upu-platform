/**
 * Bayi tenant feature flag tanımları.
 *
 * Faz 0 temizliği (.planning/MILESTONE-B2B-PORTAL-MVP-2026-06-09.md):
 * B2B portal MVP omurgası dışında kalan menüler env-flag arkasına
 * alındı. Default OFF — kullanıcı görmez, sayfa URL'inden de açılmaz
 * (page-level notFound guard'lar bayi-oneriler/marketing/vitrinim/risk/
 * kampanya/musteri-talepleri/takvim/oneri için aktif).
 *
 * Açılmak istendiğinde Vercel env'inden ilgili
 * `NEXT_PUBLIC_FEATURE_BAYI_*` flag'i `true` yap; redeploy gerekir
 * (NEXT_PUBLIC env'leri build-time inline edilir).
 *
 * Faz 0 uzantısı (2026-06-09 Çağrı kararı): musteri-talepleri/takvim/
 * oneri (singular feedback) page-guard arkasına alındı; bayi.referral
 * flag'i enum'dan silindi (B2B dağıtıcıda anlamı zayıf).
 */
import { isFeatureEnabled } from "@/platform/feature-flags";

export type BayiFeatureFlag =
  | "bayi.cross_sell"        // bayi-oneriler (öneri motoru)
  | "bayi.marketing_auto"    // bayi-marketing (drip marketing)
  | "bayi.vitrin"            // bayi-vitrinim (online vitrin)
  | "bayi.risk_score"        // bayi-risk (churn skor)
  | "bayi.kampanya_eski"     // bayi-kampanya (Faz 1'de yeniden tasarlanacak)
  | "bayi.musteri_talepleri" // bayi-musteri-talepleri (B2C tarafı, MVP dışı)
  | "bayi.takvim"            // bayi-takvim (MVP dışı, karmaşa)
  | "bayi.oneri_feedback"    // bayi-oneri singular feedback (WA üzerinden gelir)
  | "bayi.hakkinda"          // bayi-hakkinda (sidebar-only hide)
  | "bayi.gizlilik"          // bayi-gizlilik (sidebar-only hide)
  | "bayi.depo"              // Faz 5 — Depo modülü (multi-depo + sayım + mal kabul)
  | "bayi.saha"              // Faz 6 — Saha Satış modülü (sales rep + ziyaret + mobil portal)
  | "bayi.satinalma"         // Faz 7 — Satın Alma modülü (tedarikçi + PO + cari)
  | "bayi.legacy_panel";     // (bayipanel) karma panel — Faz 2'de V3 (bayi-portal)
                              // omurgasına geçildi. Flag true ise eski sayfalar
                              // /tr/bayi-panel/* altında render edilir (admin
                              // debug). Default OFF → /tr/bayi-panel girince
                              // /tr/bayi'ye redirect.

export function isBayiFeatureEnabled(flag: BayiFeatureFlag): boolean {
  return isFeatureEnabled(flag);
}
