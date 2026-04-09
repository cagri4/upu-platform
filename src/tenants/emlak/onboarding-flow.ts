/**
 * Emlak SaaS — Onboarding Flow
 *
 * Steps:
 *   1. office_name  — Ofis/şirket adı (serbest metin)
 *   2. location     — Çalıştığınız bölge (serbest metin)
 *   3. briefing     — Günlük brifing göndereyim mi? (Evet/Hayır)
 *
 * onFinish kicks off gamification: streak day 1 + first mission active.
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

    // ── Gamification kickoff ─────────────────────────────────────────
    // Initialize streak (day 1) and activate first mission so the new
    // user lands on a concrete goal — Duolingo-style.
    const { updateStreak, getUserMissions } = await import("@/platform/gamification/engine");
    await updateStreak(ctx.userId);

    const missions = await getUserMissions(ctx.userId, "emlak");
    const firstMission = missions.find(m => m.sort_order === 1);
    if (firstMission && !firstMission.progress) {
      await supabase.from("user_mission_progress").insert({
        user_id: ctx.userId,
        mission_id: firstMission.id,
        status: "active",
      });
    }

    // Build focused Duolingo-style first message
    let msg = "✅ *Kurulum tamamlandı!*\n\n";
    if (data.office_name) msg += `🏢 ${data.office_name}\n`;
    if (data.location) msg += `📍 ${data.location}\n`;
    msg += `📋 Brifing: ${data.briefing === "evet" ? "Aktif" : "Pasif"}\n`;
    msg += "\n🔥 *Seri: 1 gün* — bugün başladın!\n";

    if (firstMission) {
      msg += `\n🎯 *İlk Görevin*\n`;
      msg += `${firstMission.emoji || "🏠"} ${firstMission.title}\n`;
      msg += `_${firstMission.description}_\n`;
      msg += "\nHadi başlayalım 👇";
    } else {
      msg += "\n🏠 Şimdi ilk mülkünüzü ekleyelim!";
    }

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:mulkekle", title: "🏠 Mülk Ekle" },
    ]);
  },
};
