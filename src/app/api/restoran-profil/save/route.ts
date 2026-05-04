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
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import {
  DEMO_TABLES, DEMO_MENU, DEMO_INVENTORY, DEMO_LOYALTY,
  DEMO_PAID_ORDERS, DEMO_RESERVATIONS,
} from "@/tenants/restoran/demo-import/sultan-ahmet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEGMENT_VALUES = new Set(["restoran", "cafe", "catering", "tatlici"]);
const CAPACITY_VALUES = new Set(["kucuk", "orta", "buyuk"]);
const ACCOUNTING_VALUES = new Set(["yuki", "exact", "snelstart", "other", "none", ""]);
const BRIFING_VALUES = new Set(["evet", "hayir"]);

interface Payload {
  token: string;
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

  const token = s(body.token);
  if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

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

  // ── Token doğrulama ────────────────────────────────────────────────────
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const userId = magicToken.user_id as string;

  // ── Mevcut profile çek ─────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("whatsapp_phone, tenant_id, metadata")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });
  const tenantId = profile.tenant_id as string;
  const userPhone = profile.whatsapp_phone as string | null;

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

  // ── Token kullanıldı işaretle ──────────────────────────────────────────
  await supabase.from("magic_link_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", magicToken.id);

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

  // ── Demo seed otomatik trigger ─────────────────────────────────────────
  try {
    await seedRestoranTenant(supabase, tenantId, userId);
  } catch (err) {
    console.error("[restoran-profil/save] seed error:", err);
    // Seed başarısız olsa bile profile kaydı yapıldı; kullanıcıya hata göster.
    return NextResponse.json({
      ok: true,
      warning: "Profil kaydedildi ama demo veri yüklenemedi: " + (err instanceof Error ? err.message : "bilinmeyen"),
    });
  }

  // ── WA welcome (komut roadmap'i) ───────────────────────────────────────
  if (userPhone) {
    try {
      await sendDemoWelcomeMessages(userPhone, display_name, restaurant_name);
    } catch (err) {
      console.error("[restoran-profil/save] WA send error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

// ── Seed implementation (yerel, /api/restoran-demo/seed ile aynı dataset) ─

async function seedRestoranTenant(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  ownerId: string,
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

  // 1. Masalar
  const { data: insertedTables } = await supabase
    .from("rst_tables")
    .insert(DEMO_TABLES.map(t => ({
      tenant_id: tenantId,
      label: t.label, capacity: t.capacity, zone: t.zone, status: t.status,
      is_active: true,
    })))
    .select("id, label");
  const tableIdByLabel: Record<string, string> = {};
  for (const t of insertedTables || []) tableIdByLabel[t.label as string] = t.id as string;

  // 2. Menü
  const { data: insertedMenu } = await supabase
    .from("rst_menu_items")
    .insert(DEMO_MENU.map(m => ({
      tenant_id: tenantId,
      name: m.name, description: m.description || null,
      category: m.category, price: m.price,
      prep_minutes: m.prep_minutes || null,
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

// ── WA welcome message (komut yol haritası) ─────────────────────────────

async function sendDemoWelcomeMessages(phone: string, name: string, restaurantName: string): Promise<void> {
  const firstName = name.split(/\s+/)[0] || "Merhaba";

  // Mesaj 1: tebrik + örnek restoran tanıtımı
  await sendText(phone,
    `🎉 *Hoş geldin ${firstName}!*\n\n` +
    `${restaurantName} profilini kaydettim. Şimdi seninle bir örnek üzerinden ilerleyeceğiz: ` +
    `*Sultan Ahmet Kebabevi (Rotterdam)* — bizim demo restoranımız.\n\n` +
    `Ekibimiz kurulumda kendi POS'unuza, mutfak sisteminize ve muhasebenize bağlanacak. ` +
    `Şimdilik bu örnek veri üzerinden komutları deneyebilirsin.`);

  // Mesaj 2: bugünkü brifing önizleme + komut roadmap
  await sendButtons(phone,
    `☀️ *İlk komut:* \`brifing\`\n\n` +
    `Sabah brifingini deneyelim. Sultan Ahmet'in dünkü satış, bugünkü rezervasyonları, doğum günü olan müdavimleri ve kritik stoğunu göreceksin.\n\n` +
    `*Sonra şunları sırayla deneyebilirsin:*\n` +
    `• \`rezervasyon\` — bugün+yarın liste\n` +
    `• \`sadakat\` — müdavim panosu (Murat 18 gündür yok)\n` +
    `• \`rezervasyonekle\` — yeni rezervasyon ekle\n` +
    `• \`menukalemleri\` — 30 yemek\n` +
    `• \`stok\` — kritik kalemler\n\n` +
    `Hazırsan başla 👇`,
    [
      { id: "cmd:brifing", title: "☀️ Brifing" },
      { id: "cmd:rezervasyon", title: "📅 Rezervasyon" },
      { id: "cmd:sadakat", title: "💝 Müdavim" },
    ]);
}
