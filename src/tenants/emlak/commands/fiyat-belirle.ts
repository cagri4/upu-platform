/**
 * fiyatbelirle — Mülk bazlı fiyat analizi
 *
 * Kullanıcı portföyünden mülk seçer → sistem benzer ilanları filtreler
 * (aynı tip + bölge + benzer m²) → fiyat aralığı + AI pozisyon analizi
 *
 * Senaryo: "Mülk ekledim, fiyat ne koymalıyım?"
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

// ── List user properties → select one ─────────────────────────────────

export async function handleFiyatBelirle(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { data: properties } = await supabase
      .from("emlak_properties")
      .select("id, title, type, listing_type, location_district, location_neighborhood, area, rooms, price")
      .eq("user_id", ctx.userId)
      .eq("status", "aktif")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!properties || properties.length === 0) {
      await sendText(ctx.phone,
        "📊 *Fiyat Belirle*\n\nHenüz portföyünüzde mülk yok.\nÖnce bir mülk ekleyin, sonra fiyat analizi yapabilirsiniz."
      );
      return;
    }

    if (properties.length === 1) {
      // Tek mülk — direkt analiz yap
      await runPriceAnalysis(ctx, properties[0]);
      return;
    }

    // Birden fazla — liste göster
    const rows = properties.map(p => ({
      id: `fb:${p.id}`,
      title: (p.title || "İsimsiz").substring(0, 24),
      description: `${p.type || "Mülk"} — ${p.location_district || ""}`,
    }));

    await sendList(
      ctx.phone,
      "📊 *Fiyat Belirle*\n\nHangi mülkün fiyatını analiz etmek istiyorsunuz?",
      "Mülk Seçin",
      [{ title: "Portföyünüz", rows }],
    );
  } catch (err) {
    await handleError(ctx, "emlak:fiyatbelirle", err, "db");
  }
}

// ── Callback: property selected ────────────────────────────────────

export async function handleFiyatBelirleCallback(ctx: WaContext, data: string): Promise<void> {
  const propertyId = data.replace("fb:", "");
  if (propertyId === "cancel") return;

  try {
    const supabase = getServiceClient();
    const { data: property } = await supabase
      .from("emlak_properties")
      .select("id, title, type, listing_type, location_district, location_neighborhood, area, rooms, price")
      .eq("id", propertyId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (!property) {
      await sendText(ctx.phone, "Mülk bulunamadı.");
      return;
    }

    await runPriceAnalysis(ctx, property);
  } catch (err) {
    await handleError(ctx, "emlak:fiyatbelirle:cb", err, "db");
  }
}

// ── Core analysis ──────────────────────────────────────────────────

interface PropertyRow {
  id: string;
  title: string;
  type: string | null;
  listing_type: string | null;
  location_district: string | null;
  location_neighborhood: string | null;
  area: number | null;
  rooms: string | null;
  price: number | null;
}

async function runPriceAnalysis(ctx: WaContext, property: PropertyRow): Promise<void> {
  const supabase = getServiceClient();
  const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(n);

  // Build filter query — same type + same district + active
  let query = supabase
    .from("emlak_properties")
    .select("price, area, rooms, title, location_neighborhood")
    .eq("status", "aktif")
    .not("price", "is", null)
    .gt("price", 0);

  // Filter by listing type (satılık/kiralık)
  if (property.listing_type) {
    query = query.eq("listing_type", property.listing_type);
  }

  // Filter by property type
  if (property.type) {
    query = query.eq("type", property.type);
  }

  // Filter by district
  if (property.location_district) {
    query = query.eq("location_district", property.location_district);
  }

  // Filter by rooms (exact match — "2+1" = "2+1")
  if (property.rooms) {
    query = query.eq("rooms", property.rooms);
  }

  // If neighborhood is set, prefer same neighborhood
  // but fall back to district if too few results
  let neighborhoodFilter = false;
  if (property.location_neighborhood) {
    const { count } = await supabase
      .from("emlak_properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "aktif")
      .eq("type", property.type || "daire")
      .eq("location_district", property.location_district || "Bodrum")
      .ilike("location_neighborhood", `%${property.location_neighborhood}%`)
      .gt("price", 0);

    if (count && count >= 5) {
      query = query.ilike("location_neighborhood", `%${property.location_neighborhood}%`);
      neighborhoodFilter = true;
    }
  }

  // Area range filter: ±15%
  if (property.area && property.area > 0) {
    const minArea = Math.round(property.area * 0.85);
    const maxArea = Math.round(property.area * 1.15);
    query = query.gte("area", minArea).lte("area", maxArea);
  }

  // Fetch all matching — supabase default is 1000 rows, enough for filtered queries
  const { data: similar } = await query.limit(1000);

  if (!similar || similar.length < 3) {
    // Too few results — show broader search
    await sendText(ctx.phone,
      `📊 *Fiyat Analizi — ${property.title}*\n\n` +
      `Benzer ilan sayısı çok az (${similar?.length || 0}).\n` +
      `Filtreler: ${property.listing_type || "?"} / ${property.type || "?"} / ${property.location_district || "?"}\n\n` +
      `Daha fazla veri toplandıkça analiz güçlenecek.`
    );
    await logEvent(ctx.tenantId, ctx.userId, "fiyatbelirle", `${property.title} — yetersiz veri`);
    return;
  }

  // Calculate stats — trim 10% outliers from each end
  const rawPrices = similar.map(p => p.price as number).filter(p => p > 0);
  const sortedAll = [...rawPrices].sort((a, b) => a - b);
  const trimCount = Math.floor(sortedAll.length * 0.1);
  const prices = trimCount > 0 ? sortedAll.slice(trimCount, -trimCount) : sortedAll;

  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];

  // Median
  const medianPrice = prices[Math.floor(prices.length / 2)];

  // m² unit price (also trimmed)
  const rawM2Prices: number[] = [];
  for (const s of similar) {
    if (s.price && s.area && s.price > 0 && s.area > 0) {
      rawM2Prices.push(Math.round(s.price / s.area));
    }
  }
  const sortedM2 = rawM2Prices.sort((a, b) => a - b);
  const trimM2 = Math.floor(sortedM2.length * 0.1);
  const m2Prices = trimM2 > 0 ? sortedM2.slice(trimM2, -trimM2) : sortedM2;
  const avgM2Price = m2Prices.length > 0
    ? Math.round(m2Prices.reduce((a, b) => a + b, 0) / m2Prices.length)
    : 0;

  // Position of user's property
  let positionText = "";
  if (property.price && property.price > 0) {
    const userPrice = property.price!;
    const percentile = prices.filter(p => p <= userPrice).length / prices.length * 100;
    if (percentile <= 25) positionText = "📉 Alt çeyrek — piyasanın altında";
    else if (percentile <= 50) positionText = "📊 Ortalamanın altında";
    else if (percentile <= 75) positionText = "📊 Ortalamanın üstünde";
    else positionText = "📈 Üst çeyrek — piyasanın üstünde";
  }

  // Build message
  const typeLabel = property.type || "mülk";
  const locationLabel = neighborhoodFilter
    ? `${property.location_neighborhood}, ${property.location_district}`
    : property.location_district || "Bodrum";

  let text = `📊 *Fiyat Analizi*\n`;
  text += `🏠 ${property.title}\n\n`;
  text += `━━━━━━━━━━━━━\n`;
  text += `📍 *${locationLabel}* — ${property.listing_type === "kiralik" ? "Kiralık" : "Satılık"} ${typeLabel}\n`;
  if (property.area) text += `📐 ${property.area} m²`;
  if (property.rooms) text += ` · ${property.rooms}`;
  text += `\n\n`;

  text += `🔍 *${similar.length} benzer ilan bulundu* (${rawPrices.length} toplam, uç değerler kırpıldı)\n\n`;
  text += `💰 *Fiyat Aralığı*\n`;
  text += `   Min: ${fmt(minPrice)} TL\n`;
  text += `   Medyan: ${fmt(medianPrice)} TL\n`;
  text += `   Ort: ${fmt(avgPrice)} TL\n`;
  text += `   Max: ${fmt(maxPrice)} TL\n`;

  if (avgM2Price > 0) {
    text += `\n📐 *m² Birim Fiyat*\n   Ort: ${fmt(avgM2Price)} TL/m²\n`;
  }

  if (property.price && property.price > 0) {
    text += `\n━━━━━━━━━━━━━\n`;
    text += `🏷 *Sizin fiyatınız:* ${fmt(property.price)} TL\n`;
    text += `${positionText}\n`;

    const diff = property.price - medianPrice;
    const diffPct = Math.round((diff / medianPrice) * 100);
    if (diffPct > 0) {
      text += `Medyandan %${diffPct} yukarıda\n`;
    } else if (diffPct < 0) {
      text += `Medyandan %${Math.abs(diffPct)} aşağıda\n`;
    } else {
      text += `Medyanla aynı seviyede\n`;
    }
  }

  text += `\n_📊 Sahibinden verileri baz alınmıştır (istenen fiyatlar)_`;

  await sendText(ctx.phone, text);
  await logEvent(ctx.tenantId, ctx.userId, "fiyatbelirle", `${property.title} — ${similar.length} benzer ilan`);

  // Manual trigger — fiyatbelirle uses callback flow (list → select → analyze)
  // so router's post-command trigger fires too early (before analysis).
}
