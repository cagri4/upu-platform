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

    // If user is already manager of a building, update its name; otherwise
    // create one. Capture buildingId so the demo seed can populate it below.
    const { data: existing } = await supabase
      .from("sy_buildings")
      .select("id")
      .eq("manager_id", ctx.userId)
      .eq("tenant_id", TENANT_ID)
      .maybeSingle();

    let buildingId: string | null = null;

    if (existing) {
      buildingId = existing.id as string;
      if (data.building_name) {
        await supabase.from("sy_buildings")
          .update({ name: data.building_name as string })
          .eq("id", existing.id);
      }
    } else {
      const { generateAccessCode } = await import("./commands/helpers");
      const { data: created } = await supabase
        .from("sy_buildings")
        .insert({
          tenant_id: TENANT_ID,
          name: (data.building_name as string) || "Binam",
          manager_id: ctx.userId,
          access_code: generateAccessCode(),
        })
        .select("id")
        .single();
      buildingId = (created?.id as string | undefined) ?? null;
    }

    // Demo seed — bayi pattern'i. Yeni binaya 18 sakin + 3 ay aidat +
    // 3 açık arıza + gelir-gider hareketleri yazar. Idempotent: bina'da
    // zaten daire varsa skip eder, hata çıkarsa onboarding'i bozmaz.
    let seedSummary = "";
    if (buildingId) {
      try {
        const { seedSiteyonetimDemoData } = await import("./demo/seed");
        const r = await seedSiteyonetimDemoData(supabase, TENANT_ID, ctx.userId, buildingId);
        if (r.ok && r.summary) {
          seedSummary = `\n\n📊 *Örnek veriyle başladık*\n` +
            `${r.summary.residents} sakin, ${r.summary.dues} aidat kaydı, ` +
            `${r.summary.tickets} açık arıza yüklendi.\n` +
            `_Komutları gerçekçi veriyle deneyebilirsiniz._`;
        }
      } catch (err) {
        console.error("[siteyonetim:onboarding] demo seed err:", err);
      }
    }

    // Kapanış özeti — sade. Tour intro mesajı (step 1) advanceDiscovery
    // tarafından ayrı gönderilecek, burada navigasyon kalabalığı yapma.
    let msg = "✅ *Kurulum tamamlandı!*\n\n";
    if (data.building_name) msg += `🏢 Bina: ${data.building_name}\n`;
    if (data.unit_count) msg += `🏠 Daire sayısı: ${data.unit_count}\n`;
    if (data.aidat_amount) msg += `💰 Aylık aidat: ₺${data.aidat_amount}\n`;
    msg += `📋 Günlük brifing: ${data.briefing === "evet" ? "Aktif" : "Pasif"}`;
    msg += seedSummary;

    await sendButtons(ctx.phone, msg, [], { skipNav: true });

    // Tour başlat — Task 1 (rapor) prompt'u gönderilir.
    try {
      const { advanceDiscovery } = await import("@/platform/whatsapp/discovery-chain");
      await advanceDiscovery(ctx.userId, "siteyonetim", ctx.phone, "setup_complete");
    } catch (err) {
      console.error("[siteyonetim:onboarding] tour start err:", err);
    }
  },
};
