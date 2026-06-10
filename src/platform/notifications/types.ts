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
  | "ai"
  | "bayi_b2b";

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
  bayi_b2b: { icon: "📦", label: "B2B Portal (Bayi)" },
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

  // ── B2B Portal — Faz 4 (14 tip, hepsi free: işlemsel bildirimler) ──────
  // Dağıtıcı → Bayi (10)
  { type: "bayi_hosgeldin", label: "Hoşgeldin", description: "Bayi portala kayıt olduğunda karşılama.", category: "bayi_b2b", tier: "free", trigger: "signup" },
  { type: "bayi_yeni_kampanya", label: "Yeni kampanya", description: "Hedeflemene uyan kampanya başladığında.", category: "bayi_b2b", tier: "free", trigger: "campaign activate" },
  { type: "bayi_siparis_alindi", label: "Sipariş alındı", description: "Siparişin oluşturuldu, dağıtıcı onayı bekliyor.", category: "bayi_b2b", tier: "free", trigger: "order created" },
  { type: "bayi_siparis_onaylandi", label: "Sipariş onaylandı", description: "Dağıtıcı siparişini onayladı.", category: "bayi_b2b", tier: "free", trigger: "order approved" },
  { type: "bayi_siparis_reddedildi", label: "Sipariş reddedildi", description: "Dağıtıcı siparişini reddetti (sebep notuyla).", category: "bayi_b2b", tier: "free", trigger: "order rejected" },
  { type: "bayi_kargo_cikti", label: "Kargo çıktı", description: "Siparişin kargoya verildi, takip no hazır.", category: "bayi_b2b", tier: "free", trigger: "order shipped" },
  { type: "bayi_vade_yaklasti", label: "Vade yaklaşıyor", description: "Fatura vadesine 3 gün / 1 gün kala.", category: "bayi_b2b", tier: "free", trigger: "cron daily" },
  { type: "bayi_vade_gecti", label: "Vade geçti", description: "Fatura vadesi geçti, ödeme bekleniyor.", category: "bayi_b2b", tier: "free", trigger: "cron daily" },
  { type: "bayi_fatura_kesildi", label: "Fatura kesildi", description: "Sipariş faturan hazır, PDF linki ile.", category: "bayi_b2b", tier: "free", trigger: "invoice created" },
  { type: "bayi_odeme_alindi", label: "Ödeme alındı", description: "Ödemen işlendi, teşekkürler.", category: "bayi_b2b", tier: "free", trigger: "payment received" },
  // Dağıtıcı kendine (4)
  { type: "dagitici_yeni_siparis", label: "Yeni sipariş geldi", description: "Bir bayi yeni sipariş verdi.", category: "bayi_b2b", tier: "free", trigger: "order created" },
  { type: "dagitici_onay_bekleyen", label: "Onay bekleyen siparişler", description: "Bekleyen siparişlerin günlük hatırlatması.", category: "bayi_b2b", tier: "free", trigger: "cron daily" },
  { type: "dagitici_kritik_stok", label: "Kritik stok", description: "Ürün stoğu eşiğin altına düştü.", category: "bayi_b2b", tier: "free", trigger: "stock check" },
  { type: "dagitici_geciken_rapor", label: "Geciken bayi raporu", description: "Vadesi geçmiş bayilerin günlük özeti.", category: "bayi_b2b", tier: "free", trigger: "cron daily" },
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

// ─── Notification type → WA template mapping (24h penceresi dışı fallback) ──
//
// Window kapalı kullanıcılara `send-notification.ts` template path'ine düşer;
// burada her notification_type için hangi APPROVED template'in kullanılacağı
// ve parametre dolumu tanımlıdır. Map dışı türler "silent" — sadece DB log.
//
// `name` runtime'da `templates.ts:APPROVED_NOTIFICATION_TEMPLATES` set'inde
// olmalı; yoksa send-notification 'wa-pending' channel ile DB'ye flag düşer.
//
// `buildParams` template BODY'sindeki {{1}}, {{2}}, ... pozisyonel sırayla
// karşılık gelir. Meta limit: parametre değerleri max ~1024 char, "\n" yasak
// (template'in kendi text'inde \n var, parametre içinde olmamalı).

