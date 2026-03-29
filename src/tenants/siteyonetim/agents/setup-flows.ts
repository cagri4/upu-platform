/**
 * Site Yonetim SaaS — 4 Agent Setup Flows
 *
 * Each virtual employee asks preferences on first interaction.
 * Answers stored in agent_config, used during autonomous runs.
 *
 * Keys prefixed with "sy_" to avoid global SETUP_FLOWS collision
 * with other tenants (e.g. emlak sekreter vs siteyonetim sekreter).
 */

import type { AgentSetupFlow } from "@/platform/agents/setup";

// ── 💰 Muhasebeci ───────────────────────────────────────────────────

export const muhasebeciSetup: AgentSetupFlow = {
  agentKey: "sy_muhasebeci",
  agentName: "Muhasebeci",
  agentIcon: "💰",
  greeting: "Merhaba! Ben sitenizin muhasebecisiyim. Aidat takibi, gelir-gider analizi ve gecikme uyarıları yaparım.\n\nÖnce birkaç tercih belirleyelim:",
  questions: [
    {
      key: "tahsilat_sikligi",
      text: "Aidat hatırlatma sıklığı ne olsun?",
      buttons: [
        { id: "haftalik", title: "Haftalık" },
        { id: "aylik", title: "Aylık" },
        { id: "sadece_gecikince", title: "Sadece gecikince" },
      ],
    },
    {
      key: "gecikme_gun",
      text: "Gecikme kaç gün olunca uyarayım?",
      buttons: [
        { id: "7", title: "7 gün" },
        { id: "15", title: "15 gün" },
        { id: "30", title: "30 gün" },
      ],
    },
    {
      key: "rapor_sikligi",
      text: "Gelir-gider raporu ne sıklıkla gelsin?",
      buttons: [
        { id: "haftalik", title: "Haftalık" },
        { id: "aylik", title: "Aylık" },
      ],
    },
    {
      key: "gecikme_faizi",
      text: "Otomatik gecikme faizi hesaplansın mı?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `📅 Tahsilat hatırlatma: ${config.tahsilat_sikligi === "haftalik" ? "Haftalık" : config.tahsilat_sikligi === "aylik" ? "Aylık" : "Sadece gecikince"}\n`;
    summary += `⏰ Gecikme uyarı eşiği: ${config.gecikme_gun} gün\n`;
    summary += `📊 Gelir-gider raporu: ${config.rapor_sikligi === "haftalik" ? "Haftalık" : "Aylık"}\n`;
    summary += `💰 Gecikme faizi: ${config.gecikme_faizi === "evet" ? "Otomatik" : "Kapalı"}`;
    return summary;
  },
};

// ── 📝 Sekreter ─────────────────────────────────────────────────────

export const sySekreterSetup: AgentSetupFlow = {
  agentKey: "sy_sekreter",
  agentName: "Sekreter",
  agentIcon: "📝",
  greeting: "Merhaba! Ben sitenizin sekreterisiniz. Duyuru, toplantı ve sakin iletişimini yönetirim.\n\nTercihlerinizi belirleyelim:",
  questions: [
    {
      key: "duyuru_bildirimi",
      text: "Duyuru bildirimleri ne sıklıkla gelsin?",
      buttons: [
        { id: "her_zaman", title: "Her zaman" },
        { id: "sadece_onemli", title: "Sadece önemli" },
      ],
    },
    {
      key: "toplanti_hatirlatma",
      text: "Toplantı hatırlatma kaç gün önce?",
      buttons: [
        { id: "1", title: "1 gün önce" },
        { id: "3", title: "3 gün önce" },
        { id: "7", title: "1 hafta önce" },
      ],
    },
    {
      key: "sakin_bilgilendirme",
      text: "Sakinlere otomatik bilgilendirme yapayım mı?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "once_sor", title: "Önce sor" },
      ],
    },
    {
      key: "calisma_gunleri",
      text: "Çalışma günleri?",
      buttons: [
        { id: "pazartesi-cuma", title: "Pzt-Cuma" },
        { id: "her-gun", title: "Her gün" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `🔔 Duyuru bildirimi: ${config.duyuru_bildirimi === "her_zaman" ? "Her zaman" : "Sadece önemli"}\n`;
    summary += `📅 Toplantı hatırlatma: ${config.toplanti_hatirlatma} gün önce\n`;
    summary += `📢 Sakin bilgilendirme: ${config.sakin_bilgilendirme === "evet" ? "Otomatik" : "Önce sorar"}\n`;
    summary += `🗓 Çalışma günleri: ${config.calisma_gunleri === "pazartesi-cuma" ? "Pzt-Cuma" : "Her gün"}`;
    return summary;
  },
};

// ── 🔧 Teknisyen ───────────────────────────────────────────────────

export const teknisyenSetup: AgentSetupFlow = {
  agentKey: "sy_teknisyen",
  agentName: "Teknisyen",
  agentIcon: "🔧",
  greeting: "Merhaba! Ben sitenizin teknisyeniyim. Arıza takibi, bakım planlaması ve acil müdahaleleri yönetirim.\n\nTercihleriniz:",
  questions: [
    {
      key: "takip_sikligi",
      text: "Arıza takip sıklığı?",
      buttons: [
        { id: "gunluk", title: "Günlük" },
        { id: "haftalik", title: "Haftalık" },
      ],
    },
    {
      key: "uyari_gun",
      text: "Kaç gün çözülmeyen arıza için uyarayım?",
      buttons: [
        { id: "3", title: "3 gün" },
        { id: "7", title: "7 gün" },
        { id: "14", title: "14 gün" },
      ],
    },
    {
      key: "acil_bildirim",
      text: "Acil arızalarda anında bildirim?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "bakim_plani",
      text: "Bakım planı önerisi ne sıklıkla?",
      buttons: [
        { id: "aylik", title: "Aylık" },
        { id: "ceyreklik", title: "Çeyreklik" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `🔍 Arıza takip: ${config.takip_sikligi === "gunluk" ? "Günlük" : "Haftalık"}\n`;
    summary += `⏰ Uyarı eşiği: ${config.uyari_gun} gün\n`;
    summary += `🚨 Acil bildirim: ${config.acil_bildirim === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `🛠 Bakım planı: ${config.bakim_plani === "hayir" ? "Kapalı" : config.bakim_plani === "aylik" ? "Aylık" : "Çeyreklik"}`;
    return summary;
  },
};

// ── ⚖️ Hukuk Müşaviri ──────────────────────────────────────────────

export const hukukSetup: AgentSetupFlow = {
  agentKey: "sy_hukukMusaviri",
  agentName: "Hukuk Müşaviri",
  agentIcon: "⚖️",
  greeting: "Merhaba! Ben sitenizin hukuk müşaviriyim. KMK mevzuatı, yasal süreçler ve icra takiplerini yönetirim.\n\nTercihleriniz:",
  questions: [
    {
      key: "hukuki_esik",
      text: "Hukuki uyarı eşiği kaç ay gecikme?",
      buttons: [
        { id: "2", title: "2 ay" },
        { id: "3", title: "3 ay" },
        { id: "6", title: "6 ay" },
      ],
    },
    {
      key: "mevzuat_guncelleme",
      text: "KMK mevzuat güncellemeleri bildirilsin mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "icra_otomatik",
      text: "İcra takip önerisi otomatik mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "once_sor", title: "Önce sor" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `⚖️ Hukuki uyarı eşiği: ${config.hukuki_esik} ay\n`;
    summary += `📜 Mevzuat güncellemesi: ${config.mevzuat_guncelleme === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `📋 İcra takip önerisi: ${config.icra_otomatik === "evet" ? "Otomatik" : "Önce sorar"}`;
    return summary;
  },
};
