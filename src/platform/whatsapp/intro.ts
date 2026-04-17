/**
 * Post-signup intro — "Value Before Signup" flow.
 *
 * Before asking for ANY user info, we demonstrate a real capability:
 *   1. Ask region (button/list)
 *   2. Ask property type (buttons)
 *   3. Ask listed_by (buttons)
 *   4. Query DB → show real market stats
 *   5. "Devam Et" → start onboarding (collect name, office, email etc.)
 *
 * This creates the "aha moment" before the user invests any effort.
 */

import type { WaContext } from "./types";
import { sendButtons, sendList, sendText } from "./send";
import {
  getOnboardingFlow,
  getOnboardingState,
  initOnboarding,
  sendOnboardingStep,
} from "./onboarding";
import { getServiceClient } from "@/platform/auth/supabase";

const INTRO_TENANTS = new Set(["emlak"]);

const PROPERTY_TYPES = [
  { id: "vf:type:villa", title: "Villa" },
  { id: "vf:type:daire", title: "Daire" },
  { id: "vf:type:arsa", title: "Arsa" },
  { id: "vf:type:mustakil", title: "Müstakil Ev" },
  { id: "vf:type:rezidans", title: "Rezidans" },
  { id: "vf:type:dukkan", title: "Dükkan" },
  { id: "vf:type:buro_ofis", title: "Büro / Ofis" },
  { id: "vf:type:hepsi", title: "Hepsi" },
];

const LISTED_BY = [
  { id: "vf:listed:sahibi", title: "Sahibinden" },
  { id: "vf:listed:emlakci", title: "Emlak Ofisinden" },
  { id: "vf:listed:hepsi", title: "Hepsi" },
];

/**
 * Start the intro — send greeting + capabilities + region selection.
 */
export async function startIntro(ctx: WaContext): Promise<boolean> {
  if (!INTRO_TENANTS.has(ctx.tenantKey)) return false;

  await sendList(ctx.phone,
    `👋 Merhaba! Ben UPU, sizin kişisel AI asistanınızım. 7/24 satışlarınızı artırmak için çalışacağım.\n\n` +
    `*Sizin için neler yaparım?*\n\n` +
    `• Mülkleriniz için satış hedefli sunumlar hazırlarım\n` +
    `• Size özel bir web sayfası oluşturup tüm portföyünüzü paylaşılabilir yaparım\n` +
    `• Her sabah bölgenizdeki yeni ilanları tarayıp size raporlarım\n` +
    `• Müşterilerinizi kayıt altına alır, takip eder, öneriler sunarım\n\n` +
    `Hemen göstereyim — bölgenizi seçin:`,
    "Bölge Seç",
    [{
      title: "Bölgeler",
      rows: [
        { id: "vf:region:bodrum", title: "Bodrum", description: "Muğla" },
      ],
    }],
  );
  return true;
}

/**
 * Handle intro callback taps.
 *
 * Callback ID formats:
 *   vf:region:<region>   → ask property type
 *   vf:type:<type>       → ask listed_by
 *   vf:listed:<who>      → query DB, show results
 *   vf:start             → begin onboarding
 */
