/**
 * /mulkdetay, /mulkduzenle, /mulksil — Property management
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession, getSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

// ── Helpers ──────────────────────────────────────────────────────────

function formatPrice(price: number | null | undefined): string {
  if (!price || price === 0) return "—";
  const num = Number(price);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M TL`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)} bin TL`;
  return `${num.toLocaleString("tr-TR")} TL`;
}

const TYPE_LABELS: Record<string, string> = {
  daire: "Daire", villa: "Villa", mustakil: "Mustakil", rezidans: "Rezidans",
  yazlik: "Yazlik", arsa: "Arsa", isyeri: "Isyeri", buro_ofis: "Buro/Ofis",
  dukkan: "Dukkan", bina: "Bina", depo: "Depo",
};

const EDITABLE_FIELDS = [
  { key: "title", label: "Baslik", dbColumn: "title", hint: "Ilan basligi" },
  { key: "price", label: "Fiyat", dbColumn: "price", hint: "Ornek: 4.5M, 25 bin" },
  { key: "area", label: "Alan (m2)", dbColumn: "area", hint: "Ornek: 120" },
  { key: "rooms", label: "Oda", dbColumn: "rooms", hint: "Ornek: 3+1" },
  { key: "description", label: "Aciklama", dbColumn: "description", hint: "Ilan aciklamasi" },
];

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/TL/gi, "").replace(/-/g, "").trim();
  const mMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(?:M|milyon)$/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1].replace(",", ".")) * 1_000_000);
  const binMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*bin$/i);
  if (binMatch) return Math.round(parseFloat(binMatch[1].replace(",", ".")) * 1_000);
  const num = parseInt(cleaned.replace(/[.\s]/g, "").replace(",", ""), 10);
  return isNaN(num) ? null : num;
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
    await sendButtons(ctx.phone, "Portfoyunuzde mulk yok.", [
      { id: "cmd:mulkekle", title: "Mulk Ekle" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  const rows = properties.map(p => ({
    id: `mulkdetay:${p.id}`,
    title: ((p.title || "Isimsiz") as string).substring(0, 24),
    description: formatPrice(p.price),
  }));

  await sendList(ctx.phone, "Detay gormek istediginiz mulku secin:", "Mulk Sec", [
    { title: "Mulkler", rows },
  ]);
}

async function showPropertyDetail(ctx: WaContext, prop: Record<string, unknown>): Promise<void> {
  const typeLabel = prop.type ? (TYPE_LABELS[prop.type as string] || prop.type) : "—";
  const listLabel = prop.listing_type === "satilik" ? "Satilik" : prop.listing_type === "kiralik" ? "Kiralik" : (prop.listing_type as string) || "—";

  let text = `*${(prop.title as string) || "Isimsiz"}*\n\n`;
  text += `🏠 Tip: ${typeLabel} | 🏷 ${listLabel}\n`;
  text += `💰 Fiyat: ${formatPrice(prop.price as number)}\n`;
  text += `📐 Alan: ${prop.area || "—"} m²\n`;
  text += `🛏 Oda: ${prop.rooms || "—"}\n`;
  if (prop.location_district) text += `📍 ${prop.location_district}${prop.location_city ? `, ${prop.location_city}` : ""}\n`;
  if (prop.description) text += `\n📝 ${((prop.description as string) || "").substring(0, 200)}\n`;
  text += `\n🆔 ${(prop.id as string).substring(0, 8)}`;

  await sendButtons(ctx.phone, text, [
    { id: `mulkduzenle:${prop.id}`, title: "Duzenle" },
    { id: "cmd:menu", title: "Ana Menu" },
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
    await sendButtons(ctx.phone, "Mulk bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
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
    await sendButtons(ctx.phone, "Portfoyunuzde mulk yok.", [
      { id: "cmd:mulkekle", title: "Mulk Ekle" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  const rows = properties.map(p => ({
    id: `mulkduzenle:${p.id}`,
    title: ((p.title || "Isimsiz") as string).substring(0, 24),
    description: formatPrice(p.price),
  }));

  await sendList(ctx.phone, "Duzenlemek istediginiz mulku secin:", "Mulk Sec", [
    { title: "Mulkler", rows },
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
    await sendButtons(ctx.phone, "Mulk bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  await startSession(ctx.userId, ctx.tenantId, "mulkduzenle", "select_field");
  await updateSession(ctx.userId, "select_field", { propertyId: propId, propertyTitle: prop.title });

  const rows = EDITABLE_FIELDS.map(f => ({
    id: `mulkedit:${f.key}:${propId}`,
    title: f.label,
    description: f.hint,
  }));

  await sendList(ctx.phone, `"${prop.title}" — Hangi alani duzenlemek istiyorsunuz?`, "Alan Sec", [
    { title: "Duzenlenecek Alanlar", rows },
  ]);
}

export async function handleMulkEditFieldCallback(ctx: WaContext, data: string): Promise<void> {
  // mulkedit:field:propId
  const parts = data.split(":");
  if (parts.length < 3) return;
  const field = parts[1];
  const propId = parts.slice(2).join(":");

  const fieldDef = EDITABLE_FIELDS.find(f => f.key === field);
  if (!fieldDef) return;

  await startSession(ctx.userId, ctx.tenantId, "mulkduzenle", "waiting_value");
  await updateSession(ctx.userId, "waiting_value", { propertyId: propId, field, dbColumn: fieldDef.dbColumn });

  await sendText(ctx.phone, `${fieldDef.label} icin yeni degeri yazin:\n\n${fieldDef.hint}`);
}

export async function handleMulkDuzenleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  if (!text) {
    await sendText(ctx.phone, "Lutfen bir deger yazin.");
    return;
  }

  if (session.current_step !== "waiting_value") {
    await sendText(ctx.phone, "Lutfen yukaridaki butonlardan birini secin.");
    return;
  }

  const { propertyId, field, dbColumn } = session.data as { propertyId: string; field: string; dbColumn: string };
  let parsedValue: unknown = text;

  if (field === "price") {
    const price = parsePrice(text);
    if (!price) {
      await sendText(ctx.phone, "Gecerli bir fiyat yazin. Ornek: 4.5M, 25 bin");
      return;
    }
    parsedValue = price;
  } else if (field === "area") {
    const area = parseInt(text.replace(/[^\d]/g, ""), 10);
    if (!area || area < 1) {
      await sendText(ctx.phone, "Gecerli bir metrekare yazin. Ornek: 120");
      return;
    }
    parsedValue = area;
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("emlak_properties")
    .update({ [dbColumn]: parsedValue })
    .eq("id", propertyId)
    .eq("user_id", ctx.userId);

  await endSession(ctx.userId);

  if (error) {
    await sendButtons(ctx.phone, "Guncelleme hatasi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  const fieldLabel = EDITABLE_FIELDS.find(f => f.key === field)?.label || field;
  await sendButtons(ctx.phone, `✅ ${fieldLabel} guncellendi.`, [
    { id: `mulkdetay:${propertyId}`, title: "Detay Gor" },
    { id: "cmd:menu", title: "Ana Menu" },
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
    await sendButtons(ctx.phone, "Portfoyunuzde mulk yok.", [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  const rows = properties.map(p => ({
    id: `mulksil:${p.id}`,
    title: ((p.title || "Isimsiz") as string).substring(0, 24),
    description: formatPrice(p.price),
  }));

  await sendList(ctx.phone, "🗑 Silmek istediginiz mulku secin:", "Mulk Sec", [
    { title: "Mulkler", rows },
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

    await sendButtons(ctx.phone, "✅ Mulk silindi.", [
      { id: "cmd:portfoyum", title: "Portfoyum" },
      { id: "cmd:menu", title: "Ana Menu" },
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

  const title = prop?.title || "Isimsiz";
  await sendButtons(ctx.phone, `🗑 "${title}" mulkunu silmek istediginize emin misiniz?`, [
    { id: `mulksil_ok:${propId}`, title: "Evet, Sil" },
    { id: "cmd:menu", title: "Iptal" },
  ]);
}
