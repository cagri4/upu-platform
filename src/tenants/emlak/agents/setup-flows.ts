/**
 * Emlak SaaS — 5 Agent Setup Flows
 *
 * Each virtual employee asks preferences on first interaction.
 * Answers stored in agent_config, used during autonomous runs.
 */

import type { AgentSetupFlow } from "@/platform/agents/setup";

// ── 🗂 Portföy Sorumlusu ──────────────────────────────────────────────

export const portfoySetup: AgentSetupFlow = {
  agentKey: "portfoy",
  agentName: "Portföy Sorumlusu",
  agentIcon: "🗂",
  greeting: "Merhaba! Ben portföy sorumlusuyum. Mülklerinizi takip eder, eksikleri tespit eder, pazar fırsatlarını bulurum.\n\nÖnce birkaç tercih belirleyelim:",
  questions: [
    {
      key: "bolge",
      text: "Hangi bölgeleri takip edeyim?\n\n💡 Örnek: _Kadıköy, Ataşehir_ veya _Bodrum_",
      freeText: true,
    },
    {
      key: "mulk_tipleri",
      text: "Hangi tür mülklerle çalışıyorsunuz?",
      buttons: [
        { id: "hepsi", title: "Hepsi" },
        { id: "konut", title: "Konut" },
        { id: "ticari", title: "Ticari" },
      ],
    },
    {
      key: "scrape_bildirim",
      text: "Bölgenize yeni ilan düşünce bildirim göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "sadece_uygun", title: "Sadece uygun olanlar" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "fiyat_esik",
      text: "Portföyünüzdeki mülklerde fiyat değişimi ne kadar olunca uyarayım?",
      buttons: [
        { id: "5", title: "%5 ve üzeri" },
        { id: "10", title: "%10 ve üzeri" },
        { id: "15", title: "%15 ve üzeri" },
      ],
    },
    {
      key: "eksik_bilgi_uyari",
      text: "Eksik bilgili mülkler (fotoğraf, m², fiyat) için otomatik uyarayım mı?",
      buttons: [
        { id: "evet", title: "Evet, uyar" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `📍 Takip bölgeleri: ${config.bolge}\n`;
    summary += `🏠 Mülk tipleri: ${config.mulk_tipleri === "hepsi" ? "Tümü" : config.mulk_tipleri}\n`;
    summary += `🔔 Yeni ilan bildirimi: ${config.scrape_bildirim === "evet" ? "Aktif" : config.scrape_bildirim === "sadece_uygun" ? "Sadece uygunlar" : "Kapalı"}\n`;
    summary += `📊 Fiyat değişim eşiği: %${config.fiyat_esik}\n`;
    summary += `⚠️ Eksik bilgi uyarısı: ${config.eksik_bilgi_uyari === "evet" ? "Aktif" : "Kapalı"}`;
    return summary;
  },
};

// ── 🤝 Satış Destek Uzmanı ────────────────────────────────────────────

export const satisSetup: AgentSetupFlow = {
  agentKey: "satis",
  agentName: "Satış Destek Uzmanı",
  agentIcon: "🤝",
  greeting: "Merhaba! Ben satış destek uzmanıyım. Müşterilerinizi takip eder, eşleştirme yapar, iletişim hatırlatırım.\n\nBirkaç soru:",
  questions: [
    {
      key: "soguma_suresi",
      text: "Bir müşteriyle kaç gün iletişim kurulmazsa uyarayım?",
      buttons: [
        { id: "7", title: "7 gün" },
        { id: "14", title: "14 gün" },
        { id: "30", title: "30 gün" },
      ],
    },
    {
      key: "eslestirme_otomatik",
      text: "Yeni mülk/müşteri eklendiğinde otomatik eşleştirme yapıp size bildirim göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "sadece_yuksek", title: "Sadece %80+ eşleşme" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "takip_sikligi",
      text: "Müşteri takip hatırlatmalarını ne sıklıkla göndereyim?",
      buttons: [
        { id: "gunluk", title: "Her gün" },
        { id: "haftalik", title: "Haftada bir" },
        { id: "sadece_kritik", title: "Sadece kritik" },
      ],
    },
    {
      key: "otomatik_aksiyon",
      text: "Hangi aksiyonları sormadan yapayım?",
      buttons: [
        { id: "hepsi_sor", title: "Her şeyi sor" },
        { id: "hatirlatma_otomatik", title: "Hatırlatma otomatik" },
        { id: "bildirim_otomatik", title: "Bildirimler otomatik" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `⏰ Müşteri soğuma uyarısı: ${config.soguma_suresi} gün\n`;
    summary += `🤝 Otomatik eşleştirme: ${config.eslestirme_otomatik === "evet" ? "Aktif" : config.eslestirme_otomatik === "sadece_yuksek" ? "%80+ eşleşme" : "Kapalı"}\n`;
    summary += `📅 Takip sıklığı: ${config.takip_sikligi === "gunluk" ? "Günlük" : config.takip_sikligi === "haftalik" ? "Haftalık" : "Sadece kritik"}\n`;
    summary += `⚡ Otonom aksiyon: ${config.otomatik_aksiyon === "hepsi_sor" ? "Her şeyi sorar" : config.otomatik_aksiyon === "hatirlatma_otomatik" ? "Hatırlatmalar otomatik" : "Bildirimler otomatik"}`;
    return summary;
  },
};

// ── 🎬 Medya Uzmanı ───────────────────────────────────────────────────

export const medyaSetup: AgentSetupFlow = {
  agentKey: "medya",
  agentName: "Medya Uzmanı",
  agentIcon: "🎬",
  greeting: "Merhaba! Ben medya uzmanıyım. Fotoğraf, ilan ve sosyal medya paylaşımlarınızı takip ederim.\n\nTercihlerinizi belirleyelim:",
  questions: [
    {
      key: "foto_uyari",
      text: "Fotoğrafsız mülkler için uyarı göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "ilan_metni",
      text: "Yeni mülk eklendiğinde otomatik ilan metni oluşturayım mı? (AI ile)",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "sor", title: "Önce sor" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "sosyal_medya",
      text: "Sosyal medya paylaşım önerisi ne sıklıkla gelsin?",
      buttons: [
        { id: "gunluk", title: "Her gün" },
        { id: "haftalik", title: "Haftada bir" },
        { id: "hayir", title: "Gönderme" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `📸 Fotoğraf uyarısı: ${config.foto_uyari === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `✍️ AI ilan metni: ${config.ilan_metni === "evet" ? "Otomatik" : config.ilan_metni === "sor" ? "Sorar" : "Kapalı"}\n`;
    summary += `📱 Sosyal medya önerisi: ${config.sosyal_medya === "gunluk" ? "Günlük" : config.sosyal_medya === "haftalik" ? "Haftalık" : "Kapalı"}`;
    return summary;
  },
};

// ── 📊 Pazar Analisti ──────────────────────────────────────────────────

export const pazarSetup: AgentSetupFlow = {
  agentKey: "pazar",
  agentName: "Pazar Analisti",
  agentIcon: "📊",
  greeting: "Merhaba! Ben pazar analistiyim. Bölge fiyatlarını, trendleri ve pazar fırsatlarını takip ederim.\n\nAnaliz tercihleriniz:",
  questions: [
    {
      key: "takip_bolgeleri",
      text: "Hangi bölgelerin fiyatlarını takip edeyim?\n\n💡 Örnek: _Kadıköy, Beşiktaş, Ataşehir_",
      freeText: true,
    },
    {
      key: "rapor_sikligi",
      text: "Pazar raporu ne sıklıkla gelsin?",
      buttons: [
        { id: "haftalik", title: "Haftalık" },
        { id: "aylik", title: "Aylık" },
        { id: "sadece_degisim", title: "Sadece değişimde" },
      ],
    },
    {
      key: "karsilastirma",
      text: "Portföyünüzdeki mülkleri pazar fiyatıyla karşılaştırayım mı?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "firsat_bildirimi",
      text: "Pazar ortalamasının altında ilan bulunca bildir?",
      buttons: [
        { id: "10", title: "%10+ altında" },
        { id: "20", title: "%20+ altında" },
        { id: "hayir", title: "Bildirme" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `📍 Takip bölgeleri: ${config.takip_bolgeleri}\n`;
    summary += `📋 Rapor sıklığı: ${config.rapor_sikligi === "haftalik" ? "Haftalık" : config.rapor_sikligi === "aylik" ? "Aylık" : "Sadece değişimde"}\n`;
    summary += `📊 Portföy karşılaştırma: ${config.karsilastirma === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `🔥 Fırsat bildirimi: ${config.firsat_bildirimi === "hayir" ? "Kapalı" : `%${config.firsat_bildirimi}+ altında`}`;
    return summary;
  },
};

// ── 📋 Sekreter ────────────────────────────────────────────────────────

export const sekreterSetup: AgentSetupFlow = {
  agentKey: "sekreter",
  agentName: "Sekreter",
  agentIcon: "📋",
  greeting: "Merhaba! Ben sekreterinizim. Takvim, hatırlatma, sözleşme ve günlük organizasyonunuzu yönetirim.\n\nÇalışma planımı belirleyelim:",
  questions: [
    {
      key: "brifing_saat",
      text: "Sabah brifingi saat kaçta göndereyim?",
      buttons: [
        { id: "07:30", title: "07:30" },
        { id: "08:30", title: "08:30" },
        { id: "09:00", title: "09:00" },
      ],
    },
    {
      key: "calisma_gunleri",
      text: "Hangi günler çalışayım?",
      buttons: [
        { id: "pazartesi-cuma", title: "Pzt-Cuma" },
        { id: "pazartesi-cumartesi", title: "Pzt-Cumartesi" },
        { id: "her-gun", title: "Her gün" },
      ],
    },
    {
      key: "hatirlatma_suresi",
      text: "Hatırlatmaları ne kadar önceden vereyim?",
      buttons: [
        { id: "1", title: "1 gün önce" },
        { id: "3", title: "3 gün önce" },
        { id: "7", title: "1 hafta önce" },
      ],
    },
    {
      key: "haftalik_rapor_gun",
      text: "Haftalık raporu hangi gün göndereyim?",
      buttons: [
        { id: "pazartesi", title: "Pazartesi" },
        { id: "cuma", title: "Cuma" },
        { id: "pazar", title: "Pazar" },
      ],
    },
    {
      key: "otonom_seviye",
      text: "Hangi aksiyonları sormadan yapayım?",
      buttons: [
        { id: "hepsi_sor", title: "Her şeyi sor" },
        { id: "hatirlatma", title: "Hatırlatmalar otomatik" },
        { id: "rutin", title: "Rutin işler otomatik" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `⏰ Sabah brifing: ${config.brifing_saat}\n`;
    summary += `📅 Çalışma günleri: ${config.calisma_gunleri === "pazartesi-cuma" ? "Pzt-Cuma" : config.calisma_gunleri === "pazartesi-cumartesi" ? "Pzt-Cumartesi" : "Her gün"}\n`;
    summary += `🔔 Hatırlatma süresi: ${config.hatirlatma_suresi} gün önce\n`;
    summary += `📊 Haftalık rapor: ${config.haftalik_rapor_gun}\n`;
    summary += `⚡ Otonom seviye: ${config.otonom_seviye === "hepsi_sor" ? "Her şeyi sorar" : config.otonom_seviye === "hatirlatma" ? "Hatırlatmalar otomatik" : "Rutin işler otomatik"}`;
    return summary;
  },
};
