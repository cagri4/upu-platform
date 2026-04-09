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

    // ── Gamification kickoff ─────────────────────────────────────────
    // Initialize streak (day 1) and activate first admin mission so the
    // new firm owner lands on a concrete goal — Quest Director pattern.
    const { updateStreak } = await import("@/platform/gamification/engine");
    await updateStreak(ctx.userId);

    // Find first bayi admin mission (role-aware)
    const { data: firstMission } = await supabase
      .from("platform_missions")
      .select("id, title, description, emoji")
      .eq("tenant_key", "bayi")
      .eq("role", "admin")
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    if (firstMission) {
      const { data: existing } = await supabase
        .from("user_mission_progress")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("mission_id", firstMission.id)
        .maybeSingle();
      if (!existing) {
        await supabase.from("user_mission_progress").insert({
          user_id: ctx.userId,
          mission_id: firstMission.id,
          status: "active",
        });
      }
    }

    // Build focused Duolingo-style first message
    let msg = "✅ *Kurulum tamamlandı!*\n\n";
    if (data.company_name) msg += `🏢 ${data.company_name}\n`;
    if (data.dealer_count) msg += `📊 ${data.dealer_count} bayi\n`;
    msg += `📋 Brifing: ${data.briefing === "evet" ? "Aktif" : "Pasif"}\n`;
    msg += "\n🔥 *Seri: 1 gün* — bugün başladın!\n";

    if (firstMission) {
      msg += `\n🎯 *İlk Görevin*\n`;
      msg += `${firstMission.emoji || "📦"} ${firstMission.title}\n`;
      msg += `_${firstMission.description}_\n`;
      msg += "\nHadi başlayalım 👇";
    }

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:yeniurun", title: "📦 Ürün Ekle" },
    ]);
  },
};
