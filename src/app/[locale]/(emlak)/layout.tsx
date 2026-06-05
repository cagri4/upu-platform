/**
 * (emlak) route group — emlak SaaS'a özgü generic-isimli sayfalar burada.
 *
 * Niye route group? Multi-tenant signup akışında 7 SaaS'ın hepsi
 * /[locale]/profil-kurulum gibi generic path'lere yönlendirilemez —
 * emlak-spesifik içerik (ABC Emlak placeholder, ofis, çalışma bölgesi
 * vb.) diğer SaaS dealer'larına sızıntı oluşturur. Bu group'a giren
 * sayfalar yalnız emlak signup redirect'i ile erişilebilir
 * (`profilKurulumRedirectFor("emlak")` döner).
 *
 * Diğer SaaS'lar için:
 *   bayi      → /[locale]/bayi-profil
 *   restoran  → /[locale]/restoran-profil
 *   market/otel/siteyonetim/muhasebe → /[locale]/profil-kurulum-mini
 *     (market/otel/site dedicated sayfaları shell-içi olduğundan fresh
 *      signup'a uygun değil — minimal generic mini kullanılır)
 */
export default function EmlakSaasGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
