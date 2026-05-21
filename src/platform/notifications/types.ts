/**
 * Bildirim türleri kataloğu.
 *
 * 26 tür: 7 Free (zorunlu/temel) + 19 Pro (gelişmiş insights).
 * Her tür için label + description + category + tier + (opsiyonel) trigger
 * notu. Cron'lar ve event handler'lar `shouldNotify(userId, type)` ile bu
 * katalogdan gelen tür string'lerini kullanır.
 */

export type NotificationTier = "free" | "pro";

export type NotificationCategory =
  | "gunluk"
  | "musteri"
  | "mulk"
  | "sozlesme"
  | "sunum_websitem"
  | "sistem_destek"
  | "ai";

export interface NotificationTypeDef {
  type: string;
  label: string;
  description: string;
  category: NotificationCategory;
  tier: NotificationTier;
  trigger?: string;
}

export const CATEGORY_META: Record<NotificationCategory, { icon: string; label: string }> = {
  gunluk: { icon: "📅", label: "Günlük & Hatırlatma" },
  musteri: { icon: "👤", label: "Müşteri Olayları" },
  mulk: { icon: "🏠", label: "Mülk & Takip" },
  sozlesme: { icon: "📄", label: "Sözleşme & Komisyon" },
  sunum_websitem: { icon: "🎤", label: "Sunum & Web Site" },
  sistem_destek: { icon: "🛟", label: "Sistem & Destek" },
  ai: { icon: "🤖", label: "AI Önerileri" },
};