export async function handleIntroCallback(ctx: WaContext, interactiveId: string): Promise<void> {
  const parts = interactiveId.split(":");
  if (parts[0] !== "vf") return;

  const step = parts[1];

  if (step === "region") {
    const region = parts[2];
    // Store region in session for later use
    const sb = getServiceClient();
    await sb.from("command_sessions").upsert({
      user_id: ctx.userId,
      tenant_id: ctx.tenantId,
      command: "_intro",
      step: "type",
      data: { region },
      updated_at: new Date().toISOString(),
    });

    await sendList(ctx.phone,
      `Hangi mülk tipini görmek istersiniz?`,
      "Tip Seç",
      [{ title: "Mülk Tipleri", rows: PROPERTY_TYPES.map(t => ({ id: t.id, title: t.title, description: "" })) }],
    );
    return;
  }

  if (step === "type") {
    const propertyType = parts[2];
    const sb = getServiceClient();
    const { data: sess } = await sb.from("command_sessions")
      .select("data").eq("user_id", ctx.userId).eq("command", "_intro").maybeSingle();
    const region = (sess?.data as Record<string, string>)?.region || "bodrum";

    await sb.from("command_sessions").update({
      step: "listed",
      data: { region, property_type: propertyType },
      updated_at: new Date().toISOString(),
    }).eq("user_id", ctx.userId).eq("command", "_intro");

    await sendButtons(ctx.phone,
      `Kimin ilanlarını görelim?`,
      LISTED_BY,
    );
    return;
  }

  if (step === "listed") {
    const listedBy = parts[2];
    const sb = getServiceClient();
    const { data: sess } = await sb.from("command_sessions")
      .select("data").eq("user_id", ctx.userId).eq("command", "_intro").maybeSingle();
    const d = (sess?.data as Record<string, string>) || {};
    const region = d.region || "bodrum";
    const propertyType = d.property_type || "villa";

    // Query actual DB
    let query = sb.from("emlak_properties")
      .select("location_neighborhood, price", { count: "exact" })
      .ilike("location_district", `%${region}%`);

    if (propertyType !== "hepsi") {
      query = query.eq("type", propertyType);
    }

    if (listedBy !== "hepsi") {
      query = query.eq("listed_by", listedBy === "sahibi" ? "sahibi" : "emlakci");
    }

    const { data: props, count } = await query.limit(1000);

    // Count yesterday's new listings
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let newQuery = sb.from("emlak_properties")
      .select("*", { count: "exact", head: true })
      .ilike("location_district", `%${region}%`)
      .gte("created_at", yesterday);
    if (propertyType !== "hepsi") newQuery = newQuery.eq("type", propertyType);
    if (listedBy !== "hepsi") newQuery = newQuery.eq("listed_by", listedBy === "sahibi" ? "sahibi" : "emlakci");
    const { count: newCount } = await newQuery;

    // Group by neighborhood
    const byHood: Record<string, number> = {};
    let totalPrice = 0;
    let priceCount = 0;
    for (const p of props || []) {
      const hood = p.location_neighborhood || "Diğer";
      byHood[hood] = (byHood[hood] || 0) + 1;
      if (p.price) { totalPrice += p.price; priceCount++; }
    }
    const avgPrice = priceCount > 0 ? Math.round(totalPrice / priceCount) : 0;
    const topHoods = Object.entries(byHood)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const regionLabel = region.charAt(0).toUpperCase() + region.slice(1);
    const typeLabel = propertyType === "hepsi" ? "Tüm Tipler" : propertyType.charAt(0).toUpperCase() + propertyType.slice(1);
    const listedLabel = listedBy === "hepsi" ? "Tümü" : listedBy === "sahibi" ? "Sahibinden" : "Emlak Ofisi";

    let msg = `📊 *${regionLabel} — ${typeLabel} — ${listedLabel}*\n\n`;
    msg += `Aktif ilan: *${count || 0}*\n`;
    msg += `Dün eklenen: *${newCount || 0}* yeni ilan\n`;
    if (avgPrice > 0) {
      msg += `Ortalama fiyat: *${new Intl.NumberFormat("tr-TR").format(avgPrice)} ₺*\n`;
    }
    if (topHoods.length > 0) {
      msg += `\n*Mahalle dağılımı:*\n`;
      for (const [hood, cnt] of topHoods) {
        msg += `• ${hood}: ${cnt} ilan\n`;
      }
    }
    msg += `\nBu taramayı ileride otomatik hale getirebilirsiniz — her sabah size gelir.\n\n`;
    msg += `Şimdi sizi tanıyayım! 👇`;

    // Clean up session
    await sb.from("command_sessions").delete().eq("user_id", ctx.userId).eq("command", "_intro");

    await sendButtons(ctx.phone, msg, [
      { id: "vf:start", title: "🚀 Devam Et" },
    ]);
    return;
  }

  if (step === "start") {
    // Start onboarding
    const flow = getOnboardingFlow(ctx.tenantKey);
    if (flow) {
      await initOnboarding(ctx.userId, ctx.tenantId, ctx.tenantKey);
      const state = await getOnboardingState(ctx.userId);
      if (state) await sendOnboardingStep(ctx, state);
    } else {
      await sendText(ctx.phone, "✅ Hazırsın. Komutları kullanmaya başlayabilirsin.");
    }
    return;
  }
}
