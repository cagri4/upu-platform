/**
 * /fotograf, /paylas, /yayinla, /websitem — Media & publishing commands
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
    await sendButtons(ctx.phone, "📷 Henuz mülkünüz yok. Once /mulkekle ile mulk ekleyin.", [
      { id: "cmd:mulkekle", title: "Mülk Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const rows = properties.map(p => ({
    id: `foto_select:${p.id}`,
    title: ((p.title || p.type || "Mulk") as string).substring(0, 24),
  }));

  await sendList(ctx.phone,
    "📷 *Fotoğraf Yükleme*\n\nFotoğraf eklemek istediğiniz mülkü seçin:",
    "Mülk Seç",
    [{ title: "Mülkler", rows }],
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
      await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
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
      await sendButtons(ctx.phone, `📷 "${prop.title}" için zaten 15 fotoğraf yüklenmiş.`, [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    await sendButtons(ctx.phone,
      `📷 *${prop.title}*\n\nMevcut: ${existing} | Kalan: ${remaining}\n\nFotoğrafları web panelden yükleyebilirsiniz. Fotoğraflar otomatik olarak optimize edilecek.`,
      [
        { id: "cmd:webpanel", title: "Web Panel" },
        { id: "cmd:menu", title: "Ana Menü" },
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
    await sendButtons(ctx.phone, "Henuz mülkünüz yok.", [
      { id: "cmd:mulkekle", title: "Mülk Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const rows = properties.map(p => ({
    id: `paylas_select:${p.id}`,
    title: ((p.title || "İsimsiz") as string).substring(0, 24),
    description: p.price ? formatPrice(p.price) : "",
  }));

  await sendList(ctx.phone, "📱 Hangi mülk için paylaşım hazırlayalım?", "Mülk Seç", [
    { title: "Mülkler", rows },
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
      await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    // Generate post template
    const priceStr = prop.price ? `💰 Fiyat bilgisi için DM` : "";
    const loc = [prop.location_district, prop.location_city].filter(Boolean).join(", ");
    const listLabel = prop.listing_type === "satilik" ? "Satılık" : prop.listing_type === "kiralik" ? "Kiralık" : "";

    let post = `🏠 ${listLabel} ${prop.type || "Mulk"}\n\n`;
    post += `📍 ${loc}\n`;
    if (prop.rooms) post += `🛏 ${prop.rooms}`;
    if (prop.area) post += ` | 📐 ${prop.area}m²`;
    post += `\n${priceStr}\n\n`;
    post += `📲 Detay için mesaj atın!\n\n`;
    post += `#emlak #${listLabel?.toLowerCase() || "ilan"} #${(prop.location_district as string || "").toLowerCase().replace(/\s/g, "")} #gayrimenkul`;

    await sendButtons(ctx.phone, `📱 Instagram Postu:\n\n${post}\n\n_Metni kopyalayıp Instagram'a yapıştırın._`, [
      { id: "cmd:menu", title: "Ana Menü" },
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
    await sendButtons(ctx.phone, "Portföyünüzde mülk yok.", [
      { id: "cmd:mulkekle", title: "Mülk Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const rows = properties.map(p => ({
    id: `pub:p:${p.id}`,
    title: ((p.title || "İsimsiz") as string).substring(0, 24),
    description: p.price ? formatPrice(p.price) : "",
  }));

  await sendList(ctx.phone, "📤 Hangi mülkü portala yayınlamak istiyorsunuz?", "Mülk Seç", [
    { title: "Mülkler", rows },
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
      await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    // Generate short 6-char extension token
    const { randomBytes } = await import("crypto");
    let extCode: string;

    const { data: existingToken } = await supabase
      .from("extension_tokens")
      .select("token")
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (existingToken) {
      extCode = existingToken.token.substring(0, 6).toUpperCase();
    } else {
      const fullToken = randomBytes(24).toString("hex");
      extCode = fullToken.substring(0, 6).toUpperCase();
      await supabase.from("extension_tokens").insert({
        user_id: ctx.userId,
        token: fullToken,
      });
    }

    const loc = [prop.location_neighborhood, prop.location_district, prop.location_city].filter(Boolean).join(", ");
    let text = `📤 *${prop.title || "İsimsiz"}*\n`;
    text += `💰 ${prop.price ? formatPrice(prop.price) : "—"} | 📍 ${loc}\n\n`;
    text += `Sahibinden'e yayınlamak için:\n\n`;
    text += `1. Extension'ı kurun:\nhttps://chromewebstore.google.com/detail/bcafoeijofbhelbanpfjhmhiokjnggbe\n`;
    text += `2. Bağlantı kodu: *${extCode}*\n`;
    text += `3. sahibinden.com/ilan-ver açın → Formu Doldur\n\n`;
    text += `_Tüm alanlar otomatik doldurulur._`;

    await supabase.from("emlak_publishing_history").insert({
      tenant_id: ctx.tenantId,
      property_id: propId,
      portal: "sahibinden",
      status: "prepared",
    });

    await sendButtons(ctx.phone, text, [
      { id: "cmd:portfoyum", title: "Portföyüm" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }
}

// ── /websitem — Personal website ─────────────────────────────────────

export async function handleWebsitem(ctx: WaContext): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://upu-platform.vercel.app";

  await sendButtons(ctx.phone,
    `🌐 Kişisel Web Siteniz\n\nWeb panelinizden kişisel emlak sitenizi oluşturabilir ve düzenleyebilirsiniz.\n\nPortföyünüzdeki aktif mülkler otomatik olarak sitenizde görünecek.`,
    [
      { id: "cmd:webpanel", title: "Web Panel" },
      { id: "cmd:menu", title: "Ana Menü" },
    ],
  );
}

export async function handleWebsitemStep(ctx: WaContext, session: CommandSession): Promise<void> {
  // Websitem is handled via web panel, no text steps needed
  await sendText(ctx.phone, "Web panelinizden sitenizi düzenleyebilirsiniz.");
  await endSession(ctx.userId);
}
