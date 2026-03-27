/**
 * /fotograf, /paylas, /yayinla, /websitem — Media & publishing commands
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("tr-TR").format(price) + " TL";
}

// ── /fotograf — Photo upload guidance ────────────────────────────────

export async function handleFotograf(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, type")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!properties || properties.length === 0) {
    await sendButtons(ctx.phone, "📷 Henuz mulkunuz yok. Once /mulkekle ile mulk ekleyin.", [
      { id: "cmd:mulkekle", title: "Mulk Ekle" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  const rows = properties.map(p => ({
    id: `foto_select:${p.id}`,
    title: ((p.title || p.type || "Mulk") as string).substring(0, 24),
  }));

  await sendList(ctx.phone,
    "📷 *Fotograf Yukleme*\n\nFotograf eklemek istediginiz mulku secin:",
    "Mulk Sec",
    [{ title: "Mulkler", rows }],
  );
}

export async function handleFotografCallback(ctx: WaContext, data: string): Promise<void> {
  if (data.startsWith("foto_select:")) {
    const propId = data.split(":")[1];
    const supabase = getServiceClient();

    const { data: prop } = await supabase
      .from("emlak_properties")
      .select("id, title")
      .eq("id", propId)
      .eq("user_id", ctx.userId)
      .single();

    if (!prop) {
      await sendButtons(ctx.phone, "Mulk bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    // Get photo count
    const { count } = await supabase
      .from("emlak_property_photos")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propId);

    const existing = count || 0;
    const remaining = 15 - existing;

    if (remaining <= 0) {
      await sendButtons(ctx.phone, `📷 "${prop.title}" icin zaten 15 fotograf yuklenmiş.`, [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    await sendButtons(ctx.phone,
      `📷 *${prop.title}*\n\nMevcut: ${existing} | Kalan hak: ${remaining}\n\nFotograflari web panelden yukleyebilirsiniz. Fotograflar otomatik olarak optimize edilecek.`,
      [
        { id: "cmd:webpanel", title: "Web Panel" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
    return;
  }
}

// ── /paylas — Social media post generator ────────────────────────────

export async function handlePaylas(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, price, type, rooms, location_district")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!properties || properties.length === 0) {
    await sendButtons(ctx.phone, "Henuz mulkunuz yok.", [
      { id: "cmd:mulkekle", title: "Mulk Ekle" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  const rows = properties.map(p => ({
    id: `paylas_select:${p.id}`,
    title: ((p.title || "Isimsiz") as string).substring(0, 24),
    description: p.price ? formatPrice(p.price) : "",
  }));

  await sendList(ctx.phone, "📱 Hangi mulk icin paylasim hazirlayalim?", "Mulk Sec", [
    { title: "Mulkler", rows },
  ]);
}

export async function handlePaylasCallback(ctx: WaContext, data: string): Promise<void> {
  if (data.startsWith("paylas_select:")) {
    const propId = data.split(":")[1];
    const supabase = getServiceClient();

    const { data: prop } = await supabase
      .from("emlak_properties")
      .select("id, title, type, listing_type, price, rooms, area, location_district, location_city")
      .eq("id", propId)
      .eq("user_id", ctx.userId)
      .single();

    if (!prop) {
      await sendButtons(ctx.phone, "Mulk bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    // Generate post template
    const priceStr = prop.price ? `💰 Fiyat bilgisi icin DM` : "";
    const loc = [prop.location_district, prop.location_city].filter(Boolean).join(", ");
    const listLabel = prop.listing_type === "satilik" ? "Satilik" : prop.listing_type === "kiralik" ? "Kiralik" : "";

    let post = `🏠 ${listLabel} ${prop.type || "Mulk"}\n\n`;
    post += `📍 ${loc}\n`;
    if (prop.rooms) post += `🛏 ${prop.rooms}`;
    if (prop.area) post += ` | 📐 ${prop.area}m²`;
    post += `\n${priceStr}\n\n`;
    post += `📲 Detay icin mesaj atin!\n\n`;
    post += `#emlak #${listLabel?.toLowerCase() || "ilan"} #${(prop.location_district as string || "").toLowerCase().replace(/\s/g, "")} #gayrimenkul`;

    await sendButtons(ctx.phone, `📱 Instagram Postu:\n\n${post}\n\n_Metni kopyalayip Instagram'a yapistirin._`, [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }
}

// ── /yayinla — Portal publishing ─────────────────────────────────────

export async function handleYayinla(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, price")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!properties || properties.length === 0) {
    await sendButtons(ctx.phone, "Portfoyunuzde mulk yok.", [
      { id: "cmd:mulkekle", title: "Mulk Ekle" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  const rows = properties.map(p => ({
    id: `pub:p:${p.id}`,
    title: ((p.title || "Isimsiz") as string).substring(0, 24),
    description: p.price ? formatPrice(p.price) : "",
  }));

  await sendList(ctx.phone, "📤 Hangi mulku portala yayinlamak istiyorsunuz?", "Mulk Sec", [
    { title: "Mulkler", rows },
  ]);
}

export async function handleYayinlaCallback(ctx: WaContext, data: string): Promise<void> {
  if (data.startsWith("pub:p:")) {
    const propId = data.substring(6);
    const supabase = getServiceClient();

    const { data: prop } = await supabase
      .from("emlak_properties")
      .select("id, title, price, type, rooms, area, description, location_district, location_city, location_neighborhood")
      .eq("id", propId)
      .eq("user_id", ctx.userId)
      .single();

    if (!prop) {
      await sendButtons(ctx.phone, "Mulk bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    // Build portal-ready listing text
    const loc = [prop.location_neighborhood, prop.location_district, prop.location_city].filter(Boolean).join(", ");
    let text = `📤 PORTAL YAYIN BILGILERI\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📋 ${prop.title || "Isimsiz"}\n`;
    text += `💰 ${prop.price ? formatPrice(prop.price) : "—"}\n`;
    text += `📍 ${loc}\n`;
    if (prop.rooms) text += `🛏 ${prop.rooms}`;
    if (prop.area) text += ` | 📐 ${prop.area} m²`;
    text += `\n`;
    if (prop.description) text += `\n📝 ${(prop.description as string).substring(0, 300)}\n`;
    text += `\n💡 Bu bilgileri Sahibinden, Hepsiemlak veya Emlakjet'e kopyalayabilirsiniz.`;

    // Record publishing
    await supabase.from("emlak_publishing_history").insert({
      tenant_id: ctx.tenantId,
      property_id: propId,
      portal: "manual",
      status: "prepared",
    });

    await sendButtons(ctx.phone, text, [
      { id: "cmd:portfoyum", title: "Portfoyum" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }
}

// ── /websitem — Personal website ─────────────────────────────────────

export async function handleWebsitem(ctx: WaContext): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://upu-platform.vercel.app";

  await sendButtons(ctx.phone,
    `🌐 Kisisel Web Siteniz\n\nWeb panelinizden kisisel emlak sitenizi olusturabilir ve duzenleyebilirsiniz.\n\nPortfoyunuzdeki aktif mulkler otomatik olarak sitenizde gorunecek.`,
    [
      { id: "cmd:webpanel", title: "Web Panel" },
      { id: "cmd:menu", title: "Ana Menu" },
    ],
  );
}

export async function handleWebsitemStep(ctx: WaContext, session: CommandSession): Promise<void> {
  // Websitem is handled via web panel, no text steps needed
  await sendText(ctx.phone, "Web panelinizden sitenizi duzenleyebilirsiniz.");
  await endSession(ctx.userId);
}
