/**
 * /takipEt — İlan Takip Sistemi
 *
 * Akış: kriter gir → sonuç gör → takibe al → her sabah bildirim → devam/durdur
 * Kriterler: satılık/kiralık + tip + bölge + m² aralığı
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

// ── m² aralık seçenekleri ──────────────────────────────────────────

const M2_RANGES = [
  { id: "tkp:m2:0-50", label: "0-50 m²", min: 0, max: 50 },
  { id: "tkp:m2:50-80", label: "50-80 m²", min: 50, max: 80 },
  { id: "tkp:m2:80-120", label: "80-120 m²", min: 80, max: 120 },
  { id: "tkp:m2:120-160", label: "120-160 m²", min: 120, max: 160 },
  { id: "tkp:m2:160-200", label: "160-200 m²", min: 160, max: 200 },
  { id: "tkp:m2:200-300", label: "200-300 m²", min: 200, max: 300 },
  { id: "tkp:m2:300-9999", label: "300+ m²", min: 300, max: 9999 },
  { id: "tkp:m2:any", label: "Farketmez", min: 0, max: 9999 },
];

const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(n);

// ── Entry point ────────────────────────────────────────────────────

export async function handleTakipEt(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: existing } = await supabase
    .from("emlak_monitoring_criteria")
    .select("id, criteria, is_active")
    .eq("user_id", ctx.userId)
    .eq("is_active", true)
    .limit(10);

  if (existing && existing.length > 0) {
    let text = `📡 *Aktif Takipleriniz (${existing.length})*\n\n`;
    for (const [i, c] of existing.entries()) {
      const cr = c.criteria as Record<string, unknown> || {};
      const lt = cr.listing_type === "satilik" ? "Satılık" : cr.listing_type === "kiralik" ? "Kiralık" : "Tümü";
      const tip = (cr.property_type as string) || "Hepsi";
      const loc = (cr.location as string) || "Tüm bölgeler";
      const m2 = cr.m2_label as string || "";
      const lb = cr.listed_by === "sahibi" ? " · sahibinden" : cr.listed_by === "emlakci" ? " · emlak ofisi" : "";
      text += `${i + 1}. ${lt} ${tip} — ${loc}${m2 ? ` — ${m2}` : ""}${lb}\n`;
    }

    const rows = existing.map((c, i) => ({
      id: `tkp:del:${c.id}`,
      title: `Takip ${i + 1}'i sil`,
      description: "",
    }));

    await sendButtons(ctx.phone, text, [
      { id: "tkp:new", title: "➕ Yeni Takip Ekle" },
    ]);

    if (rows.length > 0) {
      await sendList(ctx.phone, "Bir takibi silmek isterseniz:", "Takip Sil", [
        { title: "Aktif Takipler", rows },
      ]);
    }
    return;
  }

  await startNewTracking(ctx);
}

// ── Start new tracking ─────────────────────────────────────────────

async function startNewTracking(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "takipEt", "listing_type");

  await sendButtons(ctx.phone, "📡 *Yeni İlan Takibi*\n\nSatılık mı kiralık mı?", [
    { id: "tkp:lt:satilik", title: "Satılık" },
    { id: "tkp:lt:kiralik", title: "Kiralık" },
  ]);
}

// ── Callback handler ───────────────────────────────────────────────

export async function handleTakipEtCallback(ctx: WaContext, data: string): Promise<void> {
  // Delete tracking
  if (data.startsWith("tkp:del:")) {
    const id = data.replace("tkp:del:", "");
    const supabase = getServiceClient();
    await supabase.from("emlak_monitoring_criteria").delete().eq("id", id).eq("user_id", ctx.userId);
    await sendText(ctx.phone, "✅ Takip silindi.");
    return;
  }

  // New tracking
  if (data === "tkp:new") {
    await startNewTracking(ctx);
    return;
  }

  // Continue morning notification
  if (data.startsWith("tkp:continue:")) {
    await sendText(ctx.phone, "✅ Takip devam ediyor.");
    return;
  }

  // Stop morning notification
  if (data.startsWith("tkp:stop:")) {
    const id = data.replace("tkp:stop:", "");
    const supabase = getServiceClient();
    await supabase.from("emlak_monitoring_criteria").update({ is_active: false }).eq("id", id).eq("user_id", ctx.userId);
    await sendText(ctx.phone, "✅ Takip durduruldu. Artık bildirim gelmeyecek.");
    return;
  }

  // Save to tracking after results shown
  if (data === "tkp:save") {
    await saveTracking(ctx);
    return;
  }

  if (data === "tkp:nosave") {
    await endSession(ctx.userId);
    await sendText(ctx.phone, "Tamam, takibe alınmadı.");
    return;
  }

  // Listing type selection
  if (data.startsWith("tkp:lt:")) {
    const value = data.replace("tkp:lt:", "");
    await updateSession(ctx.userId, "property_type", { listing_type: value });

    await sendButtons(ctx.phone, "Mülk tipi?", [
      { id: "tkp:pt:daire", title: "Daire" },
      { id: "tkp:pt:villa", title: "Villa" },
      { id: "tkp:pt:mustakil", title: "Müstakil" },
    ]);
    await sendButtons(ctx.phone, "veya:", [
      { id: "tkp:pt:arsa", title: "Arsa" },
      { id: "tkp:pt:hepsi", title: "Hepsi" },
    ]);
    return;
  }

  // Property type selection
  if (data.startsWith("tkp:pt:")) {
    const value = data.replace("tkp:pt:", "");
    await updateSession(ctx.userId, "location", { property_type: value });
    await sendText(ctx.phone, "📍 Bölge / mahalle adı yazın:\n\nÖrnek: Yalıkavak, Bitez, Gümüşlük");
    return;
  }

  // m² range selection
  if (data.startsWith("tkp:m2:")) {
    const rangeKey = data.replace("tkp:m2:", "");
    const range = M2_RANGES.find(r => r.id === data);
    const m2Min = range?.min || 0;
    const m2Max = range?.max || 9999;
    const m2Label = range?.label || rangeKey;

    await updateSession(ctx.userId, "listed_by", { m2_min: m2Min, m2_max: m2Max, m2_label: m2Label });

    // Ask: kimden?
    await sendButtons(ctx.phone, "Kimden?", [
      { id: "tkp:lb:sahibi", title: "Sahibinden" },
      { id: "tkp:lb:emlakci", title: "Emlak Ofisinden" },
      { id: "tkp:lb:hepsi", title: "Farketmez" },
    ]);
    return;
  }

  // Listed by selection
  if (data.startsWith("tkp:lb:")) {
    const value = data.replace("tkp:lb:", "");
    await updateSession(ctx.userId, "search", { listed_by: value === "hepsi" ? null : value });

    await runSearchAndShowResults(ctx);
    return;
  }
}

// ── Step handler (text inputs) ─────────────────────────────────────

export async function handleTakipEtStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  const step = session.current_step;

  if (!text) return;

  if (step === "location") {
    await updateSession(ctx.userId, "m2_range", { location: text });

    // Show m² range list
    const rows = M2_RANGES.map(r => ({
      id: r.id,
      title: r.label,
      description: "",
    }));

    await sendList(ctx.phone, "📐 m² aralığı seçin:", "m² Seçin", [
      { title: "m² Aralığı", rows },
    ]);
    return;
  }
}

// ── Search and show results ────────────────────────────────────────

async function runSearchAndShowResults(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: sess } = await supabase
    .from("command_sessions")
    .select("data")
    .eq("user_id", ctx.userId)
    .single();

  if (!sess) {
    await endSession(ctx.userId);
    await sendText(ctx.phone, "Oturum süresi doldu. Tekrar takipEt yazın.");
    return;
  }

  const d = sess.data as Record<string, unknown>;
  const listingType = d.listing_type as string;
  const propertyType = d.property_type as string;
  const location = d.location as string;
  const m2Min = (d.m2_min as number) || 0;
  const m2Max = (d.m2_max as number) || 9999;
  const m2Label = (d.m2_label as string) || "";
  const listedBy = (d.listed_by as string) || null;

  // Build query
  let query = supabase
    .from("emlak_properties")
    .select("title, price, area, rooms, location_neighborhood, source_url, listed_by")
    .eq("status", "aktif")
    .gt("price", 0);

  if (listingType && listingType !== "hepsi") {
    query = query.eq("listing_type", listingType);
  }
  if (propertyType && propertyType !== "hepsi") {
    query = query.eq("type", propertyType);
  }
  if (location) {
    query = query.or(`location_neighborhood.ilike.%${location}%,location_district.ilike.%${location}%`);
  }
  if (m2Min > 0) {
    query = query.gte("area", m2Min);
  }
  if (m2Max < 9999) {
    query = query.lte("area", m2Max);
  }
  if (listedBy) {
    query = query.eq("listed_by", listedBy);
  }

  const { data: results } = await query.order("created_at", { ascending: false }).limit(10);

  const ltLabel = listingType === "satilik" ? "Satılık" : listingType === "kiralik" ? "Kiralık" : "Tümü";
  const ptLabel = propertyType === "hepsi" ? "" : ` ${propertyType}`;
  const header = `${ltLabel}${ptLabel} — ${location || "Tüm bölgeler"}${m2Label && m2Label !== "Farketmez" ? ` — ${m2Label}` : ""}`;

  if (!results || results.length === 0) {
    await sendText(ctx.phone, `🔍 *${header}*\n\nBu kriterlere uyan ilan bulunamadı.`);
    await sendButtons(ctx.phone, "Bu aramayı takibe almak ister misiniz?\nYeni ilan eklendiğinde bildirim gelir.", [
      { id: "tkp:save", title: "✅ Takibe Al" },
      { id: "tkp:nosave", title: "Hayır" },
    ]);
    return;
  }

  let msg = `🏠 *${results.length} ilan bulundu*\n${header}\n\n`;

  for (const [i, r] of results.entries()) {
    msg += `${i + 1}. ${r.title || "İlan"}\n`;
    const details: string[] = [];
    if (r.area) details.push(`${r.area}m²`);
    if (r.rooms) details.push(r.rooms);
    if (r.price) details.push(`${fmt(r.price)} TL`);
    if (details.length) msg += `   ${details.join(" — ")}\n`;
    const kimden = r.listed_by === "sahibi" ? "sahibinden" : r.listed_by === "emlakci" ? "emlak ofisi" : "";
    if (r.location_neighborhood || kimden) msg += `   📍 ${[r.location_neighborhood, kimden].filter(Boolean).join(" · ")}\n`;
    if (r.source_url) msg += `   ${r.source_url}\n`;
    msg += "\n";
  }

  await sendText(ctx.phone, msg);

  await sendButtons(ctx.phone, "Bu aramayı her sabah otomatik almak ister misiniz?", [
    { id: "tkp:save", title: "✅ Evet, Takip Et" },
    { id: "tkp:nosave", title: "Hayır" },
  ]);
}

// ── Save tracking criteria ─────────────────────────────────────────

async function saveTracking(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: sess } = await supabase
    .from("command_sessions")
    .select("data")
    .eq("user_id", ctx.userId)
    .single();

  if (!sess) {
    await endSession(ctx.userId);
    await sendText(ctx.phone, "Oturum süresi doldu. Tekrar takipEt yazın.");
    return;
  }

  const d = sess.data as Record<string, unknown>;

  const { error } = await supabase.from("emlak_monitoring_criteria").insert({
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    criteria: {
      listing_type: d.listing_type,
      property_type: d.property_type,
      location: d.location,
      listed_by: d.listed_by || null,
      m2_min: d.m2_min,
      m2_max: d.m2_max,
      m2_label: d.m2_label,
    },
    is_active: true,
  });

  await endSession(ctx.userId);

  if (error) {
    await sendText(ctx.phone, "❌ Takip oluşturulurken hata oluştu.");
    return;
  }

  await sendText(ctx.phone,
    "✅ Takibe alındı!\n\nHer sabah yeni ilanlar taranacak ve kriterlerine uyanlar bildirilecek.",
  );
  await logEvent(ctx.tenantId, ctx.userId, "takip_et", "yeni takip oluşturuldu");

  // Discovery chain: advance after tarama kuruldu
  try {
    const { advanceDiscovery } = await import("@/platform/whatsapp/discovery-chain");
    await advanceDiscovery(ctx.userId, ctx.phone, "tarama_kuruldu");
  } catch { /* don't break flow */ }

}

