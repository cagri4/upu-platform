/**
 * Muhasebe SaaS — 4 Agent Setup Flows
 *
 * Each virtual employee asks preferences on first interaction.
 * Answers stored in agent_config, used during autonomous runs.
 *
 * Keys prefixed with "muh_" to avoid global SETUP_FLOWS collision.
 */

import type { AgentSetupFlow } from "@/platform/agents/setup";

// ── 📄 Fatura Isleme Uzmani ──────────────────────────────────────────

export const faturaUzmaniSetup: AgentSetupFlow = {
  agentKey: "muh_faturaUzmani",
  agentName: "Fatura Isleme Uzmani",
  agentIcon: "📄",
  greeting: "Merhaba! Ben fatura isleme uzmaniyim. e-Faturalarinizi takip eder, hesap kodu onerir, eksik bilgileri tespit ederim.\n\nOnce birkac tercih belirleyelim:",
  questions: [
    {
      key: "fatura_turu",
      text: "Hangi tur faturalarla calisiyorsunuz?",
      buttons: [
        { id: "hepsi", title: "Hepsi" },
        { id: "alis", title: "Alis Faturalari" },
        { id: "satis", title: "Satis Faturalari" },
      ],
    },
    {
      key: "hesap_kodu_oneri",
      text: "Faturalar icin otomatik hesap kodu onerisi yapayim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "sadece_yeni", title: "Sadece yeni firmalar" },
        { id: "hayir", title: "Hayir" },
      ],
    },
    {
      key: "eksik_veri_uyari",
      text: "Eksik bilgili faturalar (VKN, tarih vb.) icin uyari gondereyim mi?",
      buttons: [
        { id: "evet", title: "Evet, uyar" },
        { id: "hayir", title: "Hayir" },
      ],
    },
    {
      key: "aylik_rapor",
      text: "Her ay sonu otomatik fatura ozeti gondereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayir" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `Fatura turu: ${config.fatura_turu === "hepsi" ? "Tumu" : config.fatura_turu}\n`;
    summary += `Hesap kodu onerisi: ${config.hesap_kodu_oneri === "evet" ? "Aktif" : config.hesap_kodu_oneri === "sadece_yeni" ? "Sadece yeni firmalar" : "Kapali"}\n`;
    summary += `Eksik veri uyarisi: ${config.eksik_veri_uyari === "evet" ? "Aktif" : "Kapali"}\n`;
    summary += `Aylik fatura raporu: ${config.aylik_rapor === "evet" ? "Aktif" : "Kapali"}`;
    return summary;
  },
};

// ── 📅 Sekreter ──────────────────────────────────────────────────────

