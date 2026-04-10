/**
 * /mulkdetay, /mulkduzenle, /mulksil — Property management
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession, getSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

// ── Helpers ──────────────────────────────────────────────────────────

function formatPrice(price: number | null | undefined): string {
  if (!price || price === 0) return "—";
  const num = Number(price);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M TL`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)} bin TL`;
  return `${num.toLocaleString("tr-TR")} TL`;
}

const TYPE_LABELS: Record<string, string> = {
  daire: "Daire", villa: "Villa", mustakil: "Müstakil", rezidans: "Rezidans",
  yazlik: "Yazlık", arsa: "Arsa", isyeri: "İşyeri", buro_ofis: "Büro/Ofis",
  dukkan: "Dükkan", bina: "Bina", depo: "Depo",
};

// Page 1: Temel bilgiler (ilk gösterilen)
const FIELDS_PAGE_1 = [
  { key: "title", label: "Başlık", dbColumn: "title", hint: "İlan başlığı" },
  { key: "price", label: "Fiyat", dbColumn: "price", hint: "Örnek: 4.5M, 25 bin" },
  { key: "area", label: "Alan (m²)", dbColumn: "area", hint: "Örnek: 120" },
  { key: "rooms", label: "Oda Sayısı", dbColumn: "rooms", hint: "Örnek: 3+1" },
  { key: "description", label: "Açıklama", dbColumn: "description", hint: "İlan açıklaması" },
  { key: "listing_type", label: "İlan Türü", dbColumn: "listing_type", hint: "satilik / kiralik" },
  { key: "type", label: "Mülk Tipi", dbColumn: "type", hint: "daire/villa/arsa vb." },
  { key: "floor", label: "Kat", dbColumn: "floor", hint: "Bodrum / Zemin / 1 / 2 / ... / 6-10 / 11+" },
  { key: "building_age", label: "Bina Yaşı", dbColumn: "building_age", hint: "0 (Yeni) / 1-4 / 5-10 / 11-15 / 16-20 / 21+" },
];

// Page 2: Konum + detaylar (ikinci sayfa)
const FIELDS_PAGE_2 = [
  { key: "location_city", label: "Şehir", dbColumn: "location_city", hint: "Örnek: Muğla" },
  { key: "location_district", label: "İlçe", dbColumn: "location_district", hint: "Örnek: Bodrum" },
  { key: "location_neighborhood", label: "Mahalle", dbColumn: "location_neighborhood", hint: "Örnek: Yalıkavak" },
  { key: "net_area", label: "Net Alan (m²)", dbColumn: "net_area", hint: "Örnek: 110" },
  { key: "total_floors", label: "Toplam Kat", dbColumn: "total_floors", hint: "1 / 2 / ... / 6-10 / 11-15 / 16-20 / 21+" },
  { key: "heating", label: "Isınma", dbColumn: "heating", hint: "Kombi (Doğalgaz) / Merkezi / Yerden Isıtma / Klima / Soba / Yok" },
  { key: "parking", label: "Otopark", dbColumn: "parking", hint: "Açık Otopark / Kapalı Otopark / Açık & Kapalı / Yok" },
  { key: "facade", label: "Cephe", dbColumn: "facade", hint: "Kuzey / Güney / Doğu / Batı" },
  { key: "deed_type", label: "Tapu Durumu", dbColumn: "deed_type", hint: "Kat Mülkiyetli / Kat İrtifaklı / Hisseli Tapu / Müstakil Tapulu" },
];

// Page 3: Boolean + diğer
const FIELDS_PAGE_3 = [
  { key: "elevator", label: "Asansör", dbColumn: "elevator", hint: "Var / Yok (evet/hayır)" },
  { key: "balcony", label: "Balkon", dbColumn: "balcony", hint: "Var / Yok (evet/hayır)" },
  { key: "swap", label: "Takas", dbColumn: "swap", hint: "Evet / Hayır" },
  { key: "bathroom_count", label: "Banyo Sayısı", dbColumn: "bathroom_count", hint: "1 / 2 / 3 / 4+" },
  { key: "kitchen_type", label: "Mutfak Tipi", dbColumn: "kitchen_type", hint: "Açık (Amerikan) / Kapalı" },
  { key: "housing_type", label: "Konut Tipi", dbColumn: "housing_type", hint: "Ara Kat / En Üst Kat / Dubleks / Bahçe Dubleksi / Çatı Dubleksi / Tripleks" },
  { key: "usage_status", label: "Kullanım Durumu", dbColumn: "usage_status", hint: "Boş / Kiracılı / Mülk Sahibi" },
  { key: "network_commission_note", label: "Komisyon Notu", dbColumn: "network_commission_note", hint: "Ortak pazar için not" },
];

const ALL_EDITABLE_FIELDS = [...FIELDS_PAGE_1, ...FIELDS_PAGE_2, ...FIELDS_PAGE_3];
const EDITABLE_FIELDS = ALL_EDITABLE_FIELDS; // backward compat

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/TL/gi, "").replace(/-/g, "").trim();
  const mMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(?:M|milyon)$/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1].replace(",", ".")) * 1_000_000);
  const binMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*bin$/i);
  if (binMatch) return Math.round(parseFloat(binMatch[1].replace(",", ".")) * 1_000);
  const num = parseInt(cleaned.replace(/[.\s]/g, "").replace(",", ""), 10);
  return isNaN(num) ? null : num;
}

// ── /mulkyonet — Unified property management ─────────────────────────

export async function handleMulkYonet(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, price, listing_type")
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
    id: `mulkyonet_select:${p.id}`,
    title: ((p.title || "İsimsiz") as string).substring(0, 24),
    description: formatPrice(p.price),
  }));

  await sendList(ctx.phone, "🏠 Yönetmek istediğiniz mülkü seçin:", "Mülk Seç", [
    { title: "Mülkler", rows },
  ]);
}

export async function handleMulkYonetSelectCallback(ctx: WaContext, callbackData: string): Promise<void> {
  const propertyId = callbackData.replace("mulkyonet_select:", "");
  const supabase = getServiceClient();

  const { data: prop } = await supabase
    .from("emlak_properties")
    .select("id, title")
    .eq("id", propertyId)
    .eq("user_id", ctx.userId)
    .single();

  if (!prop) {
    await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  await sendList(ctx.phone, `🏠 *${prop.title || "İsimsiz"}*\n\nBu mülk ile ne yapmak istersiniz?`, "İşlem Seç", [
    {
      title: "Mülk İşlemleri",
      rows: [
        { id: `mulkyonet_act:detay:${propertyId}`, title: "📋 Detay Gör", description: "Mülk bilgilerini görüntüle" },
        { id: `mulkyonet_act:duzenle:${propertyId}`, title: "✏️ Düzenle", description: "Bilgileri güncelle" },
        { id: `mulkyonet_act:statu:${propertyId}`, title: "📊 Statü Değiştir", description: "Satıldı/Kiralandı/Pasif" },
        { id: `mulkyonet_act:foto:${propertyId}`, title: "📸 Fotoğraf", description: "Fotoğraf ekle/görüntüle" },
        { id: `mulkyonet_act:degerle:${propertyId}`, title: "💰 Değerleme", description: "Piyasa karşılaştırması" },
        { id: `mulkyonet_act:paylas:${propertyId}`, title: "📱 Paylaş", description: "Sosyal medya paylaşım metni" },
        { id: `mulkyonet_act:sunum:${propertyId}`, title: "🎯 Sunum Hazırla", description: "Müşteriye sunum oluştur" },
        { id: `mulkyonet_act:esles:${propertyId}`, title: "🤝 Müşteri Eşleştir", description: "Uygun müşteri bul" },
        { id: `mulkyonet_act:sil:${propertyId}`, title: "🗑 Sil", description: "Mülkü tamamen sil" },
      ],
    },
  ]);
}

export async function handleMulkYonetActionCallback(ctx: WaContext, callbackData: string): Promise<void> {
  const parts = callbackData.replace("mulkyonet_act:", "").split(":");
  const action = parts[0];
  const propertyId = parts.slice(1).join(":");

  if (action === "detay") {
    await handleMulkDetayCallback(ctx, `mulkdetay:${propertyId}`);
  } else if (action === "duzenle") {
    await handleMulkDuzenleCallback(ctx, `mulkduzenle:${propertyId}`);
  } else if (action === "sil") {
    await handleMulkSilCallback(ctx, `mulksil:${propertyId}`);
  } else if (action === "statu") {
    await showStatusOptions(ctx, propertyId);
  } else if (action === "statu_set") {
    const pid = parts[1];
    const newStatus = parts[2];
    await applyStatusChange(ctx, pid, newStatus);
  } else if (action === "foto") {
    // Redirect to fotograf command with property context
    const { handleFotografCallback } = await import("./medya");
    await handleFotografCallback(ctx, `foto_select:${propertyId}`);
  } else if (action === "degerle") {
    // Run valuation for this specific property
    const { handleDegerleCallback } = await import("./degerle");
    await handleDegerleCallback(ctx, `dg:${propertyId}`);
  } else if (action === "paylas") {
    // Generate share text for this property
    const { handlePaylasCallback } = await import("./medya");
    await handlePaylasCallback(ctx, `paylas_select:${propertyId}`);
  } else if (action === "sunum") {
    // Start presentation with this property pre-selected
    await sendButtons(ctx.phone, "🎯 Sunum hazırlamak için önce müşteriyi seçmeniz gerekiyor.", [
      { id: "cmd:sunum", title: "🎯 Sunum Başlat" },
      { id: "cmd:mulkyonet", title: "🔙 Geri" },
    ]);
  } else if (action === "esles") {
    // Match customers for this property
    const { handleEslestirCallback } = await import("./eslestir");
    await handleEslestirCallback(ctx, `esles:${propertyId}`);
  }
}

// ── /mulkdetay — Show property detail card ──────────────────────────

export async function handleMulkDetay(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const args = ctx.text.split(" ").slice(1).join(" ").trim();

  if (args) {
    // Direct ID or search
    const { data: prop } = await supabase
      .from("emlak_properties")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("tenant_id", ctx.tenantId)
      .ilike("title", `%${args}%`)
      .limit(1)
      .maybeSingle();

    if (prop) {
      await showPropertyDetail(ctx, prop);
      return;
    }
  }

  // No args or not found — show property list
  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, price, type, status")
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
    id: `mulkdetay:${p.id}`,
    title: ((p.title || "İsimsiz") as string).substring(0, 24),
    description: formatPrice(p.price),
  }));

  await sendList(ctx.phone, "Detay görmek istediğiniz mülkü seçin:", "Mülk Seç", [
    { title: "Mülkler", rows },
  ]);
}

async function showPropertyDetail(ctx: WaContext, prop: Record<string, unknown>): Promise<void> {
  const typeLabel = prop.type ? (TYPE_LABELS[prop.type as string] || prop.type) : "—";
  const listLabel = prop.listing_type === "satilik" ? "Satılık" : prop.listing_type === "kiralik" ? "Kiralık" : (prop.listing_type as string) || "—";

  let text = `*${(prop.title as string) || "İsimsiz"}*\n\n`;

  // Temel
  text += `🏠 Tip: ${typeLabel} | 🏷 ${listLabel}\n`;
  text += `💰 Fiyat: ${formatPrice(prop.price as number)}\n`;
  text += `📐 Brüt: ${prop.area || "—"} m²`;
  if (prop.net_area) text += ` | Net: ${prop.net_area} m²`;
  text += `\n`;
  text += `🛏 Oda: ${prop.rooms || "—"}\n`;

  // Konum
  const loc = [prop.location_neighborhood, prop.location_district, prop.location_city].filter(Boolean).join(", ");
  if (loc) text += `📍 ${loc}\n`;

  // Bina
  if (prop.floor !== null && prop.floor !== undefined) {
    text += `🏢 Kat: ${prop.floor === 0 ? "Giriş" : prop.floor}`;
    if (prop.total_floors) text += ` / ${prop.total_floors}`;
    text += `\n`;
  }
  if (prop.building_age !== null && prop.building_age !== undefined) text += `🏗 Bina yaşı: ${prop.building_age}\n`;
  if (prop.heating) text += `🔥 Isınma: ${prop.heating}\n`;
  if (prop.parking) text += `🅿️ Otopark: ${prop.parking}\n`;
  if (prop.facade) text += `🧭 Cephe: ${prop.facade}\n`;
  if (prop.deed_type) text += `📜 Tapu: ${prop.deed_type}\n`;
  if (prop.housing_type) text += `🏗 Yapı: ${prop.housing_type}\n`;
  if (prop.usage_status) text += `🔑 Kullanım: ${prop.usage_status}\n`;
  if (prop.swap === true) text += `🔄 Takas: Evet\n`;
  if (prop.swap === false) text += `🔄 Takas: Hayır\n`;

  // Detaylar
  if (prop.bathroom_count) text += `🚿 Banyo: ${prop.bathroom_count}\n`;
  if (prop.kitchen_type) text += `🍳 Mutfak: ${prop.kitchen_type}\n`;
  if (prop.elevator === true) text += `🛗 Asansör: Var\n`;
  if (prop.elevator === false) text += `🛗 Asansör: Yok\n`;
  if (prop.balcony === true) text += `🏠 Balkon: Var\n`;
  if (prop.balcony === false) text += `🏠 Balkon: Yok\n`;

  // Özellikler
  if (prop.interior_features) text += `\n🏷 İç: ${(prop.interior_features as string).substring(0, 100)}\n`;
  if (prop.exterior_features) text += `🌿 Dış: ${(prop.exterior_features as string).substring(0, 100)}\n`;
  if (prop.view_features) text += `🏔 Manzara: ${prop.view_features}\n`;
  if (prop.transportation) text += `🚌 Ulaşım: ${(prop.transportation as string).substring(0, 100)}\n`;

  // Açıklama
  if (prop.description) text += `\n📝 ${((prop.description as string)).substring(0, 300)}\n`;

  // Kaynak
  if (prop.source_url) text += `\n🔗 ${(prop.source_url as string).substring(0, 60)}...\n`;

  text += `\n🆔 ${(prop.id as string).substring(0, 8)} | 📊 ${prop.status || "aktif"}`;

  await sendButtons(ctx.phone, text, [
    { id: `mulkyonet_select:${prop.id}`, title: "⚙️ İşlem Yap" },
    { id: "cmd:mulkyonet", title: "🔙 Mülk Yönet" },
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}

// ── /mulkdetay callback ──────────────────────────────────────────────

export async function handleMulkDetayCallback(ctx: WaContext, data: string): Promise<void> {
  const propId = data.replace("mulkdetay:", "");
  const supabase = getServiceClient();

  const { data: prop } = await supabase
    .from("emlak_properties")
    .select("*")
    .eq("id", propId)
    .eq("user_id", ctx.userId)
    .single();

  if (!prop) {
    await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  await showPropertyDetail(ctx, prop);
}

// ── /mulkduzenle — Edit property ─────────────────────────────────────

export async function handleMulkDuzenle(ctx: WaContext): Promise<void> {
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
    id: `mulkduzenle:${p.id}`,
    title: ((p.title || "İsimsiz") as string).substring(0, 24),
    description: formatPrice(p.price),
  }));

  await sendList(ctx.phone, "Düzenlemek istediğiniz mülkü seçin:", "Mülk Seç", [
    { title: "Mülkler", rows },
  ]);
}

export async function handleMulkDuzenleCallback(ctx: WaContext, data: string): Promise<void> {
  const propId = data.replace("mulkduzenle:", "");
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

  await startSession(ctx.userId, ctx.tenantId, "mulkduzenle", "select_field");
  await updateSession(ctx.userId, "select_field", { propertyId: propId, propertyTitle: prop.title });

  // Page system — show page 1 by default, with "Devam" for more
  const page = (data.match(/mulkduzenle:(.+)/)?.[1] === propId) ? 1 : 1;
  await showEditFieldPage(ctx.phone, propId, prop.title, 1);
}

// Show edit fields with pagination — shows CURRENT values so user
// knows what's filled and what's empty before picking a field.
async function showEditFieldPage(phone: string, propId: string, title: string, page: number) {
  const supabase = getServiceClient();
  const pages = [FIELDS_PAGE_1, FIELDS_PAGE_2, FIELDS_PAGE_3];
  const totalPages = pages.length;
  const fields = pages[page - 1] || FIELDS_PAGE_1;

  // Fetch current property values to show in descriptions
  const columns = fields.map(f => f.dbColumn).join(", ");
  const { data: prop } = await supabase
    .from("emlak_properties")
    .select(columns)
    .eq("id", propId)
    .maybeSingle();

  const propObj = (prop || {}) as Record<string, unknown>;
  const rows = fields.map(f => {
    const currentVal = propObj[f.dbColumn];
    let desc: string;
    if (currentVal !== null && currentVal !== undefined && currentVal !== "") {
      // Show current value
      const valStr = typeof currentVal === "boolean"
        ? (currentVal ? "Evet" : "Hayır")
        : String(currentVal);
      desc = `Mevcut: ${valStr}`.substring(0, 72);
    } else {
      desc = `Boş — ${f.hint}`.substring(0, 72);
    }
    return {
      id: `mulkedit:${f.key}:${propId}`,
      title: f.label.substring(0, 24),
      description: desc,
    };
  });

  // Add navigation row if not last page
  if (page < totalPages) {
    rows.push({
      id: `mulkeditpage:${page + 1}:${propId}`,
      title: `▶ Sayfa ${page + 1}/${totalPages}`,
      description: "Daha fazla alan göster",
    });
  }

  await sendList(phone,
    `"${title}" — Düzenlenecek alan seçin (${page}/${totalPages}):`,
    "Alan Seç",
    [{ title: `Alanlar (${page}/${totalPages})`, rows }],
  );
}

export async function handleMulkEditFieldCallback(ctx: WaContext, data: string): Promise<void> {
  // mulkeditpage:pageNum:propId — page navigation
  if (data.startsWith("mulkeditpage:")) {
    const parts = data.split(":");
    const page = parseInt(parts[1], 10);
    const propId = parts.slice(2).join(":");
    const supabase = getServiceClient();
    const { data: prop } = await supabase.from("emlak_properties").select("title").eq("id", propId).single();
    await showEditFieldPage(ctx.phone, propId, prop?.title || "", page);
    return;
  }

  // mulkedit:field:propId
  const parts = data.split(":");
  if (parts.length < 3) return;
  const field = parts[1];
  const propId = parts.slice(2).join(":");

  const fieldDef = EDITABLE_FIELDS.find(f => f.key === field);
  if (!fieldDef) return;

  await startSession(ctx.userId, ctx.tenantId, "mulkduzenle", "waiting_value");
  await updateSession(ctx.userId, "waiting_value", { propertyId: propId, field, dbColumn: fieldDef.dbColumn });

  await sendText(ctx.phone, `${fieldDef.label} için yeni değeri yazın:\n\n${fieldDef.hint}`);
}

export async function handleMulkDuzenleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  if (!text) {
    await sendText(ctx.phone, "Lütfen bir değer yazın.");
    return;
  }

  // Handle feedback rating after status change
  if (session.current_step === "feedback_rating") {
    const rating = parseInt(text, 10);
    if (isNaN(rating) || rating < 1 || rating > 10) {
      await sendText(ctx.phone, "1 ile 10 arasında bir sayı yazın:");
      return;
    }

    const { propertyId, propertyTitle, newStatus } = session.data as {
      propertyId: string; propertyTitle: string; newStatus: string;
    };

    // Ask for optional comment
    await updateSession(ctx.userId, "feedback_comment", {
      propertyId, propertyTitle, newStatus, rating,
    });

    await sendText(ctx.phone,
      `Puan: ${rating}/10 ✓\n\nÖneriniz veya yorumunuz var mı?\n(Yoksa "yok" yazın)`
    );
    return;
  }

  if (session.current_step === "feedback_comment") {
    const { propertyId, propertyTitle, newStatus, rating } = session.data as {
      propertyId: string; propertyTitle: string; newStatus: string; rating: number;
    };

    const comment = text.toLowerCase() === "yok" ? null : text;

    // Save feedback to platform_events
    const supabase = getServiceClient();
    await supabase.from("platform_events").insert({
      user_id: ctx.userId,
      tenant_id: ctx.tenantId,
      event_type: "sale_feedback",
      payload: {
        property_id: propertyId,
        property_title: propertyTitle,
        status_change: newStatus,
        system_rating: rating,
        comment,
      },
    });

    await endSession(ctx.userId);

    await sendButtons(ctx.phone,
      `✅ Teşekkürler! Geri bildiriminiz kaydedildi.\n\n` +
      `🏠 ${propertyTitle}\n⭐ Puan: ${rating}/10` +
      (comment ? `\n💬 ${comment}` : ""),
      [
        { id: "cmd:mulkyonet", title: "🔙 Mülk Yönet" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]
    );
    return;
  }

  if (session.current_step !== "waiting_value") {
    await sendText(ctx.phone, "Lütfen yukarıdaki butonlardan birini seçin.");
    return;
  }

  const { propertyId, field, dbColumn } = session.data as { propertyId: string; field: string; dbColumn: string };
  let parsedValue: unknown = text;

  const booleanFields = ["elevator", "balcony", "swap"];
  const numericFields = ["price", "area", "net_area"];

  if (field === "price") {
    const price = parsePrice(text);
    if (!price) {
      await sendText(ctx.phone, "Geçerli bir fiyat yazın. Örnek: 4.5M, 25 bin");
      return;
    }
    parsedValue = price;
  } else if (numericFields.includes(field)) {
    const num = parseInt(text.replace(/[^\d]/g, ""), 10);
    if (!num || num < 1) {
      await sendText(ctx.phone, "Geçerli bir sayı yazın.");
      return;
    }
    parsedValue = num;
  } else if (booleanFields.includes(field)) {
    const lower = text.toLowerCase();
    if (["evet", "var", "1", "e"].includes(lower)) parsedValue = true;
    else if (["hayır", "hayir", "yok", "0", "h"].includes(lower)) parsedValue = false;
    else {
      await sendText(ctx.phone, "Evet veya Hayır yazın.");
      return;
    }
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("emlak_properties")
    .update({ [dbColumn]: parsedValue })
    .eq("id", propertyId)
    .eq("user_id", ctx.userId);

  await endSession(ctx.userId);

  if (error) {
    await sendButtons(ctx.phone, "Güncelleme hatası.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const fieldLabel = EDITABLE_FIELDS.find(f => f.key === field)?.label || field;
  await sendButtons(ctx.phone, `✅ ${fieldLabel} güncellendi.`, [
    { id: `mulkduzenle:${propertyId}`, title: "↻ Başka Alan" },
    { id: `mulkdetay:${propertyId}`, title: "📋 Detay Gör" },
    { id: "cmd:menu", title: "Ana Menü" },
  ]);

  // Gamification: mission fires ONLY after real data change, not on flow open
  try {
    const { triggerMissionCheck } = await import("@/platform/gamification/triggers");
    await triggerMissionCheck(ctx.userId, ctx.tenantKey, "mulk_bilgi_updated", ctx.phone);
  } catch { /* don't break main flow */ }
}

