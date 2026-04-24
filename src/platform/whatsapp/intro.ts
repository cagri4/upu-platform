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

  // Generate a setup magic link (2h TTL — longer than regular webpanel)
  const supabase = getServiceClient();
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expiresAt,
  });
  const setupUrl = `https://estateai.upudev.nl/tr/ara?t=${token}`;

  // Long intro text goes as a separate message (auto-split if >4000 chars)
  const introMsg =
    `👋 Merhaba! Ben UPU, sizin kişisel AI asistanınızım. 7/24 satışlarınızı artırmak için çalışacağım.\n\n` +
    `*Yapabileceklerimden bazıları:*\n\n` +
    `• Her sabah sahibinden'de bölgenize düşen *yeni sahibi ilanları* kriterinize göre süzüp link listesi olarak WhatsApp'a gönderirim. Tek tıkla linkleri inceler, dilerseniz hızlı bir şekilde sahibinden verilmiş ilan sahibine ulaşırsınız.\n` +
    `• Portföyünüz için dakikalar içinde profesyonel sunumlar hazırlar, tek linkle müşterinize gönderirim.\n` +
    `• Sunum ve ilan açıklamalarında yapay zeka ile satış hedefli metinler yazarım.\n` +
    `• Sahibinden.com'a ilan yüklemenizi 30 dakikadan 3 dakikaya indiririm.`;

  await sendText(ctx.phone, introMsg);

  const { sendUrlButton } = await import("./send");
  await sendUrlButton(ctx.phone,
    "Önce arama kriterlerini belirleyelim. Aşağıdaki butona tıkla, bölgende hangi ilanları izlemek istediğini seç ve WhatsApp'a dön.\n\n_Link 2 saat geçerlidir._",
    "🔍 Arama Kriterleri",
    setupUrl,
    { skipNav: true },
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
      { skipNav: true },
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
      { skipNav: true },
    );
    return;
  }

  if (step === "listing") {
    const listingType = parts[2];
    await updateSession(ctx.userId, "listed", { listing_type: listingType });

    await sendButtons(ctx.phone,
      `Kimin ilanlarını görelim?`,
      LISTED_BY,
      { skipNav: true },
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

    // Count recently listed (by sahibinden listing_date, not our created_at)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let newQuery = sb.from("emlak_properties")
      .select("*", { count: "exact", head: true })
      .ilike("location_district", `%${region}%`)
      .gte("listing_date", yesterday);
    if (propertyType !== "hepsi") newQuery = newQuery.eq("type", propertyType);
    if (listingType !== "hepsi") newQuery = newQuery.eq("listing_type", listingType);
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
      .sort((a, b) => b[1] - a[1]);

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
    msg += `\nBu taramayı ileride otomatik hale getirebilirsiniz — her sabah size gelir.`;

    // Long report goes via sendText (auto-splits at 4096); then a short button prompt.
    await sendText(ctx.phone, msg);
    await sendButtons(ctx.phone, "Şimdi sizi tanıyayım! 👇",
      [{ id: "vf:start", title: "🚀 Devam Et" }],
      { skipNav: true },
    );
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