export const muhSekreterSetup: AgentSetupFlow = {
  agentKey: "muh_sekreter",
  agentName: "Sekreter",
  agentIcon: "📅",
  greeting: "Merhaba! Ben sekreterinizim. Beyanname takvimini takip eder, mukellefleri organize eder, randevularinizi yonetirim.\n\nCalisma planimi belirleyelim:",
  questions: [
    {
      key: "brifing_saat",
      text: "Sabah brifingini saat kacta gondereyim?",
      buttons: [
        { id: "07:30", title: "07:30" },
        { id: "08:30", title: "08:30" },
        { id: "09:00", title: "09:00" },
      ],
    },
    {
      key: "deadline_hatirlatma",
      text: "Beyanname deadlinelari ne kadar onceden hatirlatayim?",
      buttons: [
        { id: "3", title: "3 gun once" },
        { id: "5", title: "5 gun once" },
        { id: "7", title: "1 hafta once" },
      ],
    },
    {
      key: "calisma_gunleri",
      text: "Hangi gunler calisayim?",
      buttons: [
        { id: "pazartesi-cuma", title: "Pzt-Cuma" },
        { id: "pazartesi-cumartesi", title: "Pzt-Cumartesi" },
        { id: "her-gun", title: "Her gun" },
      ],
    },
    {
      key: "otonom_seviye",
      text: "Hangi aksiyonlari sormadan yapayim?",
      buttons: [
        { id: "hepsi_sor", title: "Her seyi sor" },
        { id: "hatirlatma", title: "Hatirlatmalar otomatik" },
        { id: "rutin", title: "Rutin isler otomatik" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `Sabah brifing: ${config.brifing_saat}\n`;
    summary += `Deadline hatirlatma: ${config.deadline_hatirlatma} gun once\n`;
    summary += `Calisma gunleri: ${config.calisma_gunleri === "pazartesi-cuma" ? "Pzt-Cuma" : config.calisma_gunleri === "pazartesi-cumartesi" ? "Pzt-Cumartesi" : "Her gun"}\n`;
    summary += `Otonom seviye: ${config.otonom_seviye === "hepsi_sor" ? "Her seyi sorar" : config.otonom_seviye === "hatirlatma" ? "Hatirlatmalar otomatik" : "Rutin isler otomatik"}`;
    return summary;
  },
};

// ── 🧮 Vergi Uzmani ──────────────────────────────────────────────────

export const vergiUzmaniSetup: AgentSetupFlow = {
  agentKey: "muh_vergiUzmani",
  agentName: "Vergi Uzmani",
  agentIcon: "🧮",
  greeting: "Merhaba! Ben vergi uzmaniyim. KDV, gelir vergisi, kurumlar vergisi hesaplamalari yapar, beyanname durumlarini takip ederim.\n\nTercihlerinizi belirleyelim:",
  questions: [
    {
      key: "vergi_turleri",
      text: "Hangi vergi turleriyle calisiyorsunuz?",
      buttons: [
        { id: "hepsi", title: "Hepsi" },
        { id: "kdv_gelir", title: "KDV + Gelir V." },
        { id: "kurumlar", title: "Kurumlar V." },
      ],
    },
    {
      key: "oran_degisim_uyari",
      text: "Vergi oranlarinda degisiklik olursa uyarayim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayir" },
      ],
    },
    {
      key: "beyanname_kontrol",
      text: "Beyanname oncesi otomatik tutarsizlik kontrolu yapayim mi?",
      buttons: [
        { id: "evet", title: "Evet, yap" },
        { id: "hayir", title: "Hayir" },
      ],
    },
    {
      key: "rapor_sikligi",
      text: "Vergi raporu ne siklikla gelsin?",
      buttons: [
        { id: "haftalik", title: "Haftalik" },
        { id: "aylik", title: "Aylik" },
        { id: "sadece_istek", title: "Sadece istek uzerine" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `Vergi turleri: ${config.vergi_turleri === "hepsi" ? "Tumu" : config.vergi_turleri}\n`;
    summary += `Oran degisim uyarisi: ${config.oran_degisim_uyari === "evet" ? "Aktif" : "Kapali"}\n`;
    summary += `Beyanname kontrol: ${config.beyanname_kontrol === "evet" ? "Aktif" : "Kapali"}\n`;
    summary += `Rapor sikligi: ${config.rapor_sikligi === "haftalik" ? "Haftalik" : config.rapor_sikligi === "aylik" ? "Aylik" : "Istek uzerine"}`;
    return summary;
  },
};

// ── 💰 Tahsilat Uzmani ──────────────────────────────────────────────

export const tahsilatUzmaniSetup: AgentSetupFlow = {
  agentKey: "muh_tahsilatUzmani",
  agentName: "Tahsilat Uzmani",
  agentIcon: "💰",
  greeting: "Merhaba! Ben tahsilat uzmaniyim. Alacaklari takip eder, vadesi gecen odemeleri bildirir, nakit akis tahminleri yaparim.\n\nCalisma tercihleriniz:",
  questions: [
    {
      key: "gecikme_esigi",
      text: "Vade gectikten kac gun sonra uyarayim?",
      buttons: [
        { id: "1", title: "1 gun" },
        { id: "3", title: "3 gun" },
        { id: "7", title: "7 gun" },
      ],
    },
    {
      key: "otomatik_hatirlatma",
      text: "Geciken odemeler icin otomatik hatirlatma olusturayim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "sor", title: "Once sor" },
        { id: "hayir", title: "Hayir" },
      ],
    },
    {
      key: "nakit_akis_rapor",
      text: "Haftalik nakit akis raporu gondereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayir" },
      ],
    },
    {
      key: "risk_uyari",
      text: "Yuksek riskli musteriler icin otomatik uyari gondereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayir" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `Gecikme uyari esigi: ${config.gecikme_esigi} gun\n`;
    summary += `Otomatik hatirlatma: ${config.otomatik_hatirlatma === "evet" ? "Aktif" : config.otomatik_hatirlatma === "sor" ? "Sorar" : "Kapali"}\n`;
    summary += `Nakit akis raporu: ${config.nakit_akis_rapor === "evet" ? "Haftalik" : "Kapali"}\n`;
    summary += `Risk uyarisi: ${config.risk_uyari === "evet" ? "Aktif" : "Kapali"}`;
    return summary;
  },
};