export interface TemplateBuildInput {
  /** Tenant kısa adı (örn "Bayi", "Emlak"). */
  tenantName: string;
  /** Tam URL (örn "https://retailai.upudev.nl/tr/bayi-fatura"). */
  panelUrl: string;
  /** sendNotification input.title — emoji/uzunluk için sanitize gerekirse caller'da. */
  title: string;
  /** sendNotification input.body. */
  body: string;
  /** sendNotification input.payload — invoice_no, amount, due_date vb. */
  payload: Record<string, unknown>;
}

export interface NotificationTemplateMapping {
  name: string;
  buildParams: (input: TemplateBuildInput) => string[];
}

/**
 * Param sanitize — Meta kuralı: \n + sekans new-line yasak, max ~1024 char.
 */
function s(value: unknown, max = 200): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

export const NOTIFICATION_TYPE_TEMPLATES: Record<string, NotificationTemplateMapping> = {
  // Vade hatırlatma — bayi-vade-reminder cron'undan tetiklenir.
  // upu_bekleyen_islem: {{1}}=tenant, {{2}}=özet, {{3}}=panel url
  faturalama: {
    name: "upu_bekleyen_islem",
    buildParams: (i) => {
      const p = i.payload as { invoice_no?: string; due_date?: string; days_bucket?: number };
      const bucket = p.days_bucket;
      const due = bucket === 0 ? "bugün vadeli" : bucket === 1 ? "yarın vadeli" : `${bucket} gün sonra vadeli`;
      const summary = p.invoice_no
        ? `Fatura ${p.invoice_no} (${due})`
        : s(i.title, 120);
      return [s(i.tenantName, 40), s(summary, 200), s(i.panelUrl, 200)];
    },
  },

  // Yeni müşteri / yeni eşleşme — upu_yeni_kayit
  // {{1}}=tenant, {{2}}=kategori ("talep"/"müşteri"), {{3}}=detay, {{4}}=panel url
  yeni_musteri_kayit: {
    name: "upu_yeni_kayit",
    buildParams: (i) => [
      s(i.tenantName, 40),
      "müşteri",
      s(i.body || i.title, 150),
      s(i.panelUrl, 200),
    ],
  },
  yeni_eslesme_mulk_musteri: {
    name: "upu_yeni_kayit",
    buildParams: (i) => [
      s(i.tenantName, 40),
      "eşleşme",
      s(i.body || i.title, 150),
      s(i.panelUrl, 200),
    ],
  },

  // Durum değişimi — upu_durum_guncelleme
  // {{1}}=tenant, {{2}}=kayıt adı, {{3}}=yeni durum
  mulk_durum_degisti: {
    name: "upu_durum_guncelleme",
    buildParams: (i) => {
      const p = i.payload as { entity_label?: string; new_status?: string };
      return [s(i.tenantName, 40), s(p.entity_label || i.title, 100), s(p.new_status || i.body, 80)];
    },
  },
  mulk_fiyat_degisti: {
    name: "upu_durum_guncelleme",
    buildParams: (i) => {
      const p = i.payload as { entity_label?: string };
      return [s(i.tenantName, 40), s(p.entity_label || i.title, 100), "fiyat güncellendi"];
    },
  },
  sozlesme_imzali: {
    name: "upu_durum_guncelleme",
    buildParams: (i) => [s(i.tenantName, 40), s(i.title, 100), "imzalandı"],
  },

  // Günlük özet — upu_gunluk_ozet
  // {{1}}=tenant, {{2}}=özet, {{3}}=panel url
  sabah_brif: {
    name: "upu_gunluk_ozet",
    buildParams: (i) => [s(i.tenantName, 40), s(i.body || i.title, 250), s(i.panelUrl, 200)],
  },
  takvim_yarinki_ozet: {
    name: "upu_gunluk_ozet",
    buildParams: (i) => [s(i.tenantName, 40), s(i.body || i.title, 250), s(i.panelUrl, 200)],
  },

  // ── B2B Portal — Faz 4 (14 tip → upu_bayi_* / upu_dagitici_* template) ──
  // Template metinleri: src/platform/bayi/events/templates.ts (submission
  // script ile birebir). Onaylanana kadar APPROVED set'inde olmadıkları
  // için PATH C (wa-pending) düşer; mock modda zaten bu path'e gelinmez.
  bayi_hosgeldin: {
    name: "upu_bayi_hosgeldin",
    buildParams: (i) => {
      const p = i.payload as { dealer_name?: string };
      return [s(p.dealer_name || "Bayi", 60), s(i.tenantName, 60), s(i.panelUrl, 200)];
    },
  },
  bayi_yeni_kampanya: {
    name: "upu_bayi_kampanya",
    buildParams: (i) => [s(i.tenantName, 60), s(i.body || i.title, 200), s(i.panelUrl, 200)],
  },
  bayi_siparis_alindi: {
    name: "upu_bayi_siparis_alindi",
    buildParams: (i) => {
      const p = i.payload as { order_number?: string; amount?: string };
      return [s(p.order_number, 30), s(p.amount, 40), s(i.panelUrl, 200)];
    },
  },
  bayi_siparis_onaylandi: {
    name: "upu_bayi_siparis_onay",
    buildParams: (i) => {
      const p = i.payload as { order_number?: string; delivery_note?: string };
      return [s(p.order_number, 30), s(p.delivery_note || "Hazırlanıyor", 100), s(i.panelUrl, 200)];
    },
  },
  bayi_siparis_reddedildi: {
    name: "upu_bayi_siparis_red",
    buildParams: (i) => {
      const p = i.payload as { order_number?: string; reason?: string };
      return [s(p.order_number, 30), s(p.reason || "Belirtilmedi", 150), s(i.panelUrl, 200)];
    },
  },
  bayi_kargo_cikti: {
    name: "upu_bayi_kargo",
    buildParams: (i) => {
      const p = i.payload as { order_number?: string; carrier_label?: string; tracking_no?: string; tracking_url?: string };
      return [s(p.order_number, 30), s(p.carrier_label, 40), s(p.tracking_no, 40), s(p.tracking_url || i.panelUrl, 200)];
    },
  },
  bayi_vade_yaklasti: {
    name: "upu_bayi_vade_yaklasti",
    buildParams: (i) => {
      const p = i.payload as { invoice_no?: string; days_left?: string; amount?: string };
      return [s(p.invoice_no, 40), s(p.days_left || "3 gün", 20), s(p.amount, 40), s(i.panelUrl, 200)];
    },
  },
  bayi_vade_gecti: {
    name: "upu_bayi_vade_gecti",
    buildParams: (i) => {
      const p = i.payload as { invoice_no?: string; amount?: string };
      return [s(p.invoice_no, 40), s(p.amount, 40), s(i.panelUrl, 200)];
    },
  },
  bayi_fatura_kesildi: {
    name: "upu_bayi_fatura",
    buildParams: (i) => {
      const p = i.payload as { invoice_no?: string; amount?: string; due_date?: string };
      return [s(p.invoice_no, 40), s(p.amount, 40), s(p.due_date, 20), s(i.panelUrl, 200)];
    },
  },
  bayi_odeme_alindi: {
    name: "upu_bayi_odeme_tesekkur",
    buildParams: (i) => {
      const p = i.payload as { amount?: string };
      return [s(p.amount, 40), s(i.panelUrl, 200)];
    },
  },
  dagitici_yeni_siparis: {
    name: "upu_dagitici_yeni_siparis",
    buildParams: (i) => {
      const p = i.payload as { dealer_name?: string; order_number?: string; amount?: string };
      return [s(p.dealer_name, 60), s(p.order_number, 30), s(p.amount, 40), s(i.panelUrl, 200)];
    },
  },
  dagitici_onay_bekleyen: {
    name: "upu_dagitici_onay_bekleyen",
    buildParams: (i) => {
      const p = i.payload as { pending_count?: number | string };
      return [s(p.pending_count, 10), s(i.panelUrl, 200)];
    },
  },
  dagitici_kritik_stok: {
    name: "upu_dagitici_kritik_stok",
    buildParams: (i) => {
      const p = i.payload as { product_label?: string; remaining?: string };
      return [s(p.product_label, 80), s(p.remaining, 30), s(i.panelUrl, 200)];
    },
  },
  dagitici_geciken_rapor: {
    name: "upu_dagitici_geciken",
    buildParams: (i) => {
      const p = i.payload as { overdue_count?: number | string; total_amount?: string };
      return [s(p.overdue_count, 10), s(p.total_amount, 40), s(i.panelUrl, 200)];
    },
  },
};
