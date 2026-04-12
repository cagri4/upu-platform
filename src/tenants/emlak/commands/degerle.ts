/**
 * /degerle — Property valuation, /mulkoner — Property recommendation
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
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

// ── /degerle — Property valuation ────────────────────────────────────

export async function handleDegerle(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: props } = await supabase
    .from("emlak_properties")
    .select("id, title, price, type, rooms, area, location_district")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!props || props.length === 0) {
    await sendButtons(ctx.phone, "📭 Portfoyunuzde değerlenecek mülk yok.", [
      { id: "cmd:mulkekle", title: "Mülk Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const rows = props.map(p => ({
    id: `dg:p:${p.id}`,
    title: ((p.title || "İsimsiz") as string).substring(0, 24),
    description: p.price ? formatPrice(p.price) : "",
  }));

  await sendList(ctx.phone, "🏠 Hangi mulkun piyasa değerini öğrenmek istiyorsunuz?", "Mülk Seç", [
    { title: "Mülkler", rows },
  ]);
}

export async function handleDegerleCallback(ctx: WaContext, data: string): Promise<void> {
  if (data === "dg:cancel") {
    await sendButtons(ctx.phone, "❌ Değerleme iptal edildi.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  if (data.startsWith("dg:p:")) {
    const propId = data.substring(5);
    const supabase = getServiceClient();

    const { data: prop } = await supabase
      .from("emlak_properties")
      .select("id, title, price, type, listing_type, rooms, area, location_district, location_neighborhood")
      .eq("id", propId)
      .single();

    if (!prop) {
      await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    await sendText(ctx.phone, "⏳ Piyasa verileri analiz ediliyor...");

    // Market query
    let query = supabase
      .from("emlak_properties")
      .select("id, price, area, rooms, title")
      .neq("id", prop.id)
      .gt("price", 0);

    if (prop.type) query = query.eq("type", prop.type);
    if (prop.listing_type) query = query.eq("listing_type", prop.listing_type);
    if (prop.location_district) query = query.ilike("location_district", `%${prop.location_district}%`);

    const { data: marketProps } = await query.limit(50);

    if (!marketProps || marketProps.length === 0) {
      await sendButtons(ctx.phone,
        `📍 ${prop.title}\n\n❌ Karşılaştırılacak yeterli piyasa verisi bulunamadı.`,
        [{ id: "cmd:menu", title: "Ana Menü" }],
      );
      return;
    }

    const prices = marketProps.map(p => p.price as number).sort((a, b) => a - b);
    const count = prices.length;
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / count);
    const min = prices[0];
    const max = prices[count - 1];
    const median = count % 2 === 0 ? Math.round((prices[count / 2 - 1] + prices[count / 2]) / 2) : prices[Math.floor(count / 2)];

    const myPrice = prop.price as number | null;
    let positionText = "";
    if (myPrice && myPrice > 0) {
      const pct = Math.round(((myPrice - avg) / avg) * 100);
      if (pct > 5) positionText = `📈 Mülkünüz piyasa ortalamasının %${pct} ÜSTÜNDE`;
      else if (pct < -5) positionText = `📉 Mülkünüz piyasa ortalamasının %${Math.abs(pct)} ALTINDA`;
      else positionText = `📊 Mülkünüz piyasa ortalamasına UYGUN`;
    }

    let result = `🏠 MÜLK DEĞERLEME RAPORU\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    result += `📋 ${prop.title}\n`;
    if (myPrice) result += `💰 Fiyat: ${formatPrice(myPrice)}\n`;
    if (prop.area) result += `📐 Alan: ${prop.area} m²\n`;
    result += `\n📊 PİYASA VERİSİ (${count} benzer ilan)\n`;
    result += `  Ortalama: ${formatPrice(avg)}\n`;
    result += `  Medyan: ${formatPrice(median)}\n`;
    result += `  En düşük: ${formatPrice(min)}\n`;
    result += `  En yüksek: ${formatPrice(max)}\n`;
    if (positionText) result += `\n${positionText}`;

    // AI-enhanced analysis
    let aiAnalysis = "";
    try {
      const { askClaude } = await import("@/platform/ai/claude");
      aiAnalysis = await askClaude(
        "Sen bir emlak degerleme uzmanisin. Kisa ve oz Turkce analiz yap (max 4 cumle). Sadece verilen verilere dayan, uydurma. Fiyat araligi ver, kesin deger verme. Veri yoksa belirt.",
        `Mulk: ${prop.title}, ${prop.area || "?"}m2, ${prop.rooms || "?"} oda, ${prop.listing_type}
Fiyat: ${myPrice ? formatPrice(myPrice) : "belirtilmemis"}
Bolge ortalama: ${formatPrice(avg)}
Medyan: ${formatPrice(median)}
Min-Max: ${formatPrice(min)} - ${formatPrice(max)}
Bolge ilan sayisi: ${count}
Veri kaynagi: ${count} sahibinden ilani`,
        512,
      );
    } catch { /* AI unavailable */ }

    if (aiAnalysis) {
      result += `\n\n🤖 AI ANALIZ:\n${aiAnalysis}`;
    }
    result += `\n\n_📊 ${count} sahibinden ilanına göre analiz_`;
    result += `\n_⚠️ Bu tahmindir, kesin değer için bağımsız değerleme yaptırın._`;

    await sendButtons(ctx.phone, result, [
      { id: "cmd:portfoyum", title: "Portföyüm" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    await logEvent(ctx.tenantId, ctx.userId, "degerle", `${prop.title} — ${count} benzer ilan`);
  }
}

// ── /mulkoner — Property recommendation ──────────────────────────────

export async function handleMulkOner(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "mulkoner", "budget");
  await sendText(ctx.phone, "💰 Müşterinizin bütçesi ne kadar?\n\nÖrnek: 5000000, 5M, 3.5 milyon, 800 bin");
}

