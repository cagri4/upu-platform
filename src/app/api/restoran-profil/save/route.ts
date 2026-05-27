/**
 * POST /api/restoran-profil/save
 *
 * Restoran kullanıcısı kayıt formunu doldurunca:
 *   1. Token doğrula + tek-kullanım işaretle
 *   2. profiles.display_name + metadata güncelle
 *      (restaurant_name, location, segment, capacity, accounting, briefing_enabled,
 *       onboarding_completed=true, discovery_step=0)
 *   3. **Demo seed otomatik tetikle** — Sultan Ahmet Kebabevi dataset'i
 *      restoran tenant'a force=1 ile yazılır. Tüm rst_* satırların
 *      created_by alanı yeni sahip user_id olur. Mevcut tenant verisi
 *      varsa silinir → idempotent.
 *   4. WA'ya "demo hazır" mesajı + komut yol haritası
 *
 * Tenant scoped seed: rst_* kayıtları tenant_id'ye bağlı, tenant_id
 * tüm restoran kullanıcıları için aynı (config.ts: 03f58dcb-...).
 * Multi-prospect senaryoda son form-save tüm tenant verisini siler ve
 * yeniden yazar — demo için kabul edilebilir; production-clean için
 * her sahibin kendi tenant'ı (V2).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { sendText, sendUrlButton } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";
import {
  DEMO_TABLES, DEMO_MENU, DEMO_INVENTORY, DEMO_LOYALTY,
  DEMO_PAID_ORDERS, DEMO_RESERVATIONS,
} from "@/tenants/restoran/demo-import/sultan-ahmet";
import { brandNameToSlug } from "@/tenants/restoran/b2c/restaurant-resolver";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEGMENT_VALUES = new Set(["restoran", "cafe", "catering", "tatlici"]);
const CAPACITY_VALUES = new Set(["kucuk", "orta", "buyuk"]);
const ACCOUNTING_VALUES = new Set(["yuki", "exact", "snelstart", "other", "none", ""]);
const BRIFING_VALUES = new Set(["evet", "hayir"]);

interface Payload {
  token?: string;
  display_name: string;
  restaurant_name: string;
  location: string;
  segment: string;
  capacity: string;
  accounting: string;
  brifing_enabled: string;
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = await req.json() as Payload;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  // ── Validation ─────────────────────────────────────────────────────────
  const display_name = s(body.display_name);
  const restaurant_name = s(body.restaurant_name);
  const location = s(body.location);
  const segment = s(body.segment);
  const capacity = s(body.capacity);
  const accounting = s(body.accounting);
  const brifing_enabled = s(body.brifing_enabled);

  if (display_name.length < 2) return NextResponse.json({ error: "Ad soyad en az 2 karakter." }, { status: 400 });
  if (restaurant_name.length < 2) return NextResponse.json({ error: "Restoran adı en az 2 karakter." }, { status: 400 });
  if (location.length < 2) return NextResponse.json({ error: "Şehir/bölge gerekli." }, { status: 400 });
  if (!SEGMENT_VALUES.has(segment)) return NextResponse.json({ error: "Geçerli işletme tipi seçin." }, { status: 400 });
  if (!CAPACITY_VALUES.has(capacity)) return NextResponse.json({ error: "Geçerli kapasite seçin." }, { status: 400 });
  if (!ACCOUNTING_VALUES.has(accounting)) return NextResponse.json({ error: "Geçerli muhasebe seçin." }, { status: 400 });
  if (!BRIFING_VALUES.has(brifing_enabled)) return NextResponse.json({ error: "Brifing tercihi seçin." }, { status: 400 });

  const supabase = getServiceClient();

  // ── Profile lookup (tenant-aware) ───────────────────────────────────────
  const lookup = await resolveTenantProfile<{
    id: string; whatsapp_phone: string | null; tenant_id: string;
    metadata: Record<string, unknown> | null;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "restoran",
    select: "id, whatsapp_phone, tenant_id, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;
  const userId = profile.id;
  const tenantId = profile.tenant_id;
  const userPhone = profile.whatsapp_phone;

  // ── Profile güncelle ───────────────────────────────────────────────────
  const newMeta = {
    ...(profile.metadata as Record<string, unknown> || {}),
    restaurant_name,
    location,
    segment,
    cuisine_type: segment, // backward compat (mevcut briefing kodu cuisine_type'ı okuyor olabilir)
    capacity,
    accounting_provider: accounting || null,
    briefing_enabled: brifing_enabled === "evet",
    onboarding_completed: true,
    discovery_step: 0,
    profile_completed_at: new Date().toISOString(),
  };

  await supabase.from("profiles")
    .update({
      display_name,
      metadata: newMeta,
    })
    .eq("id", userId);

  // ── Token kullanıldı işaretle (sadece magic-link akışından geldiyse) ───
  if (auth.magicTokenId) {
    await supabase.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  // ── Onboarding state tamamlandı işaretle ───────────────────────────────
  // (Eski WA-onboarding flow'una düşmesin diye)
  const { data: existingOnb } = await supabase
    .from("onboarding_state")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingOnb) {
    await supabase.from("onboarding_state")
      .update({ completed_at: new Date().toISOString(), business_info: { ...newMeta } })
      .eq("user_id", userId);
  } else {
    await supabase.from("onboarding_state").insert({
      user_id: userId,
      tenant_id: tenantId,
      tenant_key: "restoran",
      current_step: "done",
      business_info: { ...newMeta },
      completed_at: new Date().toISOString(),
    });
  }

  // ── rst_restaurants public kart oluştur (B2C site için) ───────────────
  // Slug üret, çakışma varsa -2, -3 suffix dene. is_published=true varsayılan
  // (demo immediate, V2'de admin onayıyla publish butonu olabilir).
  let publicRestaurantId: string | null = null;
  try {
    publicRestaurantId = await upsertPublicRestaurant(supabase, {
      tenantId,
      ownerUserId: userId,
      brandName: restaurant_name,
      location,
    });
  } catch (err) {
    console.error("[restoran-profil/save] public restaurant upsert error", err);
    // Sessiz devam — demo seed yine çalışsın, /r/{slug} sonradan elle düzeltilebilir
  }

  // ── Demo seed otomatik trigger ─────────────────────────────────────────
  try {
    await seedRestoranTenant(supabase, tenantId, userId, publicRestaurantId);
  } catch (err) {
    console.error("[restoran-profil/save] seed error:", err);
    // Seed başarısız olsa bile profile kaydı yapıldı; kullanıcıya hata göster.
    return NextResponse.json({
      ok: true,
      warning: "Profil kaydedildi ama demo veri yüklenemedi: " + (err instanceof Error ? err.message : "bilinmeyen"),
    });
  }

  // ── WA welcome (3-mesaj warm welcome — emlak gold standard pattern) ───
  if (userPhone) {
    try {
      // Public site slug'ını fetch et (welcome'da link verelim)
      let publicSlug: string | null = null;
      if (publicRestaurantId) {
        const { data: rest } = await supabase
          .from("rst_restaurants")
          .select("slug")
          .eq("id", publicRestaurantId)
          .maybeSingle();
        publicSlug = rest?.slug || null;
      }
      await sendWarmWelcome(supabase, userId, userPhone, display_name, publicSlug);
    } catch (err) {
      console.error("[restoran-profil/save] WA send error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Seed implementation (yerel, /api/restoran-demo/seed ile aynı dataset) ─

async function upsertPublicRestaurant(
  supabase: ReturnType<typeof getServiceClient>,
  args: { tenantId: string; ownerUserId: string; brandName: string; location: string },
): Promise<string> {
  // Mevcut tenant için kayıt var mı? (UNIQUE tenant_id constraint var)
  const { data: existing } = await supabase
    .from("rst_restaurants")
    .select("id, slug")
    .eq("tenant_id", args.tenantId)
    .maybeSingle();

  if (existing) {
    // Brand name + location'ı güncel tut
    await supabase
      .from("rst_restaurants")
      .update({
        brand_name: args.brandName,
        address: args.location,
        owner_user_id: args.ownerUserId,
      })
      .eq("id", existing.id);
    return existing.id as string;
  }

  // Yeni — slug üret, çakışma kontrolü
  let baseSlug = brandNameToSlug(args.brandName);
  if (!baseSlug) baseSlug = `restoran-${Math.random().toString(36).slice(2, 8)}`;
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const { data: clash } = await supabase
      .from("rst_restaurants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${suffix++}`;
    if (suffix > 100) {
      slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
      break;
    }
  }

  const { data: inserted } = await supabase
    .from("rst_restaurants")
    .insert({
      tenant_id: args.tenantId,
      owner_user_id: args.ownerUserId,
      slug,
      brand_name: args.brandName,
      tagline: null,
      address: args.location,
      country: "NL",
      primary_color: "#d97706",
      secondary_color: "#0f172a",
      font_family: "Inter",
      opening_hours: { mon: "12:00-22:00", tue: "12:00-22:00", wed: "12:00-22:00", thu: "12:00-22:00", fri: "12:00-23:00", sat: "12:00-23:00", sun: "12:00-22:00" },
      social: {},
      is_published: true,  // MVP: demo immediate, V2: admin publish butonu
      accepts_online_payment: true,
      accepts_cash_on_delivery: true,
      accepts_dine_in: true,
      delivery_zones: [{ name: args.location, min_order: 15, fee: 3.5 }],
      estimated_prep_minutes: 30,
      enabled_languages: ["tr", "nl", "en"],
      default_language: "tr",
      menu_greeting: `Hoş geldiniz! ${args.brandName}'da bugün size ne ikram edelim?`,
    })
    .select("id")
    .single();

  if (!inserted) throw new Error("rst_restaurants insert başarısız");
  return inserted.id as string;
}

async function seedRestoranTenant(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  ownerId: string,
  publicRestaurantId: string | null,
): Promise<void> {
  // Önce mevcut veriyi sil (idempotent — multi-prospect demo'da son form save kazanır)
  await supabase.from("rst_order_items").delete().eq("tenant_id", tenantId);
  await supabase.from("rst_orders").delete().eq("tenant_id", tenantId);
  await supabase.from("rst_reservations").delete().eq("tenant_id", tenantId);
  await supabase.from("rst_loyalty_visits").delete().eq("tenant_id", tenantId);
  await supabase.from("rst_loyalty_members").delete().eq("tenant_id", tenantId);
  await supabase.from("rst_inventory").delete().eq("tenant_id", tenantId);
  await supabase.from("rst_menu_items").delete().eq("tenant_id", tenantId);
  await supabase.from("rst_tables").delete().eq("tenant_id", tenantId);

  // 1. Masalar — restaurant_id link
  const { data: insertedTables } = await supabase
    .from("rst_tables")
    .insert(DEMO_TABLES.map(t => ({
      tenant_id: tenantId,
      restaurant_id: publicRestaurantId,
      label: t.label, capacity: t.capacity, zone: t.zone, status: t.status,
      is_active: true,
    })))
    .select("id, label");
  const tableIdByLabel: Record<string, string> = {};
  for (const t of insertedTables || []) tableIdByLabel[t.label as string] = t.id as string;

  // 2. Menü — restaurant_id link + order_index
  const { data: insertedMenu } = await supabase
    .from("rst_menu_items")
    .insert(DEMO_MENU.map((m, idx) => ({
      tenant_id: tenantId,
      restaurant_id: publicRestaurantId,
      name: m.name, description: m.description || null,
      category: m.category, price: m.price,
      prep_minutes: m.prep_minutes || null,
      order_index: idx,
      is_available: true, is_active: true,
    })))
    .select("id, name");
  const menuIds: string[] = (insertedMenu || []).map(m => m.id as string);

  // 3. Stok
  await supabase.from("rst_inventory").insert(DEMO_INVENTORY.map(i => ({
    tenant_id: tenantId,
    name: i.name, unit: i.unit, quantity: i.quantity,
    low_threshold: i.low_threshold,
    supplier_name: i.supplier_name || null,
    is_active: true,
  })));

  // 4. Müdavimler
  const memberRows = DEMO_LOYALTY.map(m => {
    const lastVisit = new Date();
    lastVisit.setDate(lastVisit.getDate() - m.days_since_last_visit);
    const firstVisit = new Date(lastVisit);
    firstVisit.setMonth(firstVisit.getMonth() - Math.max(2, m.visit_count));
    return {
      tenant_id: tenantId,
      guest_phone: m.phone, guest_name: m.name,
      birthday: m.birthday || null,
      first_visit_at: firstVisit.toISOString(),
      last_visit_at: lastVisit.toISOString(),
      visit_count: m.visit_count, total_spent: m.total_spent,
      favorite_items: m.favorite_items || [],
      notes: m.notes || null,
      marketing_opt_in: true, source: "import", is_active: true,
    };
  });
  const { data: insertedMembers } = await supabase
    .from("rst_loyalty_members")
    .insert(memberRows)
    .select("id, guest_phone");
  const memberIdByPhone: Record<string, string> = {};
  for (const m of insertedMembers || []) memberIdByPhone[m.guest_phone as string] = m.id as string;

  // 5. Dünkü ödenmiş siparişler (created_by = ownerId)
  let orderNo = 1001;
  const orderItemsBuf: Array<Record<string, unknown>> = [];
  for (const o of DEMO_PAID_ORDERS) {
    const createdAt = new Date(Date.now() - o.hours_ago * 3600 * 1000);
    const paidAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
    const tableId = o.table_label !== "Paket" ? tableIdByLabel[o.table_label] || null : null;
    const memberPhone = o.loyalty_member_index !== undefined ? DEMO_LOYALTY[o.loyalty_member_index]?.phone : undefined;
    const memberId = memberPhone ? memberIdByPhone[memberPhone] : null;

    const { data: orderRow } = await supabase
      .from("rst_orders")
      .insert({
        tenant_id: tenantId,
        order_number: String(orderNo++),
        table_id: tableId,
        table_label: o.table_label !== "Paket" ? o.table_label : null,
        order_type: o.order_type, status: "paid",
        subtotal: o.total_amount, tax_amount: 0, discount: 0,
        total_amount: o.total_amount,
        guest_count: o.guest_count,
        guest_phone: memberPhone || null,
        loyalty_member_id: memberId,
        created_by: ownerId,
        served_at: paidAt.toISOString(),
        paid_at: paidAt.toISOString(),
        created_at: createdAt.toISOString(),
      })
      .select("id")
      .single();
    if (!orderRow) continue;

    for (const item of o.items) {
      const menuItem = DEMO_MENU[item.menu_index];
      const menuId = menuIds[item.menu_index] || null;
      if (!menuItem) continue;
      orderItemsBuf.push({
        tenant_id: tenantId,
        order_id: orderRow.id,
        menu_item_id: menuId,
        item_name: menuItem.name,
        quantity: item.quantity,
        unit_price: menuItem.price,
        total_price: menuItem.price * item.quantity,
        status: "served",
        created_at: createdAt.toISOString(),
      });
    }
  }
  if (orderItemsBuf.length) {
    await supabase.from("rst_order_items").insert(orderItemsBuf);
  }

  // 6. Rezervasyonlar (created_by = ownerId)
  const reservationRows = DEMO_RESERVATIONS.map(r => {
    const reservedAt = new Date(Date.now() + r.hours_from_now * 3600 * 1000);
    const memberPhone = r.loyalty_member_index !== undefined ? DEMO_LOYALTY[r.loyalty_member_index]?.phone : undefined;
    const memberId = memberPhone ? memberIdByPhone[memberPhone] : null;
    const tableId = r.table_label ? tableIdByLabel[r.table_label] || null : null;
    return {
      tenant_id: tenantId,
      guest_name: r.guest_name, guest_phone: r.guest_phone,
      party_size: r.party_size,
      reserved_at: reservedAt.toISOString(),
      duration_minutes: 90,
      table_id: tableId, table_label: r.table_label || null,
      status: r.status, source: r.source, notes: r.notes || null,
      loyalty_member_id: memberId,
      created_by: ownerId,
    };
  });
  await supabase.from("rst_reservations").insert(reservationRows);
}

// ── 3-Mesaj Warm Welcome (emlak gold standard pattern, 2026-05-07) ──────
//
// 1. greeting + core promise (formal "siz")
// 2. 4 madde (kabiliyetler)
// 3. panel CTA + 🖥 Paneli Aç magic link
// Aralarda sleep(1800) — sohbet havası.

async function sendWarmWelcome(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  phone: string,
  displayName: string,
  publicSlug: string | null,
): Promise<void> {
  const firstName = displayName.split(/\s+/)[0] || "Merhaba";

  // Mesaj 1 — greeting + core promise (formal "siz")
  const greeting =
    `👋 Merhaba ${firstName}! ✨\n\n` +
    `Ben kişisel asistanınız UPU. 7/24 siparişlerinizi hızlandırıp müdavim ilişkinizi güçlendireceğim.`;
  await sendText(phone, greeting);

  await sleep(1800);

  // Mesaj 2 — 4 kabiliyet
  const capabilities =
    `🎯 *Yapabileceklerimden bazıları:*\n\n` +
    `✅ Sabah dünkü satış + bugün rezervasyon brifinginizi hazırlarım\n` +
    `✅ Telefonla gelen rezervasyonlarınızı masa atamayla sisteme kaydederim\n` +
    `✅ Müdavim panosu — kim 2+ haftadır yok, kimin doğum günü olduğunu size bildiririm\n` +
    `✅ Sadakat club daveti + sürpriz mesaj taslaklarını hazırlarım`;
  await sendText(phone, capabilities);

  await sleep(1800);

  // Mesaj 3 — Panel CTA (yeni magic link mint, "🖥 Paneli Aç" buton)
  const panelToken = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: userId,
    token: panelToken,
    expires_at: expiresAt,
  });
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL_RESTORAN || "https://restoranai.upudev.nl";
  const panelUrl = `${APP_URL}/tr/restoran-panel?t=${panelToken}`;
  const publicSiteLine = publicSlug
    ? `\n🌐 *Müşterileriniz için:* ${APP_URL}/tr/r/${publicSlug} — menü + online sipariş hazır.`
    : "";
  const ctaMsg =
    `🖥 *Yönetim paneliniz hazır.*\n\n` +
    `Tüm sisteminizi yönetmek için panele gidin. Demo verisi olarak Sultan Ahmet Kebabevi yüklendi — gerçek bağlantı kurulana kadar üzerinde çalışırsınız.` +
    publicSiteLine +
    `\n\n_Dilerseniz daha sonra komutlarla buradan da yönetebilirsiniz._`;
  await sendUrlButton(phone, ctaMsg, "🖥 Paneli Aç", panelUrl, { skipNav: true });
}
