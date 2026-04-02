/**
 * Market SaaS — 3 Agent Setup Flows
 *
 * Each virtual employee asks preferences on first interaction.
 * Answers stored in agent_config, used during autonomous runs.
 *
 * Keys prefixed with "mkt_" to avoid global SETUP_FLOWS collision.
 */

import type { AgentSetupFlow } from "@/platform/agents/setup";

// ── 📦 Stok Sorumlusu ──────────────────────────────────────────────────

export const stokSorumlusuSetup: AgentSetupFlow = {
  agentKey: "mkt_stokSorumlusu",
  agentName: "Stok Sorumlusu",
  agentIcon: "📦",
  greeting: "Merhaba! Ben stok sorumlusuyum. Urunlerinizi takip eder, dusuk stok uyarisi verir, son kullanma tarihlerini izlerim.\n\nOnce birkac tercih belirleyelim:",
  questions: [
    {
      key: "dusuk_stok_esigi",
      text: "Dusuk stok uyarisi kac adet altinda gelsin?",
      buttons: [
        { id: "5", title: "5 adet" },
        { id: "10", title: "10 adet" },
        { id: "20", title: "20 adet" },
      ],
    },
    {
      key: "skt_uyari_gun",
      text: "Son kullanma tarihi yaklasan urunler icin kac gun once uyarayim?",
      buttons: [
        { id: "3", title: "3 gun once" },
        { id: "7", title: "7 gun once" },
        { id: "14", title: "14 gun once" },
      ],
    },
    {
      key: "otomatik_siparis",
      text: "Dusuk stoklu urunler icin otomatik siparis onerisi yapayim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "sadece_kritik", title: "Sadece kritik olanlar" },
        { id: "hayir", title: "Hayir" },
      ],
    },
    {
      key: "stok_rapor_sikligi",
      text: "Stok durum raporu ne siklikla gelsin?",
      buttons: [
        { id: "gunluk", title: "Her gun" },
        { id: "haftalik", title: "Haftada bir" },
        { id: "sadece_uyari", title: "Sadece uyarilarda" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `Dusuk stok esigi: ${config.dusuk_stok_esigi} adet\n`;
    summary += `SKT uyari suresi: ${config.skt_uyari_gun} gun once\n`;
    summary += `Otomatik siparis onerisi: ${config.otomatik_siparis === "evet" ? "Aktif" : config.otomatik_siparis === "sadece_kritik" ? "Sadece kritik" : "Kapali"}\n`;
    summary += `Stok rapor sikligi: ${config.stok_rapor_sikligi === "gunluk" ? "Gunluk" : config.stok_rapor_sikligi === "haftalik" ? "Haftalik" : "Sadece uyarilarda"}`;
    return summary;
  },
};

// ── 📋 Siparis Yoneticisi ──────────────────────────────────────────────

export const siparisYoneticisiSetup: AgentSetupFlow = {
  agentKey: "mkt_siparisYoneticisi",
  agentName: "Siparis Yoneticisi",
  agentIcon: "📋",
  greeting: "Merhaba! Ben siparis yoneticisiyim. Tedarikci iliskilerinizi yonetir, siparisleri takip eder, gecikmeleri bildiririm.\n\nBirkac soru:",
  questions: [
    {
      key: "gecikme_esigi",
      text: "Bir siparis kac gun icinde teslim edilmezse uyarayim?",
      buttons: [
        { id: "3", title: "3 gun" },
        { id: "5", title: "5 gun" },
        { id: "7", title: "7 gun" },
      ],
    },
    {
      key: "otomatik_onay",
      text: "Hangi siparisleri sormadan onaylayayim?",
      buttons: [
        { id: "hepsi_sor", title: "Her seyi sor" },
        { id: "kucuk", title: "Kucuk siparisler" },
        { id: "taninan", title: "Taninan tedarikciler" },
      ],
    },
    {
      key: "tedarikci_iletisim",
      text: "Tedarikci ile iletisimde neler yapayim?",
      buttons: [
        { id: "sadece_uyar", title: "Sadece beni uyar" },
        { id: "taslak_hazirla", title: "Mesaj taslagi hazirla" },
        { id: "otomatik", title: "Otomatik bildirim" },
      ],
    },
    {
      key: "siparis_ozet_sikligi",
      text: "Siparis durum ozeti ne siklikla gelsin?",
      buttons: [
        { id: "gunluk", title: "Her gun" },
        { id: "haftalik", title: "Haftada bir" },
        { id: "sadece_degisim", title: "Sadece degisimde" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `Gecikme uyari esigi: ${config.gecikme_esigi} gun\n`;
    summary += `Otomatik onay: ${config.otomatik_onay === "hepsi_sor" ? "Her seyi sorar" : config.otomatik_onay === "kucuk" ? "Kucuk siparisler otomatik" : "Taninan tedarikciler otomatik"}\n`;
    summary += `Tedarikci iletisimi: ${config.tedarikci_iletisim === "sadece_uyar" ? "Sadece uyari" : config.tedarikci_iletisim === "taslak_hazirla" ? "Taslak hazirlar" : "Otomatik bildirim"}\n`;
    summary += `Siparis ozet sikligi: ${config.siparis_ozet_sikligi === "gunluk" ? "Gunluk" : config.siparis_ozet_sikligi === "haftalik" ? "Haftalik" : "Sadece degisimde"}`;
    return summary;
  },
};

// ── 💰 Finans Analisti ──────────────────────────────────────────────────

export const finansAnalistiSetup: AgentSetupFlow = {
  agentKey: "mkt_finansAnalisti",
  agentName: "Finans Analisti",
  agentIcon: "💰",
  greeting: "Merhaba! Ben finans analistiyim. Satis performansinizi analiz eder, fiyat optimizasyonu onerir, kampanya stratejileri olustururum.\n\nAnaliz tercihleriniz:",
  questions: [
    {
      key: "rapor_sikligi",
      text: "Satis raporu ne siklikla gelsin?",
      buttons: [
        { id: "gunluk", title: "Her gun" },
        { id: "haftalik", title: "Haftada bir" },
        { id: "aylik", title: "Ayda bir" },
      ],
    },
    {
      key: "fiyat_onerisi",
      text: "Satis verilerine gore fiyat optimizasyonu onereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "sadece_buyuk", title: "Sadece buyuk farklar" },
        { id: "hayir", title: "Hayir" },
      ],
    },
    {
      key: "kampanya_onerisi",
      text: "SKT yaklasan veya yavassatan urunler icin otomatik kampanya onereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "sor", title: "Once sor" },
        { id: "hayir", title: "Hayir" },
      ],
    },
    {
      key: "kar_marji_uyari",
      text: "Kar marji dusuk urunlerde uyari gondereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayir" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `Satis rapor sikligi: ${config.rapor_sikligi === "gunluk" ? "Gunluk" : config.rapor_sikligi === "haftalik" ? "Haftalik" : "Aylik"}\n`;
    summary += `Fiyat optimizasyonu: ${config.fiyat_onerisi === "evet" ? "Aktif" : config.fiyat_onerisi === "sadece_buyuk" ? "Sadece buyuk farklar" : "Kapali"}\n`;
    summary += `Kampanya onerisi: ${config.kampanya_onerisi === "evet" ? "Otomatik" : config.kampanya_onerisi === "sor" ? "Sorar" : "Kapali"}\n`;
    summary += `Kar marji uyarisi: ${config.kar_marji_uyari === "evet" ? "Aktif" : "Kapali"}`;
    return summary;
  },
};
