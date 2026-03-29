/**
 * /satistavsiye — AI-powered sales coaching for a property
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("tr-TR").format(price) + " TL";
}

function extractSemt(neighborhood: string): string {
  const idx = neighborhood.indexOf(" / ");
  return idx > 0 ? neighborhood.substring(0, idx) : neighborhood;
}

export async function handleSatisTavsiye(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: props } = await supabase
    .from("emlak_properties")
    .select("id, title, price, type, rooms, area, location_district, description")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!props || props.length === 0) {
    await sendButtons(ctx.phone, "📭 Portfoyunuzde mulk yok.\n\nOnce /mulkekle ile mulk ekleyin.", [
      { id: "cmd:mulkekle", title: "Mulk Ekle" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  const rows = props.map(p => ({
    id: `st:p:${p.id}`,
    title: ((p.title || "Isimsiz") as string).substring(0, 24),
    description: p.price ? formatPrice(p.price) : "",
  }));

  await sendList(ctx.phone, "🎯 Hangi mulk icin satis tavsiyesi istiyorsunuz?", "Mulk Sec", [
    { title: "Mulkler", rows },
  ]);
}

export async function handleSatisTavsiyeCallback(ctx: WaContext, data: string): Promise<void> {
  if (data === "st:cancel") {
    await sendButtons(ctx.phone, "❌ Iptal edildi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  if (data.startsWith("st:p:")) {
    const propId = data.substring(5);
    const supabase = getServiceClient();

    const { data: prop } = await supabase
      .from("emlak_properties")
      .select("id, title, price, type, listing_type, rooms, area, location_district, description")
      .eq("id", propId)
      .eq("user_id", ctx.userId)
      .single();

    if (!prop) {
      await sendButtons(ctx.phone, "Mulk bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    await sendText(ctx.phone, "🧠 Mulk analiz ediliyor, satis stratejisi hazirlaniyor...");

    const typeLabels: Record<string, string> = { daire: "Daire", villa: "Villa", arsa: "Arsa", mustakil: "Mustakil" };
    const title = (prop.title as string) || "Isimsiz";
    const price = prop.price ? formatPrice(prop.price) : "Belirtilmemis";
    const typeLabel = prop.type ? (typeLabels[prop.type] || prop.type) : "—";
    const loc = (prop.location_district as string) || "—";

    // Market context
    let marketInfo = "";
    if (prop.type && prop.location_district) {
      const { data: marketProps } = await supabase
        .from("emlak_properties")
        .select("price")
        .eq("type", prop.type)
        .ilike("location_district", `%${prop.location_district}%`)
        .neq("id", propId)
        .gt("price", 0)
        .limit(50);

      if (marketProps && marketProps.length > 0) {
        const prices = marketProps.map(p => p.price as number);
        const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
        marketInfo = `\n📊 Piyasa: ${marketProps.length} benzer ilan, ort. ${formatPrice(avg)}`;
      }
    }

    // Build sales advice
    let advice = `🎯 SATIS TAVSIYESI\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    advice += `📋 ${title}\n💰 ${price} | 📍 ${loc} | 🏠 ${typeLabel}\n`;
    if (prop.rooms) advice += `🛏 ${prop.rooms}`;
    if (prop.area) advice += ` | 📐 ${prop.area} m²`;
    advice += marketInfo;
    advice += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // AI-enhanced sales advice
    let aiAdvice = "";
    try {
      const { askClaude } = await import("@/platform/ai/claude");
      aiAdvice = await askClaude(
        "Sen deneyimli bir emlak satis danismanisin. Kisa, pratik, uygulanabilir satis tavsiyesi ver (max 5 madde). Turkce yaz.",
        `Mulk: ${title}, ${price}, ${prop.area || "?"}m2, ${loc}
Tur: ${typeLabel}, ${prop.listing_type || "?"}
Oda: ${prop.rooms || "bilinmiyor"}
${marketInfo ? `Piyasa bilgisi: ${marketInfo}` : "Piyasa verisi yok"}
Aciklama: ${(prop.description as string) || "yok"}`,
        512,
      );
    } catch { /* AI unavailable */ }

    if (aiAdvice) {
      advice += `🤖 AI TAVSIYELER:\n${aiAdvice}`;
    } else {
      // Fallback static advice
      advice += `📌 TAVSIYELER:\n`;
      advice += `1. Hedef musteri profilini belirleyin\n`;
      advice += `2. Mulkun en guclu 2-3 ozelligini vurgulayin\n`;
      advice += `3. Fiyat pazarligina hazirlikli olun\n`;
      advice += `4. Profesyonel fotograflar cektirin\n`;
      advice += `5. Birden fazla portalda yayinlayin`;
    }

    await sendButtons(ctx.phone, advice, [
      { id: "cmd:portfoyum", title: "Portfoyum" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