export const NOTIFICATION_TYPES: NotificationTypeDef[] = [
  // ── Free (7) ───────────────────────────────────────────────────────────
  { type: "sabah_brif", label: "Sabah brifingi", description: "Günün özeti, eşleşmeler, bekleyen takipler.", category: "gunluk", tier: "free", trigger: "cron 08:00" },
  { type: "randevu_hatirla", label: "Randevu hatırlatması", description: "Takvimdeki etkinlikten 1 saat önce.", category: "gunluk", tier: "free", trigger: "calendar event" },
  { type: "yeni_musteri_kayit", label: "Yeni müşteri kaydı", description: "Form veya WhatsApp'tan müşteri eklendiğinde.", category: "musteri", tier: "free", trigger: "form/lead" },
  { type: "sozlesme_imzali", label: "Sözleşme imzalandı", description: "Müşteri sözleşmeyi imzaladığında.", category: "sozlesme", tier: "free", trigger: "e-imza event" },
  { type: "destek_yanit", label: "Destek talebine yanıt", description: "Açtığın destek talebine yanıt geldiğinde.", category: "sistem_destek", tier: "free", trigger: "admin reply" },
  { type: "faturalama", label: "Faturalama / abonelik", description: "Fatura kesimi, ödeme uyarısı, abonelik durumu.", category: "sistem_destek", tier: "free", trigger: "billing event" },
  { type: "hatirlatma_manuel", label: "Manuel hatırlatma", description: "Senin kurduğun hatırlatmalar zamanı geldiğinde.", category: "gunluk", tier: "free", trigger: "scheduled" },
  { type: "bayi_kampanya_mesaji", label: "Kampanya / drip mesajı", description: "Bayi marketing kampanyaları ve drip mesaj dizileri.", category: "sistem_destek", tier: "free", trigger: "marketing automation" },

  // ── Pro (19) ───────────────────────────────────────────────────────────
  // Mülk
  { type: "mulk_fiyat_degisti", label: "Mülk fiyatı değişti", description: "Portföyündeki bir mülkün fiyatı güncellendiğinde.", category: "mulk", tier: "pro" },
  { type: "mulk_durum_degisti", label: "Mülk durum değişikliği", description: "Aktif → satıldı/kiralandı/pasif geçişlerinde.", category: "mulk", tier: "pro" },
  { type: "mulk_goruntuleme_haftalik", label: "Mülk görüntüleme — haftalık", description: "Mülklerinin web sayfanda kaç kez gösterildiği özeti.", category: "mulk", tier: "pro", trigger: "cron weekly" },
  { type: "ilan_yenileme", label: "İlan yenileme uyarısı", description: "İlanın yenilenmesi gereken zaman geldiğinde.", category: "mulk", tier: "pro" },

  // Müşteri
  { type: "yeni_eslesme_mulk_musteri", label: "Yeni mülk-müşteri eşleşmesi", description: "Bir müşterinin kriterlerine yeni mülk uyduğunda.", category: "musteri", tier: "pro" },
  { type: "musteri_sicaklik_yukseldi", label: "Müşteri sıcaklığı yükseldi", description: "Müşterinin engagement skoru yüksek seviyeye ulaştığında.", category: "musteri", tier: "pro" },
  { type: "musteri_uzun_sure_konusulmadi", label: "Müşteri ile uzun süredir konuşulmadı", description: "30+ gündür temas yoksa hatırlatma.", category: "musteri", tier: "pro" },
  { type: "musteri_sunum_acti", label: "Müşteri sunumu açtı", description: "Paylaştığın sunumu müşteri görüntülediğinde.", category: "musteri", tier: "pro" },

  // Sözleşme
  { type: "sozlesme_bitiyor_30gun", label: "Sözleşme bitimine 30 gün", description: "Yetki sözleşmesi bitmeden önce hatırlatma.", category: "sozlesme", tier: "pro" },
  { type: "komisyon_tahsilat", label: "Komisyon tahsilat hatırlatması", description: "Komisyon ödemesi vade tarihi yaklaştığında.", category: "sozlesme", tier: "pro" },
  { type: "kira_odeme_yaklas", label: "Kira ödeme tarihi yaklaşıyor", description: "Yönettiğin kiralık mülklerde ödeme tarihinden önce.", category: "sozlesme", tier: "pro" },

  // Sunum & Web Site
  { type: "sunum_acildi", label: "Sunum açıldı", description: "Paylaştığın bir sunum link'i tıklandığında.", category: "sunum_websitem", tier: "pro" },
  { type: "websitem_ziyaret_haftalik", label: "Web sitem ziyaret özeti", description: "Web sayfana haftalık ziyaretçi raporu.", category: "sunum_websitem", tier: "pro", trigger: "cron weekly" },

  // Takip
  { type: "takip_sabah_yeni_ilan", label: "Takip — sabah yeni ilan", description: "Kurduğun takip kriterine yeni ilan düştüğünde.", category: "mulk", tier: "pro", trigger: "cron 06:45" },
  { type: "takip_fiyat_degisti", label: "Takip — ilan fiyatı değişti", description: "Takip ettiğin ilanın fiyatı güncellendiğinde.", category: "mulk", tier: "pro" },
  { type: "takip_durdu", label: "Takip — ilan kalktı", description: "Takip ettiğin ilan ilan listesinden kaldırıldığında.", category: "mulk", tier: "pro" },

  // Takvim
  { type: "takvim_yarinki_ozet", label: "Yarınki takvim özeti", description: "Akşam saatinde ertesi günün etkinlikleri özeti.", category: "gunluk", tier: "pro", trigger: "cron 21:00" },

  // Sistem
  { type: "yeni_ozellik_duyuru", label: "Yeni özellik duyurusu", description: "Platforma eklenen yeni özellikleri ilk öğrenenlerden ol.", category: "sistem_destek", tier: "pro" },

  // AI
  { type: "ai_oneri_proaktif", label: "AI proaktif öneriler", description: "AI'ın günlük 1-2 stratejik öneri (kim arasın, hangi mülk fiyatı düşürmeli).", category: "ai", tier: "pro" },
];

export const NOTIFICATION_TYPE_MAP: Record<string, NotificationTypeDef> = Object.fromEntries(
  NOTIFICATION_TYPES.map(t => [t.type, t]),
);

export type NotificationType = string;

/**
 * Preset adı → enabled types.
 * UI 4 preset sunar; "ozel" preset'inde kullanıcı tek tek seçer.
 */
export type PresetName = "yogun" | "kritik" | "sessiz" | "ozel";

export const PRESETS: Record<Exclude<PresetName, "ozel">, string[]> = {
  yogun: NOTIFICATION_TYPES.map(t => t.type),
  kritik: [
    // Free 7'nin tamamı
    "sabah_brif", "randevu_hatirla", "yeni_musteri_kayit", "sozlesme_imzali",
    "destek_yanit", "faturalama", "hatirlatma_manuel",
    // Yüksek-değerli Pro: sıcak müşteri, sözleşme bitiyor, AI
    "musteri_sicaklik_yukseldi", "sozlesme_bitiyor_30gun", "ai_oneri_proaktif",
  ],
  sessiz: [
    "sabah_brif", "randevu_hatirla",
  ],
};

/**
 * Default preferences for a new user — Free types açık, Pro kapalı.
 */
export function getDefaultPreferences(): { type: string; enabled: boolean }[] {
  return NOTIFICATION_TYPES.map(t => ({ type: t.type, enabled: t.tier === "free" }));
}
