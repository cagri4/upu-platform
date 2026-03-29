/**
 * Emlak SaaS — Onboarding Flow
 *
 * Steps:
 *   1. office_name  — Ofis/şirket adı (serbest metin)
 *   2. location     — Çalıştığınız bölge (serbest metin)
 *   3. first_mulk   — İlk mülk ekleyelim mi? (Evet/Hayır)
 *   4. briefing     — Günlük brifing göndereyim mi? (Evet/Hayır)
 */

import type { OnboardingFlow } from "@/platform/whatsapp/onboarding";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export const emlakOnboardingFlow: OnboardingFlow = {
  tenantKey: "emlak",
  welcomeMessage: "",  // Sent separately in webhook after invite

  steps: [
    {
      key: "office_name",
      question: "Ofisinizin veya şirketinizin adı nedir?\n\n💡 Örnek: _ABC Emlak_, _Yılmaz Gayrimenkul_\n\n🔒 Verileriniz güvenli şekilde saklanır.",
    },
    {
      key: "location",
      question: "Hangi bölgede çalışıyorsunuz?\n\n💡 Örnek: _Kadıköy, İstanbul_ veya _Antalya Merkez_",
    },
    {
      key: "first_mulk",
      question: "Harika! Şimdi ilk mülkünüzü ekleyelim mi?\n\nEklemek isterseniz sizi adım adım yönlendireceğim.",
      buttons: [
        { id: "onb:evet", title: "Evet, ekleyelim" },
        { id: "onb:hayir", title: "Sonra eklerim" },
      ],
    },
    {
      key: "briefing",
      question: "Her sabah size günlük brifing göndereyim mi?\n\nBrifing: aktif ilanlarınız, bugünkü görevleriniz ve pazar özeti içerir.",
      buttons: [
        { id: "onb:evet", title: "Evet, gönder" },
        { id: "onb:hayir", title: "Hayır, gerek yok" },
      ],
    },
  ],

  onFinish: async (ctx, data) => {
    const supabase = getServiceClient();

    // Save office name and location to profile metadata
    await supabase.from("profiles").update({
      metadata: {
        office_name: data.office_name || null,
        location: data.location || null,
        briefing_enabled: data.briefing === "evet",
        onboarding_completed: true,
      },
    }).eq("id", ctx.userId);

    // Build completion message
    let msg = "✅ *Kurulum tamamlandı!*\n\n";
    if (data.office_name) msg += `🏢 Ofis: ${data.office_name}\n`;
    if (data.location) msg += `📍 Bölge: ${data.location}\n`;
    msg += `📋 Günlük brifing: ${data.briefing === "evet" ? "Aktif" : "Pasif"}\n`;
    msg += "\n💡 *Şunları deneyin:*\n";
    if (data.location) {
      msg += `• "fiyatsor ${data.location}" — bölgenizin fiyat analizi\n`;
    } else {
      msg += `• "fiyatsor" — bölgenizin fiyat analizi\n`;
    }
    msg += `• "mulkekle" — ilk mülkünüzü ekleyin\n`;
    msg += `• "brifing" — günlük özetinizi görün`;

    // If user chose to add first property, start mulkekle flow
    if (data.first_mulk === "evet") {
      await sendButtons(ctx.phone, msg + "\n\nŞimdi ilk mülkünüzü ekleyelim:", [
        { id: "cmd:mulkekle", title: "Mülk Ekle" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
    } else {
      await sendButtons(ctx.phone, msg, [
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
    }
  },
};
