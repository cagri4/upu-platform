/**
 * Landing Page Revision History — Hero + Pricing components.
 *
 * Kullanım: Müşterilere ekran görüntüsü gönderildikten 1 hafta sonra
 * site açıldığında "şey burası eski mi yeni mi" sorusunun şeffaf cevabı.
 * Hero ve Pricing component'lerinin sol-altında küçük "?" + "revizyonlar"
 * badge — tıklayınca pop-over'da revizyon listesi.
 *
 * Yeni revizyon eklerken:
 *   1. İlgili component (hero | pricing) array'inin BAŞINA yeni entry
 *      ekle (en yeni en üstte)
 *   2. date: ISO format ("2026-05-15")
 *   3. description_tr / _nl / _en üçü zorunlu
 *   4. Commit'in parçası olsun (landing değişikliği ile aynı commit)
 */

export type RevisionComponent = "hero" | "pricing";

export interface Revision {
  date: string;            // YYYY-MM-DD
  description_tr: string;
  description_nl: string;
  description_en: string;
}

export interface LocalizedRevision {
  date: string;
  description: string;
}

const REVISIONS: Record<RevisionComponent, Revision[]> = {
  hero: [
    {
      date: "2026-04-30",
      description_tr: "İlk yayın — Türk dağıtıcı odaklı içerik (5 değer önerisi)",
      description_nl: "Eerste publicatie — content gericht op Turkse distributeurs (5 waardeproposities)",
      description_en: "Initial release — Turkish distributor focused content (5 value propositions)",
    },
  ],
  pricing: [
    {
      date: "2026-04-30",
      description_tr: "İlk yayın — Starter €99 / Growth €249 / Pro €599 + Setup €749 + ilk 10 müşteri promo",
      description_nl: "Eerste publicatie — Starter €99 / Growth €249 / Pro €599 + Setup €749 + eerste 10 klanten promo",
      description_en: "Initial release — Starter €99 / Growth €249 / Pro €599 + Setup €749 + first 10 customers promo",
    },
  ],
};

/**
 * Get revisions localized for a given UI locale (tr | nl | en).
 * Most recent first. Caller decides max count to display.
 */
export function getRevisions(
  componentKey: RevisionComponent,
  locale: "tr" | "nl" | "en",
): LocalizedRevision[] {
  const entries = REVISIONS[componentKey] || [];
  return entries.map(r => ({
    date: r.date,
    description: locale === "nl" ? r.description_nl
      : locale === "en" ? r.description_en
      : r.description_tr,
  }));
}
