/**
 * Otel SaaS — 4 Agent Setup Flows
 *
 * Each virtual employee asks preferences on first interaction.
 * Answers stored in agent_config, used during autonomous runs.
 *
 * Keys prefixed with "otel_" to avoid global SETUP_FLOWS collision.
 */

import type { AgentSetupFlow } from "@/platform/agents/setup";

// ── 🛎️ Resepsiyon ──────────────────────────────────────────────────────

export const resepsiyonSetup: AgentSetupFlow = {
  agentKey: "otel_resepsiyon",
  agentName: "Resepsiyon",
  agentIcon: "🛎️",
  greeting: "Merhaba! Ben resepsiyon görevlisiyim. Misafir mesajlarını takip eder, eskalasyonları yönetir, iletişim akışını sağlarım.\n\nÖnce birkaç tercih belirleyelim:",
  questions: [
    {
      key: "mesaj_bildirim",
      text: "Cevaplanmamış misafir mesajları için bildirim göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "sadece_acil", title: "Sadece acil olanlar" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "eskalasyon_suresi",
      text: "Cevaplanmamış mesaj kaç dakika sonra eskalasyon olsun?",
      buttons: [
        { id: "15", title: "15 dakika" },
        { id: "30", title: "30 dakika" },
        { id: "60", title: "1 saat" },
      ],
    },
    {
      key: "checkin_hazirlik",
      text: "Günlük check-in hazırlık listesi göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "vip_bildirim",
      text: "VIP misafir geldiğinde özel bildirim göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `💬 Mesaj bildirimi: ${config.mesaj_bildirim === "evet" ? "Aktif" : config.mesaj_bildirim === "sadece_acil" ? "Sadece acil" : "Kapalı"}\n`;
    summary += `⏰ Eskalasyon süresi: ${config.eskalasyon_suresi} dakika\n`;
    summary += `📋 Check-in hazırlık listesi: ${config.checkin_hazirlik === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `👑 VIP bildirimi: ${config.vip_bildirim === "evet" ? "Aktif" : "Kapalı"}`;
    return summary;
  },
};

// ── 📅 Rezervasyon Uzmanı ───────────────────────────────────────────────

export const rezervasyonSetup: AgentSetupFlow = {
  agentKey: "otel_rezervasyon",
  agentName: "Rezervasyon Uzmanı",
  agentIcon: "📅",
  greeting: "Merhaba! Ben rezervasyon uzmanıyım. Doluluk takibi, fiyat optimizasyonu ve check-in/out yönetimi yaparım.\n\nTercihlerinizi belirleyelim:",
  questions: [
    {
      key: "doluluk_esigi",
      text: "Doluluk oranı yüzde kaçın altına düşünce uyarayım?",
      buttons: [
        { id: "50", title: "%50" },
        { id: "60", title: "%60" },
        { id: "70", title: "%70" },
      ],
    },
    {
      key: "fiyat_onerisi",
      text: "Düşük doluluklarda otomatik fiyat önerisi yapayım mı?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "once_sor", title: "Önce sor" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "gunluk_ozet",
      text: "Günlük check-in/out özeti göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "iptal_bildirimi",
      text: "Rezervasyon iptali olduğunda bildirim göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `📊 Doluluk uyarı eşiği: %${config.doluluk_esigi}\n`;
    summary += `💰 Fiyat önerisi: ${config.fiyat_onerisi === "evet" ? "Otomatik" : config.fiyat_onerisi === "once_sor" ? "Sorar" : "Kapalı"}\n`;
    summary += `📋 Günlük özet: ${config.gunluk_ozet === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `❌ İptal bildirimi: ${config.iptal_bildirimi === "evet" ? "Aktif" : "Kapalı"}`;
    return summary;
  },
};

// ── 🧹 Kat Hizmetleri ──────────────────────────────────────────────────

export const katHizmetleriSetup: AgentSetupFlow = {
  agentKey: "otel_katHizmetleri",
  agentName: "Kat Hizmetleri",
  agentIcon: "🧹",
  greeting: "Merhaba! Ben kat hizmetleri sorumlusuyum. Oda temizlik durumu, bakım ihtiyaçları ve görev atamalarını yönetirim.\n\nTercihlerinizi belirleyelim:",
  questions: [
    {
      key: "temizlik_bildirimi",
      text: "Temizlenmemiş oda uyarısı göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "sadece_checkin", title: "Sadece check-in öncesi" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "bakim_uyari",
      text: "Bakım gerektiren odalar için uyarı göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "gorev_otomatik",
      text: "Check-out sonrası otomatik temizlik görevi oluşturayım mı?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "once_sor", title: "Önce sor" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "gunluk_rapor",
      text: "Günlük oda durumu raporu göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `🧹 Temizlik bildirimi: ${config.temizlik_bildirimi === "evet" ? "Aktif" : config.temizlik_bildirimi === "sadece_checkin" ? "Sadece check-in öncesi" : "Kapalı"}\n`;
    summary += `🔧 Bakım uyarısı: ${config.bakim_uyari === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `⚡ Otomatik temizlik görevi: ${config.gorev_otomatik === "evet" ? "Aktif" : config.gorev_otomatik === "once_sor" ? "Sorar" : "Kapalı"}\n`;
    summary += `📊 Günlük rapor: ${config.gunluk_rapor === "evet" ? "Aktif" : "Kapalı"}`;
    return summary;
  },
};

// ── ⭐ Misafir Deneyimi ─────────────────────────────────────────────────

export const misafirDeneyimiSetup: AgentSetupFlow = {
  agentKey: "otel_misafirDeneyimi",
  agentName: "Misafir Deneyimi",
  agentIcon: "⭐",
  greeting: "Merhaba! Ben misafir deneyimi sorumlusuyum. Yorumları, özel istekleri ve memnuniyet analizini yönetirim.\n\nTercihlerinizi belirleyelim:",
  questions: [
    {
      key: "yorum_bildirimi",
      text: "Düşük puanlı yorumlar için bildirim göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "puan_esigi",
      text: "Kaç puan ve altı düşük sayılsın?",
      buttons: [
        { id: "2", title: "2 ve altı" },
        { id: "3", title: "3 ve altı" },
      ],
    },
    {
      key: "ozel_istek_bildirimi",
      text: "Yeni özel istek geldiğinde bildirim göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
    {
      key: "haftalik_memnuniyet",
      text: "Haftalık memnuniyet özeti göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `📝 Yorum bildirimi: ${config.yorum_bildirimi === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `⭐ Düşük puan eşiği: ${config.puan_esigi} ve altı\n`;
    summary += `🎁 Özel istek bildirimi: ${config.ozel_istek_bildirimi === "evet" ? "Aktif" : "Kapalı"}\n`;
    summary += `📊 Haftalık memnuniyet: ${config.haftalik_memnuniyet === "evet" ? "Aktif" : "Kapalı"}`;
    return summary;
  },
};
