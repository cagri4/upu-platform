/**
 * /satistavsiye — AI-powered sales coaching for a property
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

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
    await sendButtons(ctx.phone, "📭 Portföyünüzde mülk yok.\n\nÖnce mülk ekleyin.", [
      { id: "cmd:mulkekle", title: "Mülk Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const rows = props.map(p => ({
    id: `st:p:${p.id}`,
    title: ((p.title || "İsimsiz") as string).substring(0, 24),
    description: p.price ? formatPrice(p.price) : "",
  }));

  await sendList(ctx.phone, "🎯 Hangi mülk için satış tavsiyesi istiyorsunuz?", "Mülk Seç", [
    { title: "Mülkler", rows },
  ]);
}

export async function handleSatisTavsiyeCallback(ctx: WaContext, data: string): Promise<void> {
  if (data === "st:cancel") {
    await sendButtons(ctx.phone, "❌ İptal edildi.", [{ id: "cmd:menu", title: "Ana Menü" }]);
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
      await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    await sendText(ctx.phone, "🧠 Mülk analiz ediliyor, satış stratejisi hazırlanıyor...");

    const typeLabels: Record<string, string> = { daire: "Daire", villa: "Villa", arsa: "Arsa", mustakil: "Müstakil" };
    const title = (prop.title as string) || "İsimsiz";
    const price = prop.price ? formatPrice(prop.price) : "Belirtilmemiş";
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
    let advice = `🎯 SATIŞ TAVSİYESİ\n━━━━━━━━━━━━━━━━━━━━━━\n`;
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
      advice += `🤖 AI TAVSİYELER:\n${aiAdvice}`;
    } else {
      // Fallback static advice
      advice += `📌 TAVSİYELER:\n`;
      advice += `1. Hedef müşteri profilini belirleyin\n`;
      advice += `2. Mülkün en güçlü 2-3 özelliğini vurgulayın\n`;
      advice += `3. Fiyat pazarlığına hazırlıklı olun\n`;
      advice += `4. Profesyonel fotoğraflar çektirin\n`;
      advice += `5. Birden fazla portalda yayınlayın`;
    }

    await sendButtons(ctx.phone, advice, [
      { id: "cmd:portfoyum", title: "Portföyüm" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    await logEvent(ctx.tenantId, ctx.userId, "satis_tavsiye", `${title}`);

    const { triggerMissionCheck } = await import("@/platform/gamification/triggers");
    await triggerMissionCheck(ctx.userId, ctx.tenantKey, "satistavsiye", ctx.phone);
  }
}
