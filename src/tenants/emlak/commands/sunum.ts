/**
 * /sunum — Müşteriye özel mülk sunum hazırlama
 *
 * Flow: müşteri seç → mülk seç (birden fazla) → eksik bilgi kontrol → AI sunum oluştur → magic link
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";
import { randomBytes } from "crypto";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("tr-TR").format(price) + " TL";
}

// ── /sunum — Start presentation flow ─────────────────────────────────

export async function handleSunum(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  // Check if customers exist
  const { data: customers } = await supabase
    .from("emlak_customers")
    .select("id, name, phone, listing_type, budget_max, location")
    .eq("user_id", ctx.userId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!customers || customers.length === 0) {
    await sendButtons(ctx.phone,
      "📊 Sunum hazırlamak için önce müşteri eklemeniz gerekiyor.",
      [
        { id: "cmd:musteriEkle", title: "Müşteri Ekle" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
    return;
  }

  await startSession(ctx.userId, ctx.tenantId, "sunum", "select_customer");

  const rows = customers.map(c => ({
    id: `snm:cust:${c.id}`,
    title: ((c.name || "İsimsiz") as string).substring(0, 24),
    description: [c.listing_type, c.location].filter(Boolean).join(" | ").substring(0, 72),
  }));

  await sendList(ctx.phone, "📊 Sunum Hazırla\n\nHangi müşteriniz için sunum hazırlayalım?", "Müşteri Seç", [
    { title: "Müşteriler", rows },
  ]);
}

// ── Step handler ─────────────────────────────────────────────────────

export async function handleSunumStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  const step = session.current_step;

  if (!text) {
    await sendText(ctx.phone, "Lütfen bir değer yazın.");
    return;
  }

  switch (step) {
    case "fill_customer_info": {
      // Collecting missing customer info — this step handles free text for whatever field is being filled
      const d = session.data as Record<string, unknown>;
      const missingField = d._filling_field as string;

      if (missingField === "phone") {
        const digits = text.replace(/[^\d+]/g, "");
        if (digits.length < 10) {
          await sendText(ctx.phone, "Geçerli bir telefon numarası yazın.");
          return;
        }
        // Update customer in DB
        const supabase = getServiceClient();
        await supabase.from("emlak_customers").update({ phone: digits }).eq("id", d.customer_id);
        d.customer_phone = digits;
      }

      // Continue to property selection after filling
      delete d._filling_field;
      await updateSession(ctx.userId, "select_property", d);
      await showPropertySelection(ctx);
      return;
    }

    case "fill_property_info": {
      // Collecting missing property info
      const d = session.data as Record<string, unknown>;
      const filling = d._filling_field as string;
      const propId = d._filling_property_id as string;
      const supabase = getServiceClient();

      if (filling === "price") {
        const price = parseInt(text.replace(/[^\d]/g, ""), 10);
        if (!price || price < 1000) {
          await sendText(ctx.phone, "Geçerli bir fiyat yazın. Örnek: 5000000");
          return;
        }
        await supabase.from("emlak_properties").update({ price }).eq("id", propId);
      } else if (filling === "area") {
        const area = parseInt(text.replace(/[^\d]/g, ""), 10);
        if (!area || area < 1) {
          await sendText(ctx.phone, "Geçerli bir alan yazın (m²). Örnek: 120");
          return;
        }
        await supabase.from("emlak_properties").update({ area }).eq("id", propId);
      }

      delete d._filling_field;
      delete d._filling_property_id;
      await updateSession(ctx.userId, "confirm", d);
      await showPreview(ctx);
      return;
    }

    default:
      await sendText(ctx.phone, "Lütfen yukarıdaki butonlardan birini seçin.");
      return;
  }
}

// ── Callback handler ─────────────────────────────────────────────────

export async function handleSunumCallback(ctx: WaContext, data: string): Promise<void> {
  const supabase = getServiceClient();

  if (data === "snm:cancel") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "❌ Sunum hazırlama iptal edildi.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  // Customer selection
  if (data.startsWith("snm:cust:")) {
    const customerId = data.substring("snm:cust:".length);

    const { data: customer } = await supabase
      .from("emlak_customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (!customer) {
      await endSession(ctx.userId);
      await sendButtons(ctx.phone, "❌ Müşteri bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    // Check missing customer info
    if (!customer.phone) {
      await updateSession(ctx.userId, "fill_customer_info", {
        customer_id: customerId,
        customer_name: customer.name,
        _filling_field: "phone",
      });
      await sendText(ctx.phone, `👤 ${customer.name} için telefon numarası eksik.\n\n📱 Telefon numarasını yazın:`);
      return;
    }

    await updateSession(ctx.userId, "select_property", {
      customer_id: customerId,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_listing_type: customer.listing_type,
      customer_budget_max: customer.budget_max,
      customer_location: customer.location,
      customer_rooms: customer.rooms,
      customer_property_type: customer.property_type,
      customer_notes: customer.notes,
      selected_properties: [],
    });

    await showPropertySelection(ctx);
    return;
  }

  // Property selection
  if (data.startsWith("snm:prop:")) {
    const propId = data.substring("snm:prop:".length);
    const { data: sess } = await supabase.from("command_sessions").select("data").eq("user_id", ctx.userId).single();
    if (!sess) return;

    const d = sess.data as Record<string, unknown>;
    const selected = (d.selected_properties as string[]) || [];

    if (propId === "done") {
      if (selected.length === 0) {
        await sendText(ctx.phone, "En az 1 mülk seçmelisiniz.");
        return;
      }

      // Check selected properties for missing info
      const { data: props } = await supabase
        .from("emlak_properties")
        .select("id, title, price, area, image_url")
        .in("id", selected);

      const missingPrice = props?.find(p => !p.price);
      if (missingPrice) {
        await updateSession(ctx.userId, "fill_property_info", {
          ...d,
          _filling_field: "price",
          _filling_property_id: missingPrice.id,
        });
        await sendText(ctx.phone, `💰 "${missingPrice.title}" için fiyat bilgisi eksik.\n\nFiyat yazın (TL):`);
        return;
      }

      const missingArea = props?.find(p => !p.area);
      if (missingArea) {
        await updateSession(ctx.userId, "fill_property_info", {
          ...d,
          _filling_field: "area",
          _filling_property_id: missingArea.id,
        });
        await sendText(ctx.phone, `📐 "${missingArea.title}" için alan bilgisi eksik.\n\nm² yazın:`);
        return;
      }

      // All good — show preview
      await updateSession(ctx.userId, "confirm", d);
      await showPreview(ctx);
      return;
    }

    // Add property to selection
    if (!selected.includes(propId)) {
      selected.push(propId);
      await updateSession(ctx.userId, "select_property", { ...d, selected_properties: selected });
    }

    // Get property name for feedback
    const { data: prop } = await supabase.from("emlak_properties").select("title").eq("id", propId).single();
    const propTitle = (prop?.title as string)?.substring(0, 30) || "Mülk";

    await sendButtons(ctx.phone,
      `✅ ${propTitle} eklendi (${selected.length} mülk seçili)\n\nBaşka mülk eklemek ister misiniz?`,
      [
        { id: "snm:prop:done", title: "Sunumu Hazırla" },
        { id: "snm:cancel", title: "İptal" },
      ],
    );
    return;
  }

  // Confirm and generate
  if (data === "snm:generate") {
    await generatePresentation(ctx);
    return;
  }

  // Send to customer
  if (data.startsWith("snm:send:")) {
    const presentationId = data.substring("snm:send:".length);
    const { data: pres } = await supabase
      .from("emlak_presentations")
      .select("magic_token, customer_id")
      .eq("id", presentationId)
      .single();

    if (!pres) {
      await sendButtons(ctx.phone, "❌ Sunum bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const { data: customer } = await supabase
      .from("emlak_customers")
      .select("name, phone")
      .eq("id", pres.customer_id)
      .single();

    if (!customer?.phone) {
      await sendButtons(ctx.phone, "❌ Müşteri telefon numarası yok.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const appUrl = "https://estateai.upudev.nl";
    const link = `${appUrl}/d/p/${pres.magic_token}`;

    // Send to customer via WhatsApp
    const { sendText: sendWa } = await import("@/platform/whatsapp/send");
    await sendWa(customer.phone, `Merhaba ${customer.name},\n\nSizin için özel bir mülk sunumu hazırladık:\n\n${link}\n\nİyi günler dileriz.`);

    // Update status
    await supabase.from("emlak_presentations").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", presentationId);

    await sendButtons(ctx.phone,
      `✅ Sunum ${customer.name}'e gönderildi!\n\n📱 ${customer.phone}\n🔗 ${link}`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );

    await endSession(ctx.userId);
    await logEvent(ctx.tenantId, ctx.userId, "sunum_gonderildi", `${customer.name}`);
    return;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

async function showPropertySelection(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: props } = await supabase
    .from("emlak_properties")
    .select("id, title, price, type, rooms, location_district")
    .eq("user_id", ctx.userId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!props || props.length === 0) {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone,
      "📊 Sunum hazırlamak için portföyünüzde mülk olmalı.",
      [
        { id: "cmd:mulkekle", title: "Mülk Ekle" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
    return;
  }

  const rows = props.map(p => ({
    id: `snm:prop:${p.id}`,
    title: ((p.title || "İsimsiz") as string).substring(0, 24),
    description: [p.rooms, p.price ? formatPrice(p.price) : null, p.location_district].filter(Boolean).join(" | ").substring(0, 72),
  }));

  await sendList(ctx.phone, "🏠 Sunuma eklenecek mülkleri seçin.\n\nBirden fazla seçebilirsiniz.", "Mülk Seç", [
    { title: "Portföy", rows },
  ]);
}

async function showPreview(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: sess } = await supabase.from("command_sessions").select("data").eq("user_id", ctx.userId).single();
  if (!sess) return;

  const d = sess.data as Record<string, unknown>;
  const selected = (d.selected_properties as string[]) || [];

  const { data: props } = await supabase
    .from("emlak_properties")
    .select("title, price, rooms, area, type")
    .in("id", selected);

  let preview = `📊 SUNUM ÖNİZLEME\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  preview += `👤 Müşteri: ${d.customer_name}\n`;
  preview += `🏠 ${selected.length} mülk:\n`;

  for (const p of props || []) {
    preview += `  • ${p.title?.substring(0, 30)} — ${p.price ? formatPrice(p.price) : "?"} | ${p.rooms || "?"} | ${p.area || "?"}m²\n`;
  }

  preview += `\n✨ AI müşteri profiline uygun sunum hazırlayacak.`;

  await sendButtons(ctx.phone, preview, [
    { id: "snm:generate", title: "✅ Oluştur" },
    { id: "snm:cancel", title: "❌ İptal" },
  ]);
}

async function generatePresentation(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: sess } = await supabase.from("command_sessions").select("data").eq("user_id", ctx.userId).single();
  if (!sess) { await endSession(ctx.userId); return; }

  const d = sess.data as Record<string, unknown>;
  const selected = (d.selected_properties as string[]) || [];

  await sendText(ctx.phone, "✨ AI sunum hazırlıyor...");

  // Fetch full property data
  const { data: props } = await supabase
    .from("emlak_properties")
    .select("id, title, price, area, rooms, type, listing_type, location_district, location_neighborhood, description, ai_description, image_url, features, interior_features, exterior_features, view_features")
    .in("id", selected);

  // Fetch customer data
  const { data: customer } = await supabase
    .from("emlak_customers")
    .select("*")
    .eq("id", d.customer_id)
    .single();

  if (!props?.length || !customer) {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "❌ Veri bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  // Build AI prompt for personalized presentation
  const customerProfile = [
    `Müşteri: ${customer.name}`,
    customer.listing_type ? `Arıyor: ${customer.listing_type}` : null,
    customer.budget_max ? `Bütçe: ${formatPrice(customer.budget_max)}` : null,
    customer.rooms ? `Oda tercihi: ${customer.rooms}` : null,
    customer.location ? `Bölge: ${customer.location}` : null,
    customer.notes ? `Not: ${customer.notes}` : null,
  ].filter(Boolean).join("\n");

  const propertyDetails = props.map(p => {
    return [
      `Mülk: ${p.title}`,
      `Fiyat: ${p.price ? formatPrice(p.price) : "?"}`,
      `Alan: ${p.area || "?"}m² | Oda: ${p.rooms || "?"}`,
      `Konum: ${p.location_neighborhood || p.location_district || "?"}`,
      `Tip: ${p.type || "?"} | ${p.listing_type || "?"}`,
      p.description ? `Açıklama: ${(p.description as string).substring(0, 200)}` : null,
      p.features ? `Özellikler: ${p.features}` : null,
    ].filter(Boolean).join("\n");
  }).join("\n---\n");

  let aiSummary = "";
  try {
    const { askClaude } = await import("@/platform/ai/claude");
    aiSummary = await askClaude(
      "Sen profesyonel bir emlak sunum uzmanısın. Müşterinin profiline göre her mülkün öne çıkan özelliklerini vurgula. Mülkleri müşteriye neden uygun olduğunu açıkla. Kısa, ikna edici, profesyonel. Her mülk için ayrı bir bölüm yaz. Türkçe.",
      `MÜŞTERİ PROFİLİ:\n${customerProfile}\n\nMÜLKLER:\n${propertyDetails}`,
      1024,
    );
  } catch {
    aiSummary = "AI değerlendirmesi şu an kullanılamıyor.";
  }

  // Generate magic token
  const magicToken = randomBytes(16).toString("hex");

  // Build content JSON for web page
  const content = {
    customer: {
      name: customer.name,
      listing_type: customer.listing_type,
      budget_max: customer.budget_max,
      rooms: customer.rooms,
      location: customer.location,
    },
    properties: props.map(p => ({
      id: p.id,
      title: p.title,
      price: p.price,
      area: p.area,
      rooms: p.rooms,
      type: p.type,
      listing_type: p.listing_type,
      location: p.location_neighborhood || p.location_district,
      description: p.description || p.ai_description,
      image_url: p.image_url,
      features: p.features,
      interior_features: p.interior_features,
      exterior_features: p.exterior_features,
      view_features: p.view_features,
    })),
    ai_summary: aiSummary,
    created_at: new Date().toISOString(),
  };

  // Save presentation
  const { data: presentation, error } = await supabase
    .from("emlak_presentations")
    .insert({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      customer_id: customer.id,
      property_ids: selected,
      title: `${customer.name} — Mülk Sunumu`,
      magic_token: magicToken,
      content,
      ai_summary: aiSummary,
      status: "draft",
    })
    .select("id")
    .single();

  await endSession(ctx.userId);

  if (error || !presentation) {
    await sendButtons(ctx.phone, `❌ Sunum oluşturulurken hata: ${error?.message || "bilinmeyen"}`, [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const appUrl = "https://estateai.upudev.nl";
  const link = `${appUrl}/d/p/${magicToken}`;

  await sendButtons(ctx.phone,
    `✅ Sunum hazırlandı!\n\n📊 ${customer.name} için ${props.length} mülk\n🔗 ${link}\n\nMüşteriye göndermek ister misiniz?`,
    [
      { id: `snm:send:${presentation.id}`, title: "📤 Müşteriye Gönder" },
      { id: "cmd:menu", title: "Ana Menü" },
    ],
  );

  await logEvent(ctx.tenantId, ctx.userId, "sunum_hazirlandi", `${customer.name} — ${props.length} mülk`);

  // Auto set follow-up: 3 days after presentation
  try {
    const supabase = (await import("@/platform/auth/supabase")).getServiceClient();
    const followupDate = new Date(Date.now() + 3 * 86400000).toISOString();
    await supabase.from("emlak_customers").update({
      pipeline_stage: "sunum_yapildi",
      last_contact_date: new Date().toISOString(),
      next_followup_date: followupDate,
    }).eq("id", customer.id);
  } catch { /* don't break sunum flow */ }

  // Discovery chain: advance after sunum created
  try {
    const { advanceDiscovery } = await import("@/platform/whatsapp/discovery-chain");
    await advanceDiscovery(ctx.userId, ctx.phone, "sunum_hazir");
  } catch { /* don't break flow */ }

}

// ── /sunumlarim — List presentations ─────────────────────────────────

export async function handleSunumlarim(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: presentations } = await supabase
    .from("emlak_presentations")
    .select("id, title, status, view_count, created_at, customer_id")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!presentations?.length) {
    await sendButtons(ctx.phone, "📊 Henüz sunum hazırlamadınız.", [
      { id: "cmd:sunum", title: "Sunum Hazırla" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const statusIcons: Record<string, string> = {
    draft: "📝",
    sent: "📤",
    viewed: "👁",
    expired: "⏰",
  };

  const rows = presentations.map(p => ({
    id: `snm:view:${p.id}`,
    title: `${statusIcons[p.status] || "📊"} ${(p.title || "Sunum").substring(0, 22)}`,
    description: `${p.view_count || 0} görüntüleme | ${new Date(p.created_at).toLocaleDateString("tr-TR")}`,
  }));

  await sendList(ctx.phone, "📊 Sunumlarınız", "Göster", [
    { title: "Sunumlar", rows },
  ]);
}
