/**
 * B2B Portal Meta WA template kataloğu — Faz 4 (14 template, TR).
 *
 * Meta WA Business kuralları:
 *   - Pozisyonel parametreler {{1}}, {{2}}, ... — body text'inde
 *   - Parametre değerinde \n YASAK (sanitize: s())
 *   - Kategori: UTILITY (işlemsel) — hoşgeldin + kampanya MARKETING
 *   - Onay süreci 24-48 saat; PENDING template gönderilemez
 *
 * Bu katalog 2 yerde kullanılır:
 *   1. dispatcher.ts — live modda sendNotification template fallback'i
 *      için NOTIFICATION_TYPE_TEMPLATES'e eklenen mapping'lerin kaynağı
 *   2. scripts/submit_bayi_b2b_templates.py — Meta'ya submission
 *      (bu dosyadaki text'lerle birebir aynı olmalı)
 *
 * Onay durumu: templates.ts:APPROVED_NOTIFICATION_TEMPLATES set'ine
 * onaylanan adlar eklenir (Meta sync scripti mevcut, #91 pattern'i).
 */

export interface BayiB2BTemplate {
  name: string;
  category: "UTILITY" | "MARKETING";
  /** TR body — {{n}} pozisyonel parametreler. */
  text: string;
  /** Meta submission example değerleri (param sırasıyla). */
  example: string[];
}

