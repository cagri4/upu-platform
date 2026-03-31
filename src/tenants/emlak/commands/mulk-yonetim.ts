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
  { key: "floor", label: "Kat", dbColumn: "floor", hint: "Örnek: 3" },
  { key: "building_age", label: "Bina Yaşı", dbColumn: "building_age", hint: "Örnek: 5" },
];

// Page 2: Konum + detaylar (ikinci sayfa)
const FIELDS_PAGE_2 = [
  { key: "location_city", label: "Şehir", dbColumn: "location_city", hint: "Örnek: Muğla" },
  { key: "location_district", label: "İlçe", dbColumn: "location_district", hint: "Örnek: Bodrum" },
  { key: "location_neighborhood", label: "Mahalle", dbColumn: "location_neighborhood", hint: "Örnek: Yalıkavak" },
  { key: "net_area", label: "Net Alan (m²)", dbColumn: "net_area", hint: "Örnek: 110" },
  { key: "total_floors", label: "Toplam Kat", dbColumn: "total_floors", hint: "Örnek: 5" },
  { key: "heating", label: "Isınma", dbColumn: "heating", hint: "Doğalgaz/Klima/Soba" },
  { key: "parking", label: "Otopark", dbColumn: "parking", hint: "Açık/Kapalı/Yok" },
  { key: "facade", label: "Cephe", dbColumn: "facade", hint: "Güney/Kuzey/Doğu/Batı" },
  { key: "deed_type", label: "Tapu Durumu", dbColumn: "deed_type", hint: "Kat mülkiyeti/irtifak" },
];

// Page 3: Boolean + diğer
const FIELDS_PAGE_3 = [
  { key: "elevator", label: "Asansör", dbColumn: "elevator", hint: "Evet / Hayır" },
  { key: "balcony", label: "Balkon", dbColumn: "balcony", hint: "Evet / Hayır" },
  { key: "swap", label: "Takas", dbColumn: "swap", hint: "Evet / Hayır" },
  { key: "bathroom_count", label: "Banyo Sayısı", dbColumn: "bathroom_count", hint: "Örnek: 2" },
  { key: "kitchen_type", label: "Mutfak Tipi", dbColumn: "kitchen_type", hint: "Açık/Kapalı/Amerikan" },
  { key: "housing_type", label: "Yapı Tipi", dbColumn: "housing_type", hint: "Apartman/Site içi/Müstakil" },
  { key: "usage_status", label: "Kullanım Durumu", dbColumn: "usage_status", hint: "Boş/Kiracılı/Sahibi" },
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

  await sendButtons(ctx.phone, `🏠 *${prop.title || "İsimsiz"}*\n\nNe yapmak istersiniz?\n\n_"menu" yazarak ana menüye dönebilirsiniz._`, [
    { id: `mulkyonet_act:detay:${propertyId}`, title: "📋 Detay Gör" },
    { id: `mulkyonet_act:duzenle:${propertyId}`, title: "✏️ Düzenle" },
    { id: `mulkyonet_act:sil:${propertyId}`, title: "🗑 Sil" },
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
  text += `🏠 Tip: ${typeLabel} | 🏷 ${listLabel}\n`;
  text += `💰 Fiyat: ${formatPrice(prop.price as number)}\n`;
  text += `📐 Alan: ${prop.area || "—"} m²\n`;
  text += `🛏 Oda: ${prop.rooms || "—"}\n`;
  if (prop.location_district) text += `📍 ${prop.location_district}${prop.location_city ? `, ${prop.location_city}` : ""}\n`;
  if (prop.description) text += `\n📝 ${((prop.description as string) || "").substring(0, 200)}\n`;
  text += `\n🆔 ${(prop.id as string).substring(0, 8)}`;

  await sendButtons(ctx.phone, text, [
    { id: `mulkduzenle:${prop.id}`, title: "✏️ Düzenle" },
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

// Show edit fields with pagination (max 10 rows per list)
async function showEditFieldPage(phone: string, propId: string, title: string, page: number) {
  const pages = [FIELDS_PAGE_1, FIELDS_PAGE_2, FIELDS_PAGE_3];
  const totalPages = pages.length;
  const fields = pages[page - 1] || FIELDS_PAGE_1;

  const rows = fields.map(f => ({
    id: `mulkedit:${f.key}:${propId}`,
    title: f.label.substring(0, 24),
    description: f.hint.substring(0, 72),
  }));

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
    { id: `mulkdetay:${propertyId}`, title: "📋 Detay Gör" },
    { id: "cmd:mulkyonet", title: "🔙 Mülk Yönet" },
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
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
    // Confirmed delete
    const supabase = getServiceClient();
    await supabase
      .from("emlak_properties")
      .update({ status: "silindi" })
      .eq("id", propId)
      .eq("user_id", ctx.userId);

    await sendButtons(ctx.phone, "✅ Mülk silindi.", [
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