// ── Morning notification (called by cron after scrape) ─────────────

export async function sendTrackingNotifications(): Promise<number> {
  const supabase = getServiceClient();

  // Get all active tracking criteria
  const { data: criteria } = await supabase
    .from("emlak_monitoring_criteria")
    .select("id, user_id, tenant_id, criteria")
    .eq("is_active", true);

  if (!criteria || criteria.length === 0) return 0;

  // Get user phones
  const userIds = [...new Set(criteria.map(c => c.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, whatsapp_phone")
    .in("id", userIds);

  const phoneMap: Record<string, string> = {};
  for (const p of profiles || []) {
    if (p.whatsapp_phone) phoneMap[p.id] = p.whatsapp_phone;
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let sent = 0;

  for (const c of criteria) {
    const phone = phoneMap[c.user_id];
    if (!phone) continue;

    const cr = c.criteria as Record<string, unknown>;
    try {
      // Build query for new listings (last 24h)
      let query = supabase
        .from("emlak_properties")
        .select("title, price, area, rooms, location_neighborhood, source_url, listed_by")
        .eq("status", "aktif")
        .gte("created_at", yesterday)
        .gt("price", 0);

      if (cr.listing_type && cr.listing_type !== "hepsi") {
        query = query.eq("listing_type", cr.listing_type as string);
      }
      if (cr.property_type && cr.property_type !== "hepsi") {
        query = query.eq("type", cr.property_type as string);
      }
      if (cr.location) {
        const loc = cr.location as string;
        query = query.or(`location_neighborhood.ilike.%${loc}%,location_district.ilike.%${loc}%`);
      }
      if (cr.m2_min && (cr.m2_min as number) > 0) {
        query = query.gte("area", cr.m2_min as number);
      }
      if (cr.m2_max && (cr.m2_max as number) < 9999) {
        query = query.lte("area", cr.m2_max as number);
      }
      if (cr.listed_by) {
        query = query.eq("listed_by", cr.listed_by as string);
      }

      const { data: results } = await query.order("created_at", { ascending: false }).limit(5);

      if (!results || results.length === 0) continue; // No new matches — silent

      const ltLabel = cr.listing_type === "satilik" ? "Satılık" : cr.listing_type === "kiralik" ? "Kiralık" : "Tümü";
      const ptLabel = cr.property_type && cr.property_type !== "hepsi" ? ` ${cr.property_type}` : "";
      const header = `${ltLabel}${ptLabel} — ${cr.location || "Tüm bölgeler"}`;

      let msg = `🔔 *Yeni İlanlar — Sabah Takibi*\n\n📋 ${header}\n${results.length} yeni ilan:\n\n`;

      for (const [i, r] of results.entries()) {
        msg += `${i + 1}. ${r.title || "İlan"}\n`;
        const details: string[] = [];
        if (r.area) details.push(`${r.area}m²`);
        if (r.rooms) details.push(r.rooms);
        if (r.price) details.push(`${fmt(r.price)} TL`);
        if (details.length) msg += `   ${details.join(" — ")}\n`;
        const kimden = r.listed_by === "sahibi" ? "sahibinden" : r.listed_by === "emlakci" ? "emlak ofisi" : "";
        if (r.location_neighborhood || kimden) msg += `   📍 ${[r.location_neighborhood, kimden].filter(Boolean).join(" · ")}\n`;
        if (r.source_url) msg += `   ${r.source_url}\n`;
        msg += "\n";
      }

      const { sendButtons: sendBtn } = await import("@/platform/whatsapp/send");
      await sendBtn(phone, msg, [
        { id: `tkp:continue:${c.id}`, title: "✅ Devam" },
        { id: `tkp:stop:${c.id}`, title: "🛑 Durdur" },
      ]);
      sent++;
    } catch (err) {
      console.error(`[takip:notify] Error for criteria ${c.id}:`, err);
    }
  }

  return sent;
}
