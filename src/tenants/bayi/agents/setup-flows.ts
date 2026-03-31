/**
 * Bayi SaaS — 8 Agent Setup Flows
 *
 * Each virtual employee asks preferences on first interaction.
 * Answers stored in agent_config, used during autonomous runs.
 *
 * Keys prefixed with "bayi_" to avoid global SETUP_FLOWS collision
 * with other tenants (e.g. emlak muhasebeci vs bayi muhasebeci).
 */

import type { AgentSetupFlow } from "@/platform/agents/setup";

// ── 📊 Asistan ──────────────────────────────────────────────────────

export const asistanSetup: AgentSetupFlow = {
  agentKey: "bayi_asistan",
  agentName: "Asistan",
  agentIcon: "📊",
  greeting: "Merhaba! Ben bayi yönetim asistanınızım. Günlük özet, kritik uyarılar ve performans takibi yaparım.\n\nÖnce birkaç tercih belirleyelim:",
  questions: [
    {
      key: "brifing_saat",
      text: "Sabah brifingini saat kaçta göndereyim?",
      buttons: [
        { id: "07:30", title: "07:30" },
        { id: "08:30", title: "08:30" },
        { id: "09:00", title: "09:00" },
      ],
    },
    {
      key: "rapor_sikligi",
      text: "Rapor sıklığı ne olsun?",
      buttons: [
        { id: "gunluk", title: "Günlük" },
        { id: "haftalik", title: "Haftalık" },
      ],
    },
    {
      key: "metrikler",
      text: "Hangi metrikleri takip edeyim?",
      buttons: [
        { id: "hepsi", title: "Hepsi" },
        { id: "satis", title: "Satış" },
        { id: "stok_tahsilat", title: "Stok + Tahsilat" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `⏰ Brifing saati: ${config.brifing_saat}\n`;
    summary += `📅 Rapor sıklığı: ${config.rapor_sikligi === "gunluk" ? "Günlük" : "Haftalık"}\n`;
    summary += `📊 Metrikler: ${config.metrikler === "hepsi" ? "Tümü" : config.metrikler === "satis" ? "Satış" : "Stok + Tahsilat"}`;
    return summary;
  },
};

// ── 💰 Satış Müdürü ─────────────────────────────────────────────────

export const satisMuduruSetup: AgentSetupFlow = {
  agentKey: "bayi_satisMuduru",
  agentName: "Satış Müdürü",
  agentIcon: "💰",
  greeting: "Merhaba! Ben satış müdürünüzüm. Kampanya önerileri, hedef takibi ve bayi performans analizi yaparım.\n\nTercihlerinizi belirleyelim:",
  questions: [
    {
      key: "kampanya_bildirimi",
      text: "Kampanya önerisi göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "performans_esigi",
      text: "Performans uyarı eşiği ne olsun? (Hedefe ulaşma oranı)",
      buttons: [
        { id: "70", title: "%70" },
        { id: "80", title: "%80" },
        { id: "90", title: "%90" },
      ],
    },
    {
      key: "segment_sikligi",
      text: "Segment analizi ne sıklıkla?",
      buttons: [
        { id: "haftalik", title: "Haftalık" },
        { id: "aylik", title: "Aylık" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `📢 Kampanya bildirimi: ${config.kampanya_bildirimi === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `📊 Performans eşiği: %${config.performans_esigi}\n`;
    summary += `📈 Segment analizi: ${config.segment_sikligi === "haftalik" ? "Haftalık" : "Aylık"}`;
    return summary;
  },
};

// ── 🤝 Satış Temsilcisi ─────────────────────────────────────────────

export const satisTemsilcisiSetup: AgentSetupFlow = {
  agentKey: "bayi_satisTemsilcisi",
  agentName: "Satış Temsilcisi",
  agentIcon: "🤝",
  greeting: "Merhaba! Ben saha satış temsilcinizim. Ziyaret planları, sipariş takibi ve bayi sorunlarını yönetirim.\n\nTercihleriniz:",
  questions: [
    {
      key: "ziyaret_hatirlatma",
      text: "Ziyaret hatırlatması ne kadar önce gelsin?",
      buttons: [
        { id: "1", title: "1 gün önce" },
        { id: "3", title: "3 gün önce" },
      ],
    },
    {
      key: "siparis_bildirimi",
      text: "Sipariş bildirimi nasıl olsun?",
      buttons: [
        { id: "hepsi", title: "Hepsi" },
        { id: "sadece_buyuk", title: "Sadece büyük" },
      ],
    },
    {
      key: "gunluk_ziyaret_hedefi",
      text: "Günlük ziyaret hedefiniz kaç?",
      buttons: [
        { id: "3", title: "3 ziyaret" },
        { id: "5", title: "5 ziyaret" },
        { id: "7", title: "7 ziyaret" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `🔔 Ziyaret hatırlatma: ${config.ziyaret_hatirlatma} gün önce\n`;
    summary += `📦 Sipariş bildirimi: ${config.siparis_bildirimi === "hepsi" ? "Tümü" : "Sadece büyük siparişler"}\n`;
    summary += `🎯 Günlük ziyaret hedefi: ${config.gunluk_ziyaret_hedefi}`;
    return summary;
  },
};

// ── 💳 Muhasebeci ───────────────────────────────────────────────────

export const muhasebeciSetup: AgentSetupFlow = {
  agentKey: "bayi_muhasebeci",
  agentName: "Muhasebeci",
  agentIcon: "💳",
  greeting: "Merhaba! Ben muhasebeciyim. Alacak takibi, fatura kontrolü ve bakiye raporlaması yaparım.\n\nTercihlerinizi belirleyelim:",
  questions: [
    {
      key: "gecikme_esigi",
      text: "Gecikme uyarı eşiği kaç gün olsun?",
      buttons: [
        { id: "7", title: "7 gün" },
        { id: "15", title: "15 gün" },
        { id: "30", title: "30 gün" },
      ],
    },
    {
      key: "bakiye_rapor_sikligi",
      text: "Bakiye raporu ne sıklıkla gelsin?",
      buttons: [
        { id: "gunluk", title: "Günlük" },
        { id: "haftalik", title: "Haftalık" },
      ],
    },
    {
      key: "otomatik_hatirlatma",
      text: "Geciken bayilere otomatik hatırlatma göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `⏰ Gecikme uyarı eşiği: ${config.gecikme_esigi} gün\n`;
    summary += `📊 Bakiye raporu: ${config.bakiye_rapor_sikligi === "gunluk" ? "Günlük" : "Haftalık"}\n`;
    summary += `🔔 Otomatik hatırlatma: ${config.otomatik_hatirlatma === "evet" ? "Aktif" : "Kapalı"}`;
    return summary;
  },
};

// ── 📋 Tahsildar ────────────────────────────────────────────────────

export const tahsildarSetup: AgentSetupFlow = {
  agentKey: "bayi_tahsildar",
  agentName: "Tahsildar",
  agentIcon: "📋",
  greeting: "Merhaba! Ben tahsildarınızım. Vade takibi, tahsilat planlaması ve risk değerlendirmesi yaparım.\n\nTercihleriniz:",
  questions: [
    {
      key: "vade_uyari_suresi",
      text: "Vade uyarısı kaç gün önce gelsin?",
      buttons: [
        { id: "3", title: "3 gün önce" },
        { id: "7", title: "7 gün önce" },
        { id: "14", title: "14 gün önce" },
      ],
    },
    {
      key: "otomatik_hatirlatma",
      text: "Otomatik vade hatırlatması göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "once_sor", title: "Önce sor" },
      ],
    },
    {
      key: "risk_esigi",
      text: "Risk uyarısı kaç gün gecikme sonrası?",
      buttons: [
        { id: "30", title: "30 gün" },
        { id: "60", title: "60 gün" },
        { id: "90", title: "90 gün" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `⏰ Vade uyarısı: ${config.vade_uyari_suresi} gün önce\n`;
    summary += `🔔 Otomatik hatırlatma: ${config.otomatik_hatirlatma === "evet" ? "Aktif" : "Önce sorar"}\n`;
    summary += `⚠️ Risk eşiği: ${config.risk_esigi} gün gecikme`;
    return summary;
  },
};

// ── 📦 Depocu ───────────────────────────────────────────────────────

export const depocuSetup: AgentSetupFlow = {
  agentKey: "bayi_depocu",
  agentName: "Depocu",
  agentIcon: "📦",
  greeting: "Merhaba! Ben depocuyum. Stok durumu, kritik stok uyarıları ve tedarik süreçlerini yönetirim.\n\nTercihleriniz:",
  questions: [
    {
      key: "kritik_stok_bildirimi",
      text: "Kritik stok uyarısı göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "stok_kontrol_sikligi",
      text: "Stok kontrol sıklığı ne olsun?",
      buttons: [
        { id: "gunluk", title: "Günlük" },
        { id: "haftalik", title: "Haftalık" },
      ],
    },
    {
      key: "otomatik_satinalma",
      text: "Kritik stokta otomatik satın alma önerisi yapayım mı?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "once_sor", title: "Önce sor" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `🔔 Kritik stok bildirimi: ${config.kritik_stok_bildirimi === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `📅 Stok kontrol sıklığı: ${config.stok_kontrol_sikligi === "gunluk" ? "Günlük" : "Haftalık"}\n`;
    summary += `🛒 Otomatik satın alma: ${config.otomatik_satinalma === "evet" ? "Aktif" : "Önce sorar"}`;
    return summary;
  },
};

// ── 🚛 Lojistikçi ──────────────────────────────────────────────────

export const lojistikciSetup: AgentSetupFlow = {
  agentKey: "bayi_lojistikci",
  agentName: "Lojistikçi",
  agentIcon: "🚛",
  greeting: "Merhaba! Ben lojistikçiyim. Teslimat planlaması, gecikme takibi ve rota optimizasyonu yaparım.\n\nTercihleriniz:",
  questions: [
    {
      key: "teslimat_bildirimi",
      text: "Teslimat durumu bildirimi göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "gecikme_esigi",
      text: "Gecikme uyarısı kaç gün sonra?",
      buttons: [
        { id: "1", title: "1 gün" },
        { id: "3", title: "3 gün" },
        { id: "5", title: "5 gün" },
      ],
    },
    {
      key: "rota_optimizasyonu",
      text: "Rota optimizasyonu önerisi yapayım mı?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `🔔 Teslimat bildirimi: ${config.teslimat_bildirimi === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `⏰ Gecikme eşiği: ${config.gecikme_esigi} gün\n`;
    summary += `🗺 Rota optimizasyonu: ${config.rota_optimizasyonu === "evet" ? "Aktif" : "Kapalı"}`;
    return summary;
  },
};

// ── 🏷 Ürün Yöneticisi ─────────────────────────────────────────────

export const urunYoneticisiSetup: AgentSetupFlow = {
  agentKey: "bayi_urunYoneticisi",
  agentName: "Ürün Yöneticisi",
  agentIcon: "🏷",
  greeting: "Merhaba! Ben ürün yöneticisiyim. Katalog yönetimi, fiyat güncellemeleri ve ürün analizi yaparım.\n\nTercihleriniz:",
  questions: [
    {
      key: "fiyat_degisim_bildirimi",
      text: "Fiyat değişim bildirimi göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "katalog_guncelleme_sikligi",
      text: "Katalog güncelleme sıklığı ne olsun?",
      buttons: [
        { id: "haftalik", title: "Haftalık" },
        { id: "aylik", title: "Aylık" },
      ],
    },
    {
      key: "pasif_urun_uyarisi",
      text: "Pasif ürün uyarısı göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `💰 Fiyat değişim bildirimi: ${config.fiyat_degisim_bildirimi === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `📋 Katalog güncelleme: ${config.katalog_guncelleme_sikligi === "haftalik" ? "Haftalık" : "Aylık"}\n`;
    summary += `⚠️ Pasif ürün uyarısı: ${config.pasif_urun_uyarisi === "evet" ? "Aktif" : "Kapalı"}`;
    return summary;
  },
};
