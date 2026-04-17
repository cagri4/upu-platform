/**
 * Emlak SaaS — Onboarding Flow
 *
 * Steps:
 *   1. display_name — Adınız soyadınız
 *   2. office_name  — Ofis/şirket adı
 *   3. location     — Çalıştığınız bölge
 *   4. briefing     — Sabah pazartarama raporu opt-in
 */

import type { OnboardingFlow } from "@/platform/whatsapp/onboarding";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export const emlakOnboardingFlow: OnboardingFlow = {
  tenantKey: "emlak",
  welcomeMessage: "",  // Sent separately in webhook after invite

  steps: [
    {
      key: "display_name",
      question: "Adınız ve soyadınız?\n\n💡 Örnek: _Ahmet Yılmaz_",
      onComplete: async (ctx, value) => {
        const supabase = getServiceClient();
        await supabase.from("profiles").update({ display_name: value }).eq("id", ctx.userId);
      },
    },
    {
      key: "office_name",
      question: "Ofisinizin veya şirketinizin adı nedir?\n\n💡 Örnek: _ABC Emlak_, _Yılmaz Gayrimenkul_\n\n🔒 Verileriniz güvenli şekilde saklanır.",
    },
    {
      key: "location",
      question: "Hangi bölgede çalışıyorsunuz?\n\n💡 Örnek: _Kadıköy, İstanbul_ veya _Antalya Merkez_",
    },
    {
      key: "briefing",
      question: "Her sabah sana genel durum raporu göndereyim mi?\n\nRaporda: eklediğin mülk sayısı, fotoğraf/açıklama gibi eksikler, müşteri sayın, varsa piyasa tarama sonuçların, randevu ve hatırlatmalar gibi bilgiler yer alır.",
      buttons: [
        { id: "onb:evet", title: "Evet, gönder" },
        { id: "onb:hayir", title: "Hayır, gerek yok" },
      ],
    },
  ],

  onFinish: async (ctx, data) => {
    const supabase = getServiceClient();

    await supabase.from("profiles").update({
      metadata: {
        office_name: data.office_name || null,
        location: data.location || null,
        briefing_enabled: data.briefing === "evet",
        onboarding_completed: true,
        discovery_step: 0,
      },
    }).eq("id", ctx.userId);

    // Start discovery chain — guided flow through killer features
    const { startDiscoveryChain } = await import("@/platform/whatsapp/discovery-chain");
    await startDiscoveryChain(ctx.userId, ctx.phone, data.office_name as string, data.location as string);
  },
};
