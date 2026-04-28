/**
 * Bayi SaaS — Onboarding Flow
 *
 * Steps:
 *   1. company_name  — Firma/şirket adı (serbest metin)
 *   2. dealer_count  — Kaç bayiniz var? (seçenekli)
 *   3. briefing      — Günlük brifing göndereyim mi? (Evet/Hayır)
 *
 * onFinish triggers the bayi discovery chain (5-step:
 * profil → ürün → bayi davet → kampanya → kapanış).
 */

import type { OnboardingFlow } from "@/platform/whatsapp/onboarding";
import { getServiceClient } from "@/platform/auth/supabase";

export const bayiOnboardingFlow: OnboardingFlow = {
  tenantKey: "bayi",
  welcomeMessage: "",  // Sent separately in webhook after invite

  steps: [
    {
      key: "company_name",
      question: "Firmanızın veya şirketinizin adı nedir?\n\n💡 Örnek: _ABC Dağıtım_, _Yılmaz Ticaret_\n\n🔒 Verileriniz güvenli şekilde saklanır.",
    },
    {
      key: "dealer_count",
      question: "Bayi ağınızda yaklaşık kaç bayi var?",
      buttons: [
        { id: "onb:1-10", title: "1-10 bayi" },
        { id: "onb:11-50", title: "11-50 bayi" },
        { id: "onb:50+", title: "50+ bayi" },
      ],
    },
    {
      key: "briefing",
      question: "Her sabah size günlük brifing göndereyim mi?\n\nBrifing: günlük siparişler, kritik stok uyarıları, vadesi gelen ödemeler ve teslimat durumunu içerir.",
      buttons: [
        { id: "onb:evet", title: "Evet, gönder" },
        { id: "onb:hayir", title: "Hayır, gerek yok" },
      ],
    },
  ],

  onFinish: async (ctx, data) => {
    const supabase = getServiceClient();

    // Save company info to profile metadata
    await supabase.from("profiles").update({
      metadata: {
        company_name: data.company_name || null,
        dealer_count: data.dealer_count || null,
        briefing_enabled: data.briefing === "evet",
        onboarding_completed: true,
      },
    }).eq("id", ctx.userId);

    // Start the bayi discovery chain — first prompt is a magic link to
    // /tr/bayi-profil (firma profili formu).
    const { startBayiDiscoveryChain } = await import("@/platform/whatsapp/discovery-chain");
    await startBayiDiscoveryChain(ctx.userId, ctx.phone, (data.company_name as string) || undefined);
  },
};
