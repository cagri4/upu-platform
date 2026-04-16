/**
 * Bayi SaaS — Onboarding Flow
 *
 * Steps:
 *   1. company_name  — Firma/şirket adı (serbest metin)
 *   2. dealer_count  — Kaç bayiniz var? (seçenekli)
 *   3. briefing      — Günlük brifing göndereyim mi? (Evet/Hayır)
 */

import type { OnboardingFlow } from "@/platform/whatsapp/onboarding";
import { sendButtons } from "@/platform/whatsapp/send";
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

    let msg = "✅ *Kurulum tamamlandı!*\n\n";
    if (data.company_name) msg += `🏢 ${data.company_name}\n`;
    if (data.dealer_count) msg += `📊 ${data.dealer_count} bayi\n`;
    msg += `📋 Brifing: ${data.briefing === "evet" ? "Aktif" : "Pasif"}\n`;
    msg += `\nHazırsınız! Ürün eklemek için alttaki butona tıklayın ya da "menü" yazın.`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:yeniurun", title: "📦 Ürün Ekle" },
    ]);
  },
};
