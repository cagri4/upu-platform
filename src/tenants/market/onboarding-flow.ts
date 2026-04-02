/**
 * Market SaaS — Onboarding Flow
 *
 * Steps:
 *   1. market_adi     — Market/magaza adi (serbest metin)
 *   2. sektor         — Market turu (secim)
 *   3. urun_sayisi    — Yaklasik kac urun var (secim)
 *   4. briefing       — Gunluk brifing gondereyim mi? (Evet/Hayir)
 */

import type { OnboardingFlow } from "@/platform/whatsapp/onboarding";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export const marketOnboardingFlow: OnboardingFlow = {
  tenantKey: "market",
  welcomeMessage: "",  // Sent separately in webhook after invite

  steps: [
    {
      key: "market_adi",
      question: "Marketinizin veya magazanizin adi nedir?\n\nOrnek: _ABC Market_, _Yilmaz Bakkal_\n\nVerileriniz guvenli sekilde saklanir.",
    },
    {
      key: "sektor",
      question: "Market turunuz nedir?",
      buttons: [
        { id: "onb:bakkal", title: "Bakkal / Mini Market" },
        { id: "onb:supermarket", title: "Supermarket" },
        { id: "onb:toptan", title: "Toptan / Grossmarket" },
      ],
    },
    {
      key: "urun_sayisi",
      question: "Yaklasik kac cesit urun satiyorsunuz?",
      buttons: [
        { id: "onb:1-100", title: "1-100" },
        { id: "onb:100-500", title: "100-500" },
        { id: "onb:500+", title: "500+" },
      ],
    },
    {
      key: "briefing",
      question: "Her sabah size gunluk brifing gondereyim mi?\n\nBrifing: stok duzeyi, yaklasan son kullanma tarihleri, gunun satis ozeti ve siparis durumlarini icerir.",
      buttons: [
        { id: "onb:evet", title: "Evet, gonder" },
        { id: "onb:hayir", title: "Hayir, gerek yok" },
      ],
    },
  ],

  onFinish: async (ctx, data) => {
    const supabase = getServiceClient();

    // Save market info and preferences to profile metadata
    await supabase.from("profiles").update({
      metadata: {
        market_adi: data.market_adi || null,
        sektor: data.sektor || null,
        urun_sayisi: data.urun_sayisi || null,
        briefing_enabled: data.briefing === "evet",
        onboarding_completed: true,
      },
    }).eq("id", ctx.userId);

    // Build completion message
    let msg = "*Kurulum tamamlandi!*\n\n";
    if (data.market_adi) msg += `Market: ${data.market_adi}\n`;
    if (data.sektor) msg += `Tur: ${data.sektor}\n`;
    if (data.urun_sayisi) msg += `Urun cesidi: ${data.urun_sayisi}\n`;
    msg += `Gunluk brifing: ${data.briefing === "evet" ? "Aktif" : "Pasif"}\n`;
    msg += "\n*Sunlari deneyin:*\n";
    msg += `- "stokekle" — yeni urun ekleyin\n`;
    msg += `- "stoksorgula" — stok durumunu gorun\n`;
    msg += `- "raporgunluk" — gunluk satis raporunu gorun\n`;
    msg += `- "siparisler" — siparis durumlarini kontrol edin`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  },
};