// ── Status change + feedback ─────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "satildi", label: "Satıldı ✅", emoji: "🎉" },
  { value: "kiralandi", label: "Kiralandı ✅", emoji: "🏠" },
  { value: "pasif", label: "Pasif (Yayından kaldır)", emoji: "⏸" },
  { value: "aktif", label: "Aktif (Tekrar yayınla)", emoji: "▶" },
];

async function showStatusOptions(ctx: WaContext, propertyId: string): Promise<void> {
  const supabase = getServiceClient();
  const { data: prop } = await supabase
    .from("emlak_properties")
    .select("title, status")
    .eq("id", propertyId)
    .eq("user_id", ctx.userId)
    .single();

  if (!prop) {
    await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:mulkyonet", title: "Mülk Yönet" }, { id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const currentLabel = STATUS_OPTIONS.find(s => s.value === prop.status)?.label || prop.status;

  // WhatsApp buttons max 3, so split into two messages
  await sendButtons(ctx.phone, `📊 *${prop.title || "İsimsiz"}*\nMevcut durum: ${currentLabel}\n\nYeni durumu seçin:`, [
    { id: `mulkyonet_act:statu_set:${propertyId}:satildi`, title: "🎉 Satıldı" },
    { id: `mulkyonet_act:statu_set:${propertyId}:kiralandi`, title: "🏠 Kiralandı" },
    { id: `mulkyonet_act:statu_set:${propertyId}:pasif`, title: "⏸ Pasif" },
  ]);
}

async function applyStatusChange(ctx: WaContext, propertyId: string, newStatus: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: prop } = await supabase
    .from("emlak_properties")
    .select("id, title, status")
    .eq("id", propertyId)
    .eq("user_id", ctx.userId)
    .single();

  if (!prop) {
    await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:mulkyonet", title: "Mülk Yönet" }, { id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const oldStatus = prop.status;
  const { error } = await supabase
    .from("emlak_properties")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", propertyId)
    .eq("user_id", ctx.userId);

  if (error) {
    await sendButtons(ctx.phone, "Güncelleme hatası: " + error.message, [{ id: "cmd:mulkyonet", title: "Mülk Yönet" }, { id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const label = STATUS_OPTIONS.find(s => s.value === newStatus)?.label || newStatus;

  // Log the status change event
  await logEvent(ctx.tenantId, ctx.userId, "property_status_change",
    `${prop.title}: ${oldStatus} → ${newStatus}`
  );

  // If sold or rented → ask feedback about system helpfulness
  if (newStatus === "satildi" || newStatus === "kiralandi") {
    const verb = newStatus === "satildi" ? "satıldı" : "kiralandı";

    await sendText(ctx.phone,
      `🎉 Tebrikler! *${prop.title}* ${verb} olarak işaretlendi.\n\n` +
      `Bu süreçte sistem size ne kadar yardımcı oldu?\n` +
      `1'den 10'a kadar puanlayın (mesaj olarak yazın):`
    );

    // Start a session to capture the rating
    await startSession(ctx.userId, ctx.tenantId, "mulkduzenle", "feedback_rating");
    await updateSession(ctx.userId, "feedback_rating", {
      propertyId,
      propertyTitle: prop.title,
      newStatus,
    });
  } else {
    await sendButtons(ctx.phone, `✅ *${prop.title}* → ${label}`, [
      { id: "cmd:mulkyonet", title: "🔙 Mülk Yönet" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  }
}

// ── /mulksil — Delete (deactivate) property ──────────────────────────

export async function handleMulkSil(ctx: WaContext): Promise<void> {
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
    await sendButtons(ctx.phone, "Portföyünüzde mülk yok.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const rows = properties.map(p => ({
    id: `mulksil:${p.id}`,
    title: ((p.title || "İsimsiz") as string).substring(0, 24),
    description: formatPrice(p.price),
  }));

  await sendList(ctx.phone, "🗑 Silmek istediğiniz mülkü seçin:", "Mülk Seç", [
    { title: "Mülkler", rows },
  ]);
}

export async function handleMulkSilCallback(ctx: WaContext, data: string): Promise<void> {
  const propId = data.replace("mulksil:", "").replace("mulksil_ok:", "");

  if (data.startsWith("mulksil_ok:")) {
    // Confirmed delete — hard delete from DB
    const supabase = getServiceClient();
    await supabase
      .from("emlak_properties")
      .delete()
      .eq("id", propId)
      .eq("user_id", ctx.userId);

    await sendButtons(ctx.phone, "✅ Mülk tamamen silindi.", [
      { id: "cmd:portfoyum", title: "Portföyüm" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  // Confirm prompt
  const supabase = getServiceClient();
  const { data: prop } = await supabase
    .from("emlak_properties")
    .select("title")
    .eq("id", propId)
    .eq("user_id", ctx.userId)
    .single();

  const title = prop?.title || "İsimsiz";
  await sendButtons(ctx.phone, `🗑 "${title}" mülkünü silmek istediğinize emin misiniz?`, [
    { id: `mulksil_ok:${propId}`, title: "Evet, Sil" },
    { id: "cmd:menu", title: "İptal" },
  ]);
}
