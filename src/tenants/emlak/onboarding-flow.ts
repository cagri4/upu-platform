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
      question: "Her sabah size pazartarama raporu göndereyim mi?\n\nRapor: aktif ilanlarınız, bugünkü görevleriniz ve bölgenizdeki yeni ilanlar özeti içerir.",
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
      },
    }).eq("id", ctx.userId);

    let msg = "✅ *Kurulum tamamlandı!*\n\n";
    if (data.office_name) msg += `🏢 ${data.office_name}\n`;
    if (data.location) msg += `📍 ${data.location}\n`;
    msg += `\nBilgilerinizi daha sonra güncellemek için her zaman *"menü"* yazıp, açılan listeden *Profilim* komutunu kullanabilirsiniz.\n`;
    msg += `\n━━━━━━━━━━━━━━━━━━━\n`;
    msg += `\nHazırsın! Mülk eklemek için alttaki butona tıkla, ya da istediğin zaman *"menü"* yazarak tüm komutları gör.`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:mulkekle", title: "🏠 Mülk Ekle" },
    ]);
  },
};
