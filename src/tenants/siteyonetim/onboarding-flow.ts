/**
 * Site Yönetim SaaS — Onboarding Flow
 *
 * Steps:
 *   1. building_name — Bina/site adı
 *   2. unit_count    — Daire sayısı
 *   3. aidat_amount  — Aylık aidat tutarı
 *   4. briefing      — Günlük brifing tercihi
 */

import type { OnboardingFlow } from "@/platform/whatsapp/onboarding";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

const TENANT_ID = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";

export const siteyonetimOnboardingFlow: OnboardingFlow = {
  tenantKey: "siteyonetim",
  welcomeMessage: "",

  steps: [
    {
      key: "building_name",
      question: "Yönettiğiniz bina veya sitenin adı nedir?\n\n💡 Örnek: _Yeşilköy Sitesi A Blok_, _Güneş Apartmanı_\n\n🔒 Verileriniz güvenli şekilde saklanır.",
    },
    {
      key: "unit_count",
      question: "Binada kaç daire/bağımsız bölüm var?",
      buttons: [
        { id: "onb:10", title: "1-10" },
        { id: "onb:30", title: "11-30" },
        { id: "onb:50", title: "31-50" },
      ],
    },
    {
      key: "aidat_amount",
      question: "Aylık aidat tutarı ne kadar? (TL)\n\n💡 Örnek: _1500_ veya _2000_",
    },
    {
      key: "briefing",
      question: "Her sabah size günlük brifing göndereyim mi?\n\nBrifing: borçlu daireler, açık arızalar, gelir-gider özeti içerir.",
      buttons: [
        { id: "onb:evet", title: "Evet, gönder" },
        { id: "onb:hayir", title: "Hayır" },
      ],
    },
  ],

  onFinish: async (ctx, data) => {
    const supabase = getServiceClient();

    // Save to profile metadata
    await supabase.from("profiles").update({
      metadata: {
        building_name: data.building_name || null,
        unit_count: data.unit_count || null,
        aidat_amount: data.aidat_amount || null,
        briefing_enabled: data.briefing === "evet",
        onboarding_completed: true,
      },
    }).eq("id", ctx.userId);

    // If user is already manager of a building, update its name
    const { data: existing } = await supabase
      .from("sy_buildings")
      .select("id")
      .eq("manager_id", ctx.userId)
      .eq("tenant_id", TENANT_ID)
      .maybeSingle();

    if (existing) {
      if (data.building_name) {
        await supabase.from("sy_buildings")
          .update({ name: data.building_name as string })
          .eq("id", existing.id);
      }
    } else {
      // Create building with user as manager
      const { generateAccessCode } = await import("./commands/helpers");
      await supabase.from("sy_buildings").insert({
        tenant_id: TENANT_ID,
        name: (data.building_name as string) || "Binam",
        manager_id: ctx.userId,
        access_code: generateAccessCode(),
      });
    }

    // Build completion message
    let msg = "✅ *Kurulum tamamlandı!*\n\n";
    if (data.building_name) msg += `🏢 Bina: ${data.building_name}\n`;
    if (data.unit_count) msg += `🏠 Daire sayısı: ${data.unit_count}\n`;
    if (data.aidat_amount) msg += `💰 Aylık aidat: ₺${data.aidat_amount}\n`;
    msg += `📋 Günlük brifing: ${data.briefing === "evet" ? "Aktif" : "Pasif"}\n`;
    msg += "\n💡 *Şunları deneyin:*\n";
    msg += `• "borcum" — borç durumu özeti\n`;
    msg += `• "ariza" — arıza bildirimi\n`;
    msg += `• "rapor" — bina raporu`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  },
};
