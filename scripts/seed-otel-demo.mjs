/**
 * Demo seed — Marina Resort + 5 oda + 1 personel + 2 misafir + 1 rez +
 * 1 pre-checkin tamamlanmış. Müşteri görüşmesi için.
 *
 * Kullanım:
 *   OWNER_PHONE=905551112233 node scripts/seed-otel-demo.mjs
 *
 * OWNER_PHONE: demo sahibi olarak bağlanacak WA telefon (kullanıcının
 * kendi numarası — bot bu numaradan mesaj gelince admin/owner kabul eder).
 *
 * Idempotent: aynı ada sahip otel varsa "already exists" diyip çıkar.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
// Trim + sadece rakamları al — env file'da \n veya boşluk olsa bile temiz
const OWNER_PHONE = (process.env.OWNER_PHONE || "").replace(/\D/g, "");

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!OWNER_PHONE) {
  console.error("Missing OWNER_PHONE — bu kullanıcının WA telefonu olmalı, owner profile bağlanacak");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const TENANT_ID = "16871326-afef-4ba3-a079-2c5ede8fac4d"; // otel tenant
const HOTEL_NAME = "Marina Resort";

async function findOrCreateOwnerProfile(phone) {
  // 1) Aynı tenant + telefon profili var mı?
  const { data: existing } = await sb
    .from("profiles")
    .select("id, role, capabilities")
    .eq("tenant_id", TENANT_ID)
    .eq("whatsapp_phone", phone)
    .maybeSingle();

  if (existing) {
    console.log(`✓ Owner profile zaten var: ${existing.id}`);
    // Capability güvence: '*' eksikse ekle
    if (!(existing.capabilities || []).includes("*")) {
      await sb.from("profiles").update({ capabilities: ["*"] }).eq("id", existing.id);
      console.log(`  capabilities='*' güncellendi`);
    }
    return existing.id;
  }

  // 2) Yeni auth user + profile
  const email = `otel_owner_${Date.now()}_${randomBytes(3).toString("hex")}@placeholder.upudev.nl`;
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email, email_confirm: true, user_metadata: { source: "demo-seed" },
  });
  if (authErr || !authUser?.user) throw authErr || new Error("auth.users create failed");

  const { error: profErr } = await sb.from("profiles").insert({
    id: authUser.user.id,
    tenant_id: TENANT_ID,
    display_name: "Ayşe Demir",
    role: "admin",
    whatsapp_phone: phone,
    capabilities: ["*"],
    metadata: {
      hotel_name: HOTEL_NAME,
      location: "Antalya Kemer",
      room_count: "21-50",
      briefing_enabled: true,
      onboarding_completed: true,
    },
  });
  if (profErr) throw profErr;
  console.log(`✓ Yeni owner profile: ${authUser.user.id} (${phone})`);
  return authUser.user.id;
}

async function findOrCreateHotel(ownerId) {
  const { data: existing } = await sb
    .from("otel_hotels")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("name", HOTEL_NAME)
    .maybeSingle();

  if (existing) {
    console.log(`✓ Hotel zaten var: ${existing.id}`);
    return existing.id;
  }

  const { data: hotel, error } = await sb.from("otel_hotels").insert({
    tenant_id: TENANT_ID,
    name: HOTEL_NAME,
    address: "Atatürk Bulvarı No: 42",
    city: "Antalya",
    country: "TR",
    timezone: "Europe/Istanbul",
    contact_email: "info@marinaresort.demo",
    contact_phone: "+90 242 555 1234",
    room_count: 24,
    check_in_time: "14:00",
    check_out_time: "12:00",
    metadata: {
      breakfast_time: "07:00 - 10:30",
      wifi_ssid: "MarinaGuest",
      wifi_password: "Marina2026",
      spa_available: true,
      restaurant_available: true,
      pool_available: true,
      reception_phone: "İç hat 0",
    },
  }).select("id").single();
  if (error) throw error;

  await sb.from("otel_user_hotels").insert({
    tenant_id: TENANT_ID,
    user_id: ownerId,
    hotel_id: hotel.id,
    role: "owner",
  });
  console.log(`✓ Yeni hotel: ${hotel.id} (otel_user_hotels link kuruldu)`);
  return hotel.id;
}

async function ensureRooms(hotelId) {
  const { data: existing } = await sb.from("otel_rooms").select("id").eq("hotel_id", hotelId).limit(1);
  if (existing?.length) {
    console.log(`✓ Rooms zaten var (skip)`);
    const { data: all } = await sb.from("otel_rooms").select("id, name").eq("hotel_id", hotelId).order("sort_order");
    return all;
  }

  // status check: clean / dirty / out_of_order (otel_rooms_status_check)
  const rooms = [
    { name: "101", room_type: "standard", bed_type: "double",  max_occupancy: 2, base_price: 1800, status: "clean",        sort_order: 1 },
    { name: "102", room_type: "standard", bed_type: "twin",    max_occupancy: 2, base_price: 1800, status: "clean",        sort_order: 2 },
    { name: "201", room_type: "deluxe",   bed_type: "double",  max_occupancy: 2, base_price: 2400, status: "dirty",        sort_order: 3 },
    { name: "202", room_type: "deluxe",   bed_type: "double",  max_occupancy: 3, base_price: 2400, status: "clean",        sort_order: 4 },
    { name: "301", room_type: "suite",    bed_type: "king",    max_occupancy: 4, base_price: 3800, status: "out_of_order", sort_order: 5 },
  ].map(r => ({ ...r, tenant_id: TENANT_ID, hotel_id: hotelId, amenities: ["wifi", "tv", "klima", "minibar"] }));

  const { data, error } = await sb.from("otel_rooms").insert(rooms).select("id, name");
  if (error) throw error;
  console.log(`✓ ${data.length} oda eklendi`);
  return data;
}

async function ensureEmployee(ownerId, hotelId) {
  const { data: existing } = await sb
    .from("profiles")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("invited_by", ownerId)
    .eq("role", "employee")
    .limit(1)
    .maybeSingle();
  if (existing) {
    console.log(`✓ Personel zaten var: ${existing.id}`);
    return existing.id;
  }

  const RECEPTION_CAPS = [
    "reservations:view", "reservations:create", "reservations:edit", "reservations:checkin",
    "guests:view", "guests:message", "guests:invite",
    "rooms:view", "availability:view", "pricing:view",
    "housekeeping:view", "pre-checkin:view", "pre-checkin:push",
  ];

  const email = `otel_emp_${Date.now()}_${randomBytes(3).toString("hex")}@placeholder.upudev.nl`;
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email, email_confirm: true, user_metadata: { source: "demo-seed" },
  });
  if (authErr || !authUser?.user) throw authErr;

  await sb.from("profiles").insert({
    id: authUser.user.id,
    tenant_id: TENANT_ID,
    display_name: "Mehmet Yılmaz",
    role: "employee",
    whatsapp_phone: null, // davet kodu ile bağlanır — gerçek demoda kullanıcı kendi 2. telefonunu eşler
    capabilities: RECEPTION_CAPS,
    invited_by: ownerId,
    metadata: { position: "Resepsiyonist" },
  });

  await sb.from("hotel_employees").insert({
    hotel_id: hotelId, profile_id: authUser.user.id,
    capabilities: RECEPTION_CAPS, position: "Resepsiyonist", shift_hours: "08:00-16:00",
  });

  // Pending invite_code (5-hex demo)
  const code = randomBytes(3).toString("hex").toUpperCase();
  await sb.from("invite_codes").insert({
    tenant_id: TENANT_ID, user_id: authUser.user.id, code, status: "pending",
  });

  console.log(`✓ Personel eklendi: Mehmet Yılmaz (Resepsiyonist) — invite kod: ${code}`);
  return authUser.user.id;
}

async function ensureGuests(hotelId) {
  const guests = [
    { name: "Ali Demir",      phone: "905551111111" },
    { name: "Zeynep Kara",    phone: "905552222222" },
  ];

  const ids = [];
  for (const g of guests) {
    const { data: existing } = await sb
      .from("profiles")
      .select("id, whatsapp_phone")
      .eq("tenant_id", TENANT_ID)
      .eq("whatsapp_phone", g.phone)
      .maybeSingle();
    if (existing) { ids.push({ ...g, id: existing.id }); continue; }

    const email = `otel_guest_${Date.now()}_${randomBytes(3).toString("hex")}@placeholder.upudev.nl`;
    const { data: authUser } = await sb.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { source: "demo-seed" },
    });
    await sb.from("profiles").insert({
      id: authUser.user.id,
      tenant_id: TENANT_ID,
      display_name: g.name,
      role: "guest",
      whatsapp_phone: g.phone,
      capabilities: [
        "reservations:view-own", "guest-services:view", "guest-request:create",
        "guest-pre-checkin:form", "reservations:cancel-own",
      ],
      metadata: { invited_for_hotel_id: hotelId, marketing_opt_in: false },
    });
    ids.push({ ...g, id: authUser.user.id });
    console.log(`✓ Guest profile: ${g.name} (${g.phone})`);
  }
  return ids;
}

async function ensureReservations(hotelId, rooms, guests) {
  const { data: existing } = await sb.from("otel_reservations").select("id").eq("hotel_id", hotelId).limit(1);
  if (existing?.length) { console.log(`✓ Rezervasyonlar zaten var (skip)`); return existing[0].id; }

  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today); dayAfterTomorrow.setDate(today.getDate() + 3);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const todayPlus2 = new Date(today); todayPlus2.setDate(today.getDate() + 1);
  const iso = (d) => d.toISOString().slice(0, 10);

  // Rez 1: Ali Demir, yarın gelecek (cron T-24h test'i için), Oda 101, online check-in TAMAMLANMIŞ
  const rez1 = {
    tenant_id: TENANT_ID,
    hotel_id: hotelId,
    room_id: rooms[0].id, // 101
    guest_name: guests[0].name,
    guest_phone: guests[0].phone,
    guest_email: "ali@demo.tr",
    guest_profile_id: guests[0].id,
    check_in: iso(tomorrow),
    check_out: iso(dayAfterTomorrow),
    status: "confirmed",
    total_price: 3600,
    pre_checkin_complete: true,
    notes: "Demo: online check-in tamamlandı, anahtar hazır",
    source: "direct",
  };

  // Rez 2: Zeynep Kara, dün başladı bugün gece konaklıyor, Oda 202, status=checked_in
  const rez2 = {
    tenant_id: TENANT_ID,
    hotel_id: hotelId,
    room_id: rooms[3].id, // 202 (occupied)
    guest_name: guests[1].name,
    guest_phone: guests[1].phone,
    guest_profile_id: guests[1].id,
    check_in: iso(yesterday),
    check_out: iso(todayPlus2),
    status: "checked_in",
    total_price: 4800,
    pre_checkin_complete: true,
    source: "booking",
  };

  // Rez 3: yarın gelecek başka bir rezervasyon — cron link gönderecek (pre_checkin_complete=false)
  const rez3 = {
    tenant_id: TENANT_ID,
    hotel_id: hotelId,
    room_id: rooms[1].id, // 102
    guest_name: "Veli Aksoy",
    guest_phone: "905553333333",
    guest_profile_id: null, // henüz davet edilmemiş — resepsiyonist /misafirdavet ile bağlayabilir
    check_in: iso(tomorrow),
    check_out: iso(dayAfterTomorrow),
    status: "confirmed",
    total_price: 1800,
    pre_checkin_complete: false,
    source: "airbnb",
  };

  const { data: rezs, error } = await sb.from("otel_reservations").insert([rez1, rez2, rez3]).select("id, guest_name");
  if (error) throw error;
  console.log(`✓ ${rezs.length} rezervasyon eklendi: ${rezs.map(r => r.guest_name).join(", ")}`);

  // Pre-checkin row for Ali (tamamlanmış)
  await sb.from("otel_pre_checkins").insert({
    reservation_id: rezs[0].id,
    hotel_id: hotelId,
    guest_profile_id: guests[0].id,
    id_photo_url: "https://placehold.co/400x250/png?text=Demo+Kimlik",
    preferences: {
      eta: "14:30 — uçaktan sonra",
      breakfast_diet: "vegetarian",
      allergies: "yok",
      pillow: "yumuşak",
      smoking: "no",
    },
    kvkk_accepted_at: new Date().toISOString(),
    marketing_opt_in: true,
    completed_at: new Date().toISOString(),
  });
  console.log(`✓ Pre-checkin (Ali) tamamlanmış olarak işaretlendi`);

  return rezs;
}

async function main() {
  console.log(`\n🌱 Demo seed — Marina Resort\n   Tenant: ${TENANT_ID}\n   Owner: ${OWNER_PHONE}\n`);
  const ownerId = await findOrCreateOwnerProfile(OWNER_PHONE);
  const hotelId = await findOrCreateHotel(ownerId);
  const rooms = await ensureRooms(hotelId);
  const empId = await ensureEmployee(ownerId, hotelId);
  const guests = await ensureGuests(hotelId);
  await ensureReservations(hotelId, rooms, guests);
  console.log(`\n✅ Demo hazır.\n`);
  console.log(`   Owner WA: ${OWNER_PHONE} (Ayşe Demir)`);
  console.log(`   Hotel: ${HOTEL_NAME} (${hotelId})`);
  console.log(`   Personel: Mehmet Yılmaz (kayıt kodu yukarıda)`);
  console.log(`   Misafir: Ali Demir + Zeynep Kara + Veli Aksoy (rez)`);
}

main().catch(err => { console.error("\n❌ Seed hatası:", err); process.exit(1); });
