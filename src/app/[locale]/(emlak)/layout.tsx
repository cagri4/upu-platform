/**
 * (emlak) route group — emlak SaaS'a özgü generic-isimli sayfalar burada.
 *
 * Niye route group? Multi-tenant signup akışında 7 SaaS'ın hepsi
 * /[locale]/profil-kurulum gibi generic path'lere yönlendirilemez —
 * sektörel placeholder ve form alanları diğer SaaS dealer'larına sızıntı
 * oluşturur. Bu group'a giren sayfalar emlak signup redirect'i ile
 * erişilir (`profilKurulumRedirectFor("emlak")` döner).
 *
 * Mevcut üyeler:
 *   - profil-kurulum/  → /[locale]/profil-kurulum (onboarding form)
 *   - setup/           → /[locale]/setup (magic-link onboarding,
 *                        history: pre-OTP era. Aktif link üretici yok
 *                        ama dosya korunuyor backward-compat için)
 *
 * Diğer SaaS'lar için:
 *   bayi      → /[locale]/bayi-profil
 *   restoran  → /[locale]/restoran-profil
 *   market/otel/siteyonetim/muhasebe → /[locale]/profil-kurulum-mini
 *     (market/otel/site dedicated sayfaları shell-içi olduğundan fresh
 *      signup'a uygun değil — minimal generic mini kullanılır)
 *
 * NOT: Next.js route group URL'i etkilemez (/tr/profil-kurulum aynı
 * kalır). Bu organizasyon dosya kimliğini ve gelecekteki middleware/
 * layout guard'larına altyapı sağlar.
 */
export default function EmlakSaasGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