export async function handleMulkOnerStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  if (!text) {
    await sendText(ctx.phone, "Lütfen bir değer yazın.");
    return;
  }

  if (session.current_step === "budget") {
    const budget = parsePrice(text);
    if (!budget || budget < 100_000) {
      await sendText(ctx.phone, "Geçerli bir bütçe yazın.\n\nÖrnek: 5000000, 5M, 3.5 milyon, 800 bin");
      return;
    }

    await updateSession(ctx.userId, "location", { budget });
    await sendText(ctx.phone, "📍 Hangi semtte arıyorsunuz?\n\nOrnek: Bodrum, Yalikavak\n\nTüm bölgeler için \"hepsi\" yazin.");
    return;
  }

  if (session.current_step === "location") {
    const semt = text.toLowerCase() === "hepsi" ? null : text;
    const d = session.data;
    const budget = d.budget as number;

    await endSession(ctx.userId);
    await showResults(ctx, budget, semt);
    return;
  }
}

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/TL/gi, "").replace(/-/g, "").trim();
  const mMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(?:M|milyon)$/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1].replace(",", ".")) * 1_000_000);
  const binMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*bin$/i);
  if (binMatch) return Math.round(parseFloat(binMatch[1].replace(",", ".")) * 1_000);
  const num = parseInt(cleaned.replace(/[.\s]/g, "").replace(",", ""), 10);
  return isNaN(num) ? null : num;
}

async function showResults(ctx: WaContext, budget: number, semt: string | null): Promise<void> {
  const supabase = getServiceClient();

  let exactQuery = supabase
    .from("emlak_properties")
    .select("id, title, price, rooms, area, type, location_district")
    .gt("price", 0)
    .lte("price", budget)
    .eq("status", "aktif");

  if (semt) exactQuery = exactQuery.ilike("location_district", `%${semt}%`);

  const { data: exactProps } = await exactQuery.order("price", { ascending: false }).limit(10);

  let stretchQuery = supabase
    .from("emlak_properties")
    .select("id, title, price, rooms, area, type, location_district")
    .gt("price", budget)
    .lte("price", budget * 1.2)
    .eq("status", "aktif");

  if (semt) stretchQuery = stretchQuery.ilike("location_district", `%${semt}%`);

  const { data: stretchProps } = await stretchQuery.order("price", { ascending: true }).limit(5);

  const exact = exactProps || [];
  const stretch = stretchProps || [];

  if (exact.length === 0 && stretch.length === 0) {
    await sendButtons(ctx.phone,
      `💰 ${formatPrice(budget)} butceyle ${semt || "tüm bölgelerde"} ilan bulunamadi.`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
    return;
  }

  let result = `🏠 MÜLK ÖNERİ RAPORU\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  result += `💰 Bütçe: ${formatPrice(budget)}${semt ? ` | 📍 ${semt}` : ""}\n\n`;

  if (exact.length > 0) {
    result += `✅ BÜTÇEYE UYGUN (${exact.length} ilan)\n`;
    for (const p of exact.slice(0, 5)) {
      result += `  • ${p.title || "İlan"}\n`;
      result += `    ${formatPrice(p.price)} | ${p.rooms || "—"} | ${p.location_district || "—"}\n`;
    }
    result += "\n";
  }

  if (stretch.length > 0) {
    result += `💡 BİRAZ ESNETİRSENİZ (+%20)\n`;
    for (const p of stretch.slice(0, 3)) {
      result += `  • ${p.title || "İlan"}\n`;
      result += `    ${formatPrice(p.price)} | ${p.rooms || "—"} | ${p.location_district || "—"}\n`;
    }
  }

  await sendButtons(ctx.phone, result, [
    { id: "cmd:portfoyum", title: "Portföyüm" },
    { id: "cmd:menu", title: "Ana Menü" },
  ]);

  const { triggerMissionCheck } = await import("@/platform/gamification/triggers");
  await triggerMissionCheck(ctx.userId, ctx.tenantKey, "mulkoner", ctx.phone);
}
