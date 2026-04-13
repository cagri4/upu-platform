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

    // Start foto_upload session — user can now send photos directly
    await startSession(ctx.userId, ctx.tenantId, "foto_upload", "waiting_photo");
    await updateSession(ctx.userId, "waiting_photo", { propertyId: propId, propertyTitle: prop.title });

    await sendButtons(ctx.phone,
      `📷 *${prop.title}*\n\nMevcut: ${existing} | Kalan: ${remaining}\n\n📱 Fotoğrafları şimdi gönderin — telefondan çekin veya galeriden seçin.\n\nBitirdiğinizde "Bitti" butonuna basın.`,
      [
        { id: "foto_done", title: "✅ Bitti" },
      ],
    );
    return;
  }

  if (data === "foto_done") {
    // Get session to find property ID for count
    const supabase = getServiceClient();
    const { data: sess } = await supabase
      .from("command_sessions")
      .select("data")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    const sessData = (sess?.data || {}) as Record<string, unknown>;
    const propId = sessData.propertyId as string;

    let countMsg = "";
    if (propId) {
      const { count } = await supabase
        .from("emlak_property_photos")
        .select("id", { count: "exact", head: true })
        .eq("property_id", propId);
      countMsg = ` (${count || 0} fotoğraf)`;
    }

    await endSession(ctx.userId);
    // Plain text — XP popup will provide the next corridor CTA
    await sendText(ctx.phone, `✅ Fotoğraf yükleme tamamlandı${countMsg}.`);

    // Gamification trigger (non-silent — foto milestone popup)
    try {
      const { triggerMissionCheck } = await import("@/platform/gamification/triggers");
      await triggerMissionCheck(ctx.userId, ctx.tenantKey, "mulk_foto_uploaded", ctx.phone);
    } catch { /* don't break */ }
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
      .select("id, title, type, listing_type, price, rooms, area, location_district, location_city, location_neighborhood, features, interior_features, exterior_features, view_features, description")
      .eq("id", propId)
      .eq("user_id", ctx.userId)
      .single();

    if (!prop) {
      await sendText(ctx.phone, "Mülk bulunamadı.");
      return;
    }

    // Minimum bilgi kontrolü
    const missing: string[] = [];
    if (!prop.title) missing.push("başlık");
    if (!prop.type) missing.push("mülk tipi");
    if (!prop.location_district) missing.push("ilçe");
    if (!prop.listing_type) missing.push("satılık/kiralık");

    if (missing.length > 0) {
      await sendText(ctx.phone,
        `⚠️ Post oluşturmak için şu bilgiler gerekli:\n${missing.map(m => `• ${m}`).join("\n")}\n\nÖnce mülk bilgilerini tamamlayın.`,
      );
      return;
    }

    await sendText(ctx.phone, "✍️ AI post hazırlıyor...");

    // Build property info for AI
    const loc = [prop.location_neighborhood, prop.location_district, prop.location_city].filter(Boolean).join(", ");
    const listLabel = prop.listing_type === "satilik" ? "Satılık" : prop.listing_type === "kiralik" ? "Kiralık" : prop.listing_type || "";
    const allFeatures = [
      ...(Array.isArray(prop.features) ? prop.features : []),
      ...(Array.isArray(prop.interior_features) ? prop.interior_features : []),
      ...(Array.isArray(prop.exterior_features) ? prop.exterior_features : []),
      ...(Array.isArray(prop.view_features) ? prop.view_features : []),
    ].filter(Boolean);

    const propertyInfo = JSON.stringify({
      baslik: prop.title,
      tip: prop.type,
      islem: listLabel,
      konum: loc,
      ilce: prop.location_district,
      mahalle: prop.location_neighborhood || "",
      oda: prop.rooms || "",
      metrekare: prop.area || "",
      fiyat: prop.price ? `${formatPrice(prop.price)} TL` : "Fiyat bilgisi için DM",
      ozellikler: allFeatures.slice(0, 10),
      aciklama: (prop.description || "").substring(0, 200),
    });

    const { askClaude } = await import("@/platform/ai/claude");
    const aiPost = await askClaude(
      `Sen profesyonel bir emlak sosyal medya uzmanısın. Instagram postu yazıyorsun.

Kurallar:
- Türkçe yaz, akıcı ve çekici
- İlk satır dikkat çekici emoji + başlık
- Mülkün öne çıkan 3-4 özelliğini vurgula
- Konumu ve bölgenin cazibesini belirt
- "Fiyat bilgisi için DM" yaz (direkt fiyat yazma)
- "Detay ve randevu için DM" ile bitir
- Sonuna 8-12 hashtag ekle (#emlak #gayrimenkul + bölge + tip + özellikler)
- Maksimum 150 kelime
- Emoji kullan ama abartma`,
      `Bu mülk için Instagram postu yaz:\n${propertyInfo}`,
      300,
    );

    let finalPost: string;
    if (aiPost && aiPost.length > 20) {
      finalPost = aiPost;
    } else {
      // Fallback — AI çalışmazsa basit şablon
      finalPost = `🏠 ${listLabel} ${prop.type || "Mülk"}\n\n📍 ${loc}\n`;
      if (prop.rooms) finalPost += `🛏 ${prop.rooms}`;
      if (prop.area) finalPost += ` | 📐 ${prop.area}m²`;
      finalPost += `\n💰 Fiyat bilgisi için DM\n📲 Detay için mesaj atın!\n\n`;
      finalPost += `#emlak #${listLabel?.toLowerCase() || "ilan"} #${(prop.location_district as string || "").toLowerCase().replace(/\s/g, "")} #gayrimenkul`;
    }

    let msg = `📱 *Instagram Postunuz Hazır!*\n\n`;
    msg += `━━━━━━━━━━━━━\n\n`;
    msg += finalPost;
    msg += `\n\n━━━━━━━━━━━━━\n\n`;
    msg += `👆 _Metni basılı tutarak kopyalayın ve Instagram'a yapıştırın._\n\n`;
    msg += `📸 *Fotoğraf önerileri:*\n`;
    msg += `• İlk fotoğraf: evin dışından genel görünüm\n`;
    msg += `• 2-3: salon ve mutfak\n`;
    msg += `• 4-5: yatak odaları\n`;
    msg += `• Son: manzara veya bahçe (varsa)\n`;
    msg += `• Doğal ışıkta çekin, geniş açı kullanın`;

    await sendText(ctx.phone, msg);

    // Manual trigger — callback flow
    const { triggerMissionCheck } = await import("@/platform/gamification/triggers");
    await triggerMissionCheck(ctx.userId, ctx.tenantKey, "paylas", ctx.phone);
    return;
  }
}

