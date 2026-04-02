/**
 * Otel SaaS — Onboarding Flow
 *
 * Steps:
 *   1. hotel_name   — Otel adı (serbest metin)
 *   2. location     — Konum/şehir (serbest metin)
 *   3. room_count   — Oda sayısı (seçenekli)
 *   4. briefing     — Günlük brifing göndereyim mi? (Evet/Hayır)
 */

import type { OnboardingFlow } from "@/platform/whatsapp/onboarding";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export const otelOnboardingFlow: OnboardingFlow = {
  tenantKey: "otel",
  welcomeMessage: "",  // Sent separately in webhook after invite

  steps: [
    {
      key: "hotel_name",
      question: "Otelinizin adı nedir?\n\n💡 Örnek: _Grand Otel_, _Sahil Resort_\n\n🔒 Verileriniz güvenli şekilde saklanır.",
    },
    {
      key: "location",
      question: "Oteliniz hangi şehir/bölgede?\n\n💡 Örnek: _Antalya Kemer_, _İstanbul Beyoğlu_",
    },
    {
      key: "room_count",
      question: "Otelinizde yaklaşık kaç oda var?",
      buttons: [
        { id: "onb:1-20", title: "1-20 oda" },
        { id: "onb:21-50", title: "21-50 oda" },
        { id: "onb:50+", title: "50+ oda" },
      ],
    },
    {
      key: "briefing",
      question: "Her sabah size günlük brifing göndereyim mi?\n\nBrifing: bugünkü check-in/out, doluluk durumu, temizlik görevleri ve okunmamış misafir mesajlarını içerir.",
      buttons: [
        { id: "onb:evet", title: "Evet, gönder" },
        { id: "onb:hayir", title: "Hayır, gerek yok" },
      ],
    },
  ],

  onFinish: async (ctx, data) => {
    const supabase = getServiceClient();

    // Save hotel info to profile metadata
    await supabase.from("profiles").update({
      metadata: {
        hotel_name: data.hotel_name || null,
        location: data.location || null,
        room_count: data.room_count || null,
        briefing_enabled: data.briefing === "evet",
        onboarding_completed: true,
      },
    }).eq("id", ctx.userId);

    // Build completion message
    let msg = "✅ *Kurulum tamamlandı!*\n\n";
    if (data.hotel_name) msg += `🏨 Otel: ${data.hotel_name}\n`;
    if (data.location) msg += `📍 Konum: ${data.location}\n`;
    if (data.room_count) msg += `🚪 Oda sayısı: ${data.room_count}\n`;
    msg += `📋 Günlük brifing: ${data.briefing === "evet" ? "Aktif" : "Pasif"}\n`;
    msg += "\n💡 *Şunları deneyin:*\n";
    msg += `• "durum" — otel genel durumu\n`;
    msg += `• "brifing" — sabah brifingini görün\n`;
    msg += `• "rezervasyonlar" — aktif rezervasyonlar\n`;
    msg += `• "odalar" — oda durumları`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  },
};
