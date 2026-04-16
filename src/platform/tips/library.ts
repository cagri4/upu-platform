/**
 * Tip library — product-usage hints for emlak users.
 *
 * Each tip encourages discovery of a killer feature. Sent 3-4 times/day.
 * Picker filters by:
 *   - context (user's current state: hasProperties, hasCustomers, etc.)
 *   - cooldown (same tip not shown in 14 days)
 *   - priority (higher shown first to active users)
 */

export type TipContext = {
  propertyCount: number;
  customerCount: number;
  reminderCount: number;
  contractCount: number;
  daysSinceSignup: number;
  uniqueCommandsUsed: number;  // how many distinct commands they've tried
};

export type Tip = {
  key: string;
  // Short hook shown as WA text
  text: string;
  // CTA button that starts the feature
  cta: { id: string; title: string };
  // Higher priority = more likely to be picked when eligible
  priority: number;
  // Returns true if tip is eligible for this user right now
  eligible: (c: TipContext) => boolean;
};

export const EMLAK_TIPS: Tip[] = [
  // ── Keşif: Yeni kullanıcı için başlangıç tipleri ────────────────────
  {
    key: "start_mulkekle",
    text:
      "💡 *İpucu*\n\n" +
      "Sistem senin için çalışmaya hazır ama önce 1-2 mülk eklemen lazım.\n\n" +
      "Sahibinden linkini yapıştır veya sıfırdan bilgileri yaz — AI sana yardım eder.",
    cta: { id: "cmd:mulkekle", title: "🏠 Mülk Ekle" },
    priority: 100,
    eligible: (c) => c.propertyCount === 0,
  },
  {
    key: "start_musteriekle",
    text:
      "💡 *İpucu*\n\n" +
      "Mülklerin var ama müşterin yok. Müşteri eklediğinde sistem kriterlerine uygun mülkleri otomatik eşleştirir.\n\n" +
      "Sıcak bir alıcıyı sisteme kaydet, gerisini ben hallederim.",
    cta: { id: "cmd:musteriEkle", title: "🤝 Müşteri Ekle" },
    priority: 95,
    eligible: (c) => c.propertyCount >= 1 && c.customerCount === 0,
  },

  // ── Değer: Ana özelliklerin tanıtımı ────────────────────────────────
  {
    key: "discover_fiyatbelirle",
    text:
      "💡 *İpucu*\n\n" +
      "Bir mülkün için fiyat mı belirsiz? *fiyatbelirle* komutu ile aynı bölgedeki benzer ilanları tarayıp piyasa ortalamasını gösteririm.\n\n" +
      "30 saniyede gerçek fiyat aralığını bul.",
    cta: { id: "cmd:fiyatbelirle", title: "📊 Fiyat Belirle" },
    priority: 90,
    eligible: (c) => c.propertyCount >= 1,
  },
  {
    key: "discover_sunum",
    text:
      "💡 *İpucu*\n\n" +
      "Müşterine özel sunum hazırlamak 30 dakika sürer. Ben 2 dakikada yaparım.\n\n" +
      "*sunum* yazıp müşteri + mülk seç — AI kişiselleştirilmiş sunum + web link üretsin.",
    cta: { id: "cmd:sunum", title: "🎯 Sunum Hazırla" },
    priority: 85,
    eligible: (c) => c.customerCount >= 1 && c.propertyCount >= 1,
  },
  {
    key: "discover_eslestir",
    text:
      "💡 *İpucu*\n\n" +
      "Müşterinin bütçe ve kriterlerine uyan mülklerini görmek ister misin?\n\n" +
      "*eşleştir* komutu → müşteri seç → uygun tüm mülklerini puanla birlikte listeler.",
    cta: { id: "cmd:eslestir", title: "🔗 Eşleştir" },
    priority: 80,
    eligible: (c) => c.customerCount >= 1 && c.propertyCount >= 2,
  },
  {
    key: "discover_hatirlatma",
    text:
      "💡 *İpucu*\n\n" +
      "Müşteri aramasını, sözleşme yenilemesini, gösterim saatini unutma.\n\n" +
      "*hatırlatma* komutu ile istediğin saatte bildirim al.",
    cta: { id: "cmd:hatirlatma", title: "⏰ Hatırlatma Kur" },
    priority: 75,
    eligible: (c) => c.reminderCount === 0 && c.daysSinceSignup >= 1,
  },
  {
    key: "discover_takipet",
    text:
      "💡 *İpucu*\n\n" +
      "Bölgenizdeki yeni ilanları manuel takip etmek yerine ben her sabah sana özetleyebilirim.\n\n" +
      "*takipet* komutu ile kriterlerini söyle, her gün uygun yeni ilanları gönderirim.",
    cta: { id: "cmd:takipEt", title: "📡 Takibe Al" },
    priority: 70,
    eligible: (c) => c.daysSinceSignup >= 2,
  },
  {
    key: "discover_musteritakip",
    text:
      "💡 *İpucu*\n\n" +
      "Müşteriye son aradığın tarihi hatırlıyor musun? 2 hafta mı geçti?\n\n" +
      "*müşteri takip* komutu ile her müşterinin son temas + pipeline aşamasını görebilir, sonraki adımı AI'dan alabilirsin.",
    cta: { id: "cmd:musteriTakip", title: "📞 Müşteri Takip" },
    priority: 72,
    eligible: (c) => c.customerCount >= 2,
  },
  {
    key: "discover_satistavsiye",
    text:
      "💡 *İpucu*\n\n" +
      "Zor bir müşteri mi? Sıcak ama kapatılmıyor mu?\n\n" +
      "*satış tavsiye* komutu ile AI müşteri geçmişini okuyup sana kapama stratejisi + hazır mesaj önerir.",
    cta: { id: "cmd:satistavsiye", title: "💼 Satış Tavsiyesi" },
    priority: 68,
    eligible: (c) => c.customerCount >= 1,
  },
  {
    key: "discover_paylas",
    text:
      "💡 *İpucu*\n\n" +
      "Mülkünü Instagram veya sosyal medyada paylaşmak ister misin? AI hashtag'li post + açıklama yazabilir.\n\n" +
      "*paylaş* komutu ile dene.",
    cta: { id: "cmd:paylas", title: "📱 Paylaş" },
    priority: 60,
    eligible: (c) => c.propertyCount >= 1,
  },
  {
    key: "discover_sozlesme",
    text:
      "💡 *İpucu*\n\n" +
      "Yetkilendirme sözleşmesini 5 dakikada hazırlayabilirsin — sahibi bilgileri, komisyon, süre.\n\n" +
      "*sözleşme* komutu → AI doldurur, PDF üretir, e-imza linki gönderir.",
    cta: { id: "cmd:sozlesme", title: "📄 Sözleşme Hazırla" },
    priority: 55,
    eligible: (c) => c.propertyCount >= 1,
  },
  {
    key: "discover_webpanel",
    text:
      "💡 *İpucu*\n\n" +
      "Mülk ve müşterilerini büyük ekranda görmek ister misin?\n\n" +
      "*webpanel* komutu ile 15 dk geçerli bir link gönderirim, tarayıcıdan aç.",
    cta: { id: "cmd:webpanel", title: "🖥 Web Panel" },
    priority: 50,
    eligible: (c) => c.propertyCount >= 2 || c.customerCount >= 2,
  },
  {
    key: "discover_tara",
    text:
      "💡 *İpucu*\n\n" +
      "Sahibinden veya Hepsiemlak'ta ilan mı beğendin? Linki gönder, sistemime çekeyim — elle yazmana gerek yok.\n\n" +
      "*tara* komutu + link, hazır.",
    cta: { id: "cmd:tara", title: "🔗 Linkten Çek" },
    priority: 65,
    eligible: (c) => c.uniqueCommandsUsed <= 3,
  },
  {
    key: "discover_fotograf",
    text:
      "💡 *İpucu*\n\n" +
      "Mülküne fotoğraf eklemek için uygulamadan çıkmana gerek yok.\n\n" +
      "*fotoğraf* komutu seç, direkt WhatsApp'tan fotoğraf gönder — otomatik kaydedilir.",
    cta: { id: "cmd:fotograf", title: "📸 Fotoğraf Ekle" },
    priority: 58,
    eligible: (c) => c.propertyCount >= 1,
  },

  // ── Durum bazlı: Kullanıcının verisine göre ──────────────────────────
  {
    key: "stale_property_reminder",
    text:
      "💡 *İpucu*\n\n" +
      "Bazı mülklerin 30+ gündür güncellenmemiş olabilir. Bayat ilanlar az görüntülenir.\n\n" +
      "Web panelden *Mülklerim* sayfasına bak, tarihler görünür.",
    cta: { id: "cmd:webpanel", title: "🖥 Kontrol Et" },
    priority: 45,
    eligible: (c) => c.propertyCount >= 3 && c.daysSinceSignup >= 30,
  },
  {
    key: "silent_customer",
    text:
      "💡 *İpucu*\n\n" +
      "Müşterilerinin bir kısmı uzun süredir sessiz olabilir. Pipeline'da *teklif* aşamasında takılıp kalanlar var mı?\n\n" +
      "*müşteri takip* komutu ile bu durumu AI ile birlikte analiz edelim.",
    cta: { id: "cmd:musteriTakip", title: "📞 Müşteri Takip" },
    priority: 48,
    eligible: (c) => c.customerCount >= 3,
  },
  {
    key: "empty_contracts",
    text:
      "💡 *İpucu*\n\n" +
      "Hiç yetkilendirme sözleşmen yok. İlan paylaşırken sahibi ile aranda yazılı anlaşma olması hem seni korur hem profesyonel görünür.\n\n" +
      "*sözleşme* komutu ile 3 dakikada hazırla.",
    cta: { id: "cmd:sozlesme", title: "📄 Sözleşme Hazırla" },
    priority: 42,
    eligible: (c) => c.propertyCount >= 2 && c.contractCount === 0,
  },

  // ── Genel öneriler: herkes için, cooldown'lu ──────────────────────────
  {
    key: "tip_ipucu_command",
    text:
      "💡 *İpucu*\n\n" +
      "*ipucu* yazarsan sana tüm ipuçlarını listeleyebilirim — istediğini istediğin zaman dene.",
    cta: { id: "cmd:ipucu", title: "💡 Tüm İpuçları" },
    priority: 30,
    eligible: (c) => c.daysSinceSignup >= 3,
  },
  {
    key: "settings_tips_off",
    text:
      "💡 *İpucu*\n\n" +
      "Bu ipuçları çok mu sık? Saati/sıklığı kontrol etmek için web paneldeki *Ayarlar* sayfasını aç.",
    cta: { id: "cmd:webpanel", title: "🖥 Ayarlar" },
    priority: 25,
    eligible: (c) => c.daysSinceSignup >= 7,
  },
];