// ── /yayinla — Portal publishing (readiness check) ──────────────────

const REQUIRED_FIELDS = ["title", "price", "area", "rooms", "location_city", "location_district"] as const;

function checkReadiness(prop: Record<string, unknown>): string[] {
  const missing: string[] = [];
  const labels: Record<string, string> = {
    title: "başlık", price: "fiyat", area: "m²",
    rooms: "oda sayısı", location_city: "il", location_district: "ilçe",
  };
  for (const f of REQUIRED_FIELDS) {
    if (!prop[f]) missing.push(labels[f] || f);
  }
  return missing;
}

export async function handleYayinla(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, price, area, rooms, location_city, location_district")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!properties?.length) {
    await sendButtons(ctx.phone, "📤 Portföyünüzde mülk yok.", [
      { id: "cmd:mulkekle", title: "Mülk Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  // Check extension token
  const { data: extToken } = await supabase
    .from("extension_tokens")
    .select("token")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  // Split into ready and not-ready
  const ready: typeof properties = [];
  const notReady: Array<{ title: string; missing: string[] }> = [];

  for (const p of properties) {
    const missing = checkReadiness(p as Record<string, unknown>);
    if (missing.length === 0) {
      ready.push(p);
    } else {
      notReady.push({ title: (p.title as string) || "İsimsiz", missing });
    }
  }

  // Build message
  let text = "📤 *İlan Yayınlama*\n\n";

  if (ready.length > 0) {
    text += `✅ *${ready.length} mülk yayına hazır:*\n`;
    for (const p of ready.slice(0, 5)) {
      text += `• ${p.title} — ${p.price ? formatPrice(p.price) : ""}\n`;
    }
    if (ready.length > 5) text += `  ...ve ${ready.length - 5} mülk daha\n`;
    text += `\nChrome uzantınızı açarak bu mülkleri Sahibinden'e yayınlayabilirsiniz.\n`;
  }

  if (notReady.length > 0) {
    text += `\n⚠️ *${notReady.length} mülkte bilgi eksik:*\n`;
    for (const p of notReady.slice(0, 3)) {
      text += `• ${p.title} — _${p.missing.join(", ")} eksik_\n`;
    }
    if (notReady.length > 3) text += `  ...ve ${notReady.length - 3} mülk daha\n`;
    text += `\nEksik bilgileri tamamlamak için Mülk Yönet'i kullanın.\n`;
  }

  if (!extToken) {
    text += `\n🧩 Chrome uzantısını henüz kurmadıysanız, Sistem → Uzantı Kurulumu'ndan bilgi alabilirsiniz.`;
  }

  if (ready.length > 0) {
    await sendButtons(ctx.phone, text, [
      { id: "cmd:uzanti", title: "🧩 Uzantı Kurulumu" },
      { id: "cmd:mulkyonet", title: "✏️ Mülk Yönet" },
      { id: "cmd:menu", title: "📋 Ana Menü" },
    ]);
  } else {
    await sendButtons(ctx.phone, text, [
      { id: "cmd:mulkyonet", title: "✏️ Mülk Yönet" },
      { id: "cmd:menu", title: "📋 Ana Menü" },
    ]);
  }
}

export async function handleYayinlaCallback(ctx: WaContext, _data: string): Promise<void> {
  await handleYayinla(ctx);
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
