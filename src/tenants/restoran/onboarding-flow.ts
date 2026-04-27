/**
 * Restoran SaaS — Onboarding Flow
 *
 * Steps:
 *   1. display_name      — Ad soyad
 *   2. restaurant_name   — Restoran/cafe adı
 *   3. location          — Şehir/bölge
 *   4. cuisine_type      — Mutfak türü (Türk/Cafe/Italyan/Catering/Karışık)
 *   5. capacity          — Yaklaşık masa sayısı (küçük/orta/büyük)
 *   6. briefing          — Sabah brifingi opt-in
 */

import type { OnboardingFlow } from "@/platform/whatsapp/onboarding";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export const restoranOnboardingFlow: OnboardingFlow = {
  tenantKey: "restoran",
  welcomeMessage: "",

  steps: [
    {
      key: "display_name",
      question: "Adınız ve soyadınız?\n\n💡 Örnek: _Ayşe Demir_",
      onComplete: async (ctx, value) => {
        const supabase = getServiceClient();
        await supabase.from("profiles").update({ display_name: value }).eq("id", ctx.userId);
      },
    },
    {
      key: "restaurant_name",
      question: "Restoranınızın veya cafe'nizin adı nedir?\n\n💡 Örnek: _Anadolu Lokantası_, _Kahve Köşesi_\n\n🔒 Verileriniz güvenli şekilde saklanır.",
    },
    {
      key: "location",
      question: "Hangi şehir/bölgede hizmet veriyorsunuz?\n\n💡 Örnek: _Amsterdam_, _Rotterdam Centrum_, _Den Haag_",
    },
    {
      key: "cuisine_type",
      question: "Mutfak türünüz nedir?",
      buttons: [
        { id: "onb:turk", title: "Türk Mutfağı" },
        { id: "onb:cafe", title: "Cafe / Kahvaltı" },
        { id: "onb:italyan", title: "İtalyan / Pizza" },
      ],
    },
    {
      key: "capacity",
      question: "Yaklaşık kaç masanız var?",
      buttons: [
        { id: "onb:kucuk", title: "1-10 masa" },
        { id: "onb:orta", title: "11-25 masa" },
        { id: "onb:buyuk", title: "26+ masa" },
      ],
    },
    {
      key: "briefing",
      question: "Her sabah size günlük brifing göndereyim mi?\n\nBrifing: bugünkü rezervasyonlar, kritik stok, dünkü satış özeti, açık masalar.",
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
        restaurant_name: data.restaurant_name || null,
        location: data.location || null,
        cuisine_type: data.cuisine_type || null,
        capacity: data.capacity || null,
        briefing_enabled: data.briefing === "evet",
        onboarding_completed: true,
      },
    }).eq("id", ctx.userId);

    let msg = "*Kurulum tamamlandı!* 🍽\n\n";
    if (data.restaurant_name) msg += `Restoran: ${data.restaurant_name}\n`;
    if (data.location) msg += `Bölge: ${data.location}\n`;
    if (data.cuisine_type) msg += `Mutfak: ${data.cuisine_type}\n`;
    if (data.capacity) msg += `Kapasite: ${data.capacity}\n`;
    msg += `Sabah brifingi: ${data.briefing === "evet" ? "Aktif ✅" : "Pasif"}\n`;
    msg += "\n*Bunları deneyin:*\n";
    msg += `• "siparis" — açık siparişleri görün\n`;
    msg += `• "masa" — masa durumu\n`;
    msg += `• "rezervasyon" — bugünkü rezervasyonlar\n`;
    msg += `• "stok" — kritik stok uyarıları`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  },
};
