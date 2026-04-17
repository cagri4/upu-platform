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
import { startSession, updateSession, getSession, endSession } from "./session";

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
    `*Yapabileceklerimden bazıları:*\n\n` +
    `• Müşterinize 2 dakikada profesyonel sunum hazırlar, tek link ile gönderirim.\n` +
    `• Müşterinize gösterebileceğiniz, tüm portföyünüzün yer aldığı profesyonel bir web sayfası yaparım.\n` +
    `• Rakiplerinizden önce yeni fırsatları yakalarım — her sabah bölgenizdeki yeni ilanları otomatik raporlarım.\n` +
    `• İlan açıklamalarınızı AI ile yazar, dikkat çeken satış odaklı metinler oluştururum.\n` +
    `• Hiçbir müşterinizi unutmam — ne zaman aramanız gerektiğini takip eder, size hatırlatırım.\n` +
    `• Sahibinden.com'a ilan yüklemenizi 30 dakikadan 3 dakikaya indiririm.\n` +
    `• Dilediğiniz portföyünüzü, mülk arayan emlak danışmanlarıyla işbirliği yaparak, kısa sürede satılmasını sağlarım.\n\n` +
    `Şimdi birlikte bir başlangıç yapalım ve bölgenizdeki ilanları tarayalım.\n\nBölgenizi seçin:`,
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
    await startSession(ctx.userId, ctx.tenantId, "_intro", "type");
    await updateSession(ctx.userId, "type", { region });

    await sendList(ctx.phone,
      `Hangi mülk tipini görmek istersiniz?`,
      "Tip Seç",
      [{ title: "Mülk Tipleri", rows: PROPERTY_TYPES.map(t => ({ id: t.id, title: t.title, description: "" })) }],
    );
    return;
  }

  if (step === "type") {
    const propertyType = parts[2];
    await updateSession(ctx.userId, "listing", { property_type: propertyType });

    await sendButtons(ctx.phone,
      `Satılık mı, kiralık mı?`,
      [
        { id: "vf:listing:satilik", title: "Satılık" },
        { id: "vf:listing:kiralik", title: "Kiralık" },
        { id: "vf:listing:hepsi", title: "Hepsi" },
      ],
    );
    return;
  }

  if (step === "listing") {
    const listingType = parts[2];
    await updateSession(ctx.userId, "listed", { listing_type: listingType });

    await sendButtons(ctx.phone,
      `Kimin ilanlarını görelim?`,
      LISTED_BY,
    );
    return;
  }

  if (step === "listed") {
    const listedBy = parts[2];
    const sess = await getSession(ctx.userId);
    const d = (sess?.data as Record<string, string>) || {};
    const region = d.region || "bodrum";
    const propertyType = d.property_type || "hepsi";
    const listingType = d.listing_type || "hepsi";

    await endSession(ctx.userId);

    // Query actual DB
    const sb = getServiceClient();
    let query = sb.from("emlak_properties")
      .select("location_neighborhood, price", { count: "exact" })
      .ilike("location_district", `%${region}%`);

    if (propertyType !== "hepsi") {
      query = query.eq("type", propertyType);
    }

    if (listingType !== "hepsi") {
      query = query.eq("listing_type", listingType);
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
    const listingLabel = listingType === "hepsi" ? "" : listingType === "satilik" ? "Satılık " : "Kiralık ";
    const listedLabel = listedBy === "hepsi" ? "Tümü" : listedBy === "sahibi" ? "Sahibinden" : "Emlak Ofisi";

    let msg = `📊 *${regionLabel} — ${listingLabel}${typeLabel} — ${listedLabel}*\n\n`;
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
