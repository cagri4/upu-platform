/**
 * Muhasebe SaaS — Onboarding Flow
 *
 * Steps:
 *   1. buro_adi        — Buro/sirket adi (serbest metin)
 *   2. mukellef_sayisi — Kac mukellef var (secim)
 *   3. beyanname_tipi  — Hangi beyannamelerle ilgileniyorsunuz (secim)
 *   4. briefing        — Gunluk brifing gondereyim mi? (Evet/Hayir)
 */

import type { OnboardingFlow } from "@/platform/whatsapp/onboarding";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export const muhasebeOnboardingFlow: OnboardingFlow = {
  tenantKey: "muhasebe",
  welcomeMessage: "",  // Sent separately in webhook after invite

  steps: [
    {
      key: "buro_adi",
      question: "Muhasebe buronuzun veya sirketinizin adi nedir?\n\nOrnek: _ABC Muhasebe_, _Yilmaz Mali Musavirlik_\n\nVerileriniz guvenli sekilde saklanir.",
    },
    {
      key: "mukellef_sayisi",
      question: "Yaklasik kac mukellefle calisiyorsunuz?",
      buttons: [
        { id: "onb:1-20", title: "1-20" },
        { id: "onb:21-50", title: "21-50" },
        { id: "onb:50+", title: "50+" },
      ],
    },
    {
      key: "beyanname_tipi",
      question: "En cok hangi beyanname turuyle ilgileniyorsunuz?",
      buttons: [
        { id: "onb:hepsi", title: "Hepsi" },
        { id: "onb:kdv_muhtasar", title: "KDV + Muhtasar" },
        { id: "onb:kurumlar", title: "Kurumlar Vergisi" },
      ],
    },
    {
      key: "briefing",
      question: "Her sabah size gunluk brifing gondereyim mi?\n\nBrifing: bekleyen beyannameler, yaklasan vadeler ve gunun ozetini icerir.",
      buttons: [
        { id: "onb:evet", title: "Evet, gonder" },
        { id: "onb:hayir", title: "Hayir, gerek yok" },
      ],
    },
  ],

  onFinish: async (ctx, data) => {
    const supabase = getServiceClient();

    // Save bureau info and preferences to profile metadata
    await supabase.from("profiles").update({
      metadata: {
        buro_adi: data.buro_adi || null,
        mukellef_sayisi: data.mukellef_sayisi || null,
        beyanname_tipi: data.beyanname_tipi || null,
        briefing_enabled: data.briefing === "evet",
        onboarding_completed: true,
      },
    }).eq("id", ctx.userId);

    // Build completion message
    let msg = "*Kurulum tamamlandi!*\n\n";
    if (data.buro_adi) msg += `Buro: ${data.buro_adi}\n`;
    if (data.mukellef_sayisi) msg += `Mukellef sayisi: ${data.mukellef_sayisi}\n`;
    msg += `Gunluk brifing: ${data.briefing === "evet" ? "Aktif" : "Pasif"}\n`;
    msg += "\n*Sunlari deneyin:*\n";
    msg += `- "brifing" — gunluk ozetinizi gorun\n`;
    msg += `- "mukellef_ekle" — yeni mukellef kaydedin\n`;
    msg += `- "son_faturalar" — faturalarinizi gorun\n`;
    msg += `- "kdv" — hizli KDV hesaplayin`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  },
};