export const BAYI_B2B_TEMPLATES: Record<string, BayiB2BTemplate> = {
  upu_bayi_hosgeldin: {
    name: "upu_bayi_hosgeldin",
    category: "MARKETING",
    text: "Merhaba {{1}}! 👋 {{2}} bayi portalına hoşgeldin. Kataloğu incele, kampanyaları gör, ilk siparişini birkaç dakikada ver.\n\nPortala git: {{3}}\n\n— UPU",
    example: ["Yıldız Market", "Mehmet Gıda", "https://retailai.upudev.nl/tr/bayi"],
  },
  upu_bayi_kampanya: {
    name: "upu_bayi_kampanya",
    category: "MARKETING",
    text: "{{1}} yeni kampanya başlattı 🎉 {{2}}\n\nDetaylar ve sipariş: {{3}}\n\n— UPU",
    example: ["Mehmet Gıda", "30 koli al 35 koli öde — A-segment, 1 hafta", "https://retailai.upudev.nl/tr/bayi/katalog"],
  },
  upu_bayi_siparis_alindi: {
    name: "upu_bayi_siparis_alindi",
    category: "UTILITY",
    text: "Siparişin alındı ✅ #{{1}} — {{2}} tutarında. Dağıtıcı onayı sonrası tekrar bilgilendireceğiz.\n\nSipariş detayı: {{3}}\n\n— UPU",
    example: ["202606-0042", "4.250,00 TL", "https://retailai.upudev.nl/tr/bayi/siparislerim"],
  },
  upu_bayi_siparis_onay: {
    name: "upu_bayi_siparis_onay",
    category: "UTILITY",
    text: "Siparişin onaylandı 🎉 #{{1}} hazırlığa alındı. {{2}}\n\nDetay: {{3}}\n\n— UPU",
    example: ["202606-0042", "Tahmini teslim: 2-3 iş günü", "https://retailai.upudev.nl/tr/bayi/siparislerim"],
  },
  upu_bayi_siparis_red: {
    name: "upu_bayi_siparis_red",
    category: "UTILITY",
    text: "Siparişin onaylanamadı ❌ #{{1}} — Sebep: {{2}}\n\nDetay ve tekrar sipariş: {{3}}\n\n— UPU",
    example: ["202606-0042", "Stok yetersiz", "https://retailai.upudev.nl/tr/bayi/siparislerim"],
  },
  upu_bayi_kargo: {
    name: "upu_bayi_kargo",
    category: "UTILITY",
    text: "Kargon yola çıktı 🚚 #{{1}} — {{2}} takip numarası: {{3}}\n\nCanlı takip: {{4}}\n\n— UPU",
    example: ["202606-0042", "Aras Kargo", "ARS1234567890", "https://kargotakip.araskargo.com.tr"],
  },
  upu_bayi_vade_yaklasti: {
    name: "upu_bayi_vade_yaklasti",
    category: "UTILITY",
    text: "Hatırlatma: {{1}} numaralı faturanın vadesine {{2}} kaldı. Tutar: {{3}}\n\nÖdeme seçenekleri: {{4}}\n\n— UPU",
    example: ["MCK-202606-000042", "3 gün", "15.000,00 TL", "https://retailai.upudev.nl/tr/bayi/faturalarim"],
  },
  upu_bayi_vade_gecti: {
    name: "upu_bayi_vade_gecti",
    category: "UTILITY",
    text: "Önemli: {{1}} numaralı faturanın vadesi geçti. Tutar: {{2}}\n\nLütfen en kısa sürede ödemeni yap: {{3}}\n\n— UPU",
    example: ["MCK-202606-000042", "15.000,00 TL", "https://retailai.upudev.nl/tr/bayi/faturalarim"],
  },
  upu_bayi_fatura: {
    name: "upu_bayi_fatura",
    category: "UTILITY",
    text: "Faturan hazır 🧾 {{1}} — Tutar: {{2}}, vade: {{3}}\n\nPDF indir: {{4}}\n\n— UPU",
    example: ["MCK-202606-000042", "4.250,00 TL", "10.07.2026", "https://retailai.upudev.nl/tr/bayi/faturalarim"],
  },
  upu_bayi_odeme_tesekkur: {
    name: "upu_bayi_odeme_tesekkur",
    category: "UTILITY",
    text: "Ödemen alındı, teşekkürler 🙏 {{1}} tutarındaki ödemen işlendi.\n\nGüncel hesabın: {{2}}\n\n— UPU",
    example: ["4.250,00 TL", "https://retailai.upudev.nl/tr/bayi/faturalarim"],
  },
  upu_dagitici_yeni_siparis: {
    name: "upu_dagitici_yeni_siparis",
    category: "UTILITY",
    text: "Yeni sipariş 📦 {{1}} bayisinden #{{2}} — {{3}} tutarında.\n\nİncele ve onayla: {{4}}\n\n— UPU",
    example: ["Yıldız Market", "202606-0042", "4.250,00 TL", "https://retailai.upudev.nl/tr/dagitici-panel/siparisler"],
  },
  upu_dagitici_onay_bekleyen: {
    name: "upu_dagitici_onay_bekleyen",
    category: "UTILITY",
    text: "Hatırlatma: {{1}} sipariş onayını bekliyor.\n\nSipariş kuyruğu: {{2}}\n\n— UPU",
    example: ["5", "https://retailai.upudev.nl/tr/dagitici-panel/siparisler"],
  },
  upu_dagitici_kritik_stok: {
    name: "upu_dagitici_kritik_stok",
    category: "UTILITY",
    text: "Kritik stok ⚠️ {{1}} — kalan: {{2}}.\n\nStok yönetimi: {{3}}\n\n— UPU",
    example: ["Spagetti 500g (SP-500)", "8 koli", "https://retailai.upudev.nl/tr/dagitici-panel/urunler"],
  },
  upu_dagitici_geciken: {
    name: "upu_dagitici_geciken",
    category: "UTILITY",
    text: "Günlük tahsilat raporu: {{1}} bayinin vadesi geçmiş, toplam {{2}}.\n\nDetaylar: {{3}}\n\n— UPU",
    example: ["3", "42.500,00 TL", "https://retailai.upudev.nl/tr/dagitici-panel/bayiler"],
  },
};

export const BAYI_B2B_TEMPLATE_NAMES = Object.keys(BAYI_B2B_TEMPLATES);
