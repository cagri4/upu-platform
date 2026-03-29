import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

export async function handleFiyatSor(ctx: WaContext): Promise<void> {
  try {
    // Parse location from text: "fiyatsor bodrum yalıkavak" or just "fiyatsor"
    const parts = ctx.text.split(/\s+/);
    const location = parts.slice(1).join(" ").trim();

    if (!location) {
      await sendText(ctx.phone,
        "📊 Fiyat Sorgusu\n\n" +
        "Semt veya mahalle adı yazın.\n\n" +
        "Örnek: fiyatsor Bodrum Yalıkavak\nÖrnek: fiyatsor Kaş Kalkan"
      );
      return;
    }

    const supabase = getServiceClient();

    // Get total count for data source label
    const { count: totalCount } = await supabase
      .from("emlak_properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "aktif");

    // Search properties matching location
    const { data: properties } = await supabase
      .from("emlak_properties")
      .select("price, area, rooms, type, listing_type, location_district, location_neighborhood")
      .or(`location_district.ilike.%${location}%,location_neighborhood.ilike.%${location}%,title.ilike.%${location}%`)
      .eq("status", "aktif")
      .not("price", "is", null)
      .limit(100);

    if (!properties || properties.length === 0) {
      await sendButtons(ctx.phone,
        `📊 "${location}" için veri bulunamadı.\n\nFarklı bir konum deneyin.`,
        [{ id: "cmd:menu", title: "Ana Menü" }],
      );
      return;
    }

    // Calculate stats
    const prices = properties.map(p => p.price as number).filter(p => p > 0);
    const areas = properties.map(p => p.area as number).filter(a => a > 0);

    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgM2Price = areas.length > 0
      ? Math.round(prices.reduce((sum, p, i) => sum + (areas[i] ? p / areas[i] : 0), 0) / areas.length)
      : 0;

    const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(n);

    // Count by type
    const satilik = properties.filter(p => p.listing_type === "satilik").length;
    const kiralik = properties.filter(p => p.listing_type === "kiralik").length;

    let text = `📊 *${location}* — Pazar Analizi\n\n`;
    text += `📋 Toplam: ${properties.length} ilan\n`;
    text += `🏷 Satılık: ${satilik} | Kiralık: ${kiralik}\n\n`;
    text += `💰 *Fiyat Aralığı*\n`;
    text += `   Min: ${fmt(minPrice)} TL\n`;
    text += `   Ort: ${fmt(avgPrice)} TL\n`;
    text += `   Max: ${fmt(maxPrice)} TL\n`;
    if (avgM2Price > 0) {
      text += `\n📐 *m² Birim Fiyat*\n   Ort: ${fmt(avgM2Price)} TL/m²\n`;
    }

    const countLabel = totalCount ? fmt(totalCount) : "10.000+";
    text += `\n\n_📊 ${countLabel} sahibinden ilanına göre_`;

    await sendButtons(ctx.phone, text, [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    await logEvent(ctx.tenantId, ctx.userId, "fiyat_sor", `${location} — ${properties.length} ilan`);
  } catch (err) {
    await handleError(ctx, "emlak:fiyatsor", err, "db");
  }
}
