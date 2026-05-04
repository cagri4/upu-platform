/**
 * Demo seed — Anadolu Sofrası (Rotterdam) + virtual sahip Ahmet Demir.
 *
 * Müşteri görüşmesi için tek-komutla hazır demo:
 *   1. Virtual sahip profile oluşturur (auth.users + profiles)
 *   2. Onboarding'i "done" işaretler (briefing_enabled=true)
 *   3. /api/restoran-demo/seed endpoint'ini magic token ile tetikler
 *      → 8 masa, 30 menü, 10 stok (3 kritik), 8 müdavim, 5 dünkü sipariş,
 *        7 rezervasyon (4 bugün + 3 yarın)
 *
 * Kullanım:
 *   node scripts/seed-restoran-demo.mjs
 *   OWNER_PHONE=905XX node scripts/seed-restoran-demo.mjs   # özel telefon
 *
 * OWNER_PHONE: opsiyonel — kullanıcı kendi WA telefonunu vermek isterse
 * (cron sabah brifingini buraya gönderir). Verilmezse placeholder TR demo
 * numarası kullanılır (gerçek WA delivery yok, sadece DB referansı).
 *
 * Idempotent: tekrar çalıştırılırsa profile bulup capability tazeler;
 * seed --force=1 ile çalışır → mevcut tenant verisi temizlenip yeniden yazılır.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.local'i manuel parse et (dotenv require'a gerek kalmasın)
function loadEnv() {
  try {
    const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    }
  } catch { /* env file optional, fall back to process.env */ }
}
loadEnv();

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const OWNER_PHONE = (process.env.OWNER_PHONE || "905551112233").replace(/\D/g, "");
const SEED_BASE_URL = (process.env.SEED_BASE_URL || "https://restoranai.upudev.nl").trim();

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("✗ Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  console.error("  .env.local'da olması yeterli, ya da export ile geçici verilebilir");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const TENANT_ID = "03f58dcb-b931-4dcf-bd47-a0885f9286e8";
const RESTAURANT_NAME = "Anadolu Sofrası";
const OWNER_NAME = "Ahmet Demir";
const LOCATION = "Rotterdam Centrum";

async function findOrCreateOwnerProfile(phone) {
  // 1) Aynı tenant + telefon profili var mı?
  const { data: existing } = await sb
    .from("profiles")
    .select("id, role, capabilities, metadata")
    .eq("tenant_id", TENANT_ID)
    .eq("whatsapp_phone", phone)
    .maybeSingle();

  if (existing) {
    console.log(`✓ Owner profile zaten var: ${existing.id}`);
    const updates = {};
    if (!(existing.capabilities || []).includes("*")) {
      updates.capabilities = ["*"];
    }
    const meta = existing.metadata || {};
    if (!meta.briefing_enabled || !meta.onboarding_completed) {
      updates.metadata = {
        ...meta,
        restaurant_name: meta.restaurant_name || RESTAURANT_NAME,
        location: meta.location || LOCATION,
        cuisine_type: meta.cuisine_type || "turk",
        capacity: meta.capacity || "orta",
        briefing_enabled: true,
        onboarding_completed: true,
      };
    }
    if (Object.keys(updates).length > 0) {
      await sb.from("profiles").update(updates).eq("id", existing.id);
      console.log(`  capabilities + metadata güncellendi`);
    }
    return existing.id;
  }

  // 2) Yeni auth user + profile
  const email = `restoran_owner_${Date.now()}_${randomBytes(3).toString("hex")}@placeholder.upudev.nl`;
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { source: "demo-seed" },
  });
  if (authErr || !authUser?.user) throw authErr || new Error("auth.users create failed");

  const { error: profErr } = await sb.from("profiles").insert({
    id: authUser.user.id,
    tenant_id: TENANT_ID,
    display_name: OWNER_NAME,
    role: "admin",
    whatsapp_phone: phone,
    capabilities: ["*"],
    metadata: {
      restaurant_name: RESTAURANT_NAME,
      location: LOCATION,
      cuisine_type: "turk",
      capacity: "orta",
      briefing_enabled: true,
      onboarding_completed: true,
    },
  });
  if (profErr) throw profErr;
  console.log(`✓ Yeni owner profile: ${authUser.user.id} (${phone})`);
  return authUser.user.id;
}

async function ensureOnboardingDone(userId) {
  await sb.from("onboarding_state").delete().eq("user_id", userId);
  const { error } = await sb.from("onboarding_state").insert({
    user_id: userId,
    tenant_id: TENANT_ID,
    tenant_key: "restoran",
    current_step: "done",
    business_info: {
      display_name: OWNER_NAME,
      restaurant_name: RESTAURANT_NAME,
      location: LOCATION,
      cuisine_type: "turk",
      capacity: "orta",
      briefing: "evet",
    },
    completed_at: new Date().toISOString(),
  });
  if (error) console.warn(`  onboarding_state insert warning: ${error.message}`);
  else console.log(`✓ Onboarding marked as done`);
}

async function ensureSaasActiveSession(userId, phone) {
  // Router router.ts:110 — phone bazlı saas_active_session ile tenant scope.
  // Owner bot'a yazınca doğrudan restoran'a düşsün diye kayıt açıyoruz.
  await sb.from("saas_active_session").delete().eq("phone", phone);
  const { error } = await sb.from("saas_active_session").insert({
    phone,
    active_saas_key: "restoran",
  });
  if (error) console.warn(`  saas_active_session warning: ${error.message}`);
  else console.log(`✓ saas_active_session set → restoran`);
}

async function ensureInviteLink(ownerId) {
  // Universal invite link — yeni telefon WA'dan bu kodu yazınca otomatik
  // restoran tenant'a kayıt olup admin (sahip) rolüyle giriş yapar.
  // Demo prospect'lerine bu kodu paylaşıyoruz.
  const { data: existing } = await sb
    .from("invite_links")
    .select("id, code")
    .eq("tenant_id", TENANT_ID)
    .eq("created_by", ownerId)
    .eq("role", "admin")
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    console.log(`✓ Invite link zaten var: ${existing.code}`);
    return existing.code;
  }

  // 6-hex kod
  const code = randomBytes(3).toString("hex").toUpperCase();
  const { error } = await sb.from("invite_links").insert({
    tenant_id: TENANT_ID,
    created_by: ownerId,
    code,
    role: "admin",
    permissions: {},
    max_uses: null,
    used_count: 0,
    is_active: true,
  });
  if (error) {
    console.warn(`  invite_links insert warning: ${error.message}`);
    return null;
  }
  console.log(`✓ Invite link mintled: ${code}`);
  return code;
}

async function mintMagicToken(userId) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await sb.from("magic_link_tokens").insert({
    user_id: userId,
    token,
    expires_at: expires,
  });
  if (error) throw error;
  return token;
}

async function callSeedEndpoint(token) {
  const url = `${SEED_BASE_URL}/api/restoran-demo/seed?token=${token}&force=1`;
  console.log(`→ ${url.replace(token, token.slice(0, 8) + "...")}`);
  const res = await fetch(url, { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`✗ Seed endpoint hatası: HTTP ${res.status}`, json);
    throw new Error(`Seed failed: ${json.error || res.status}`);
  }
  return json;
}

async function verifyCounts() {
  const tables = ["rst_tables", "rst_menu_items", "rst_inventory", "rst_loyalty_members", "rst_orders", "rst_reservations"];
  const results = {};
  for (const t of tables) {
    const { count } = await sb.from(t).select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_ID);
    results[t] = count || 0;
  }
  return results;
}

(async () => {
  try {
    console.log(`\n━━━ Restoran Demo Seed ━━━`);
    console.log(`Tenant : ${TENANT_ID} (restoran)`);
    console.log(`Owner  : ${OWNER_NAME} — ${RESTAURANT_NAME}, ${LOCATION}`);
    console.log(`Phone  : ${OWNER_PHONE} (${process.env.OWNER_PHONE ? "verildi" : "placeholder — gerçek WA delivery yok"})`);
    console.log(`Endpoint: ${SEED_BASE_URL}/api/restoran-demo/seed`);
    console.log("");

    const ownerId = await findOrCreateOwnerProfile(OWNER_PHONE);
    await ensureOnboardingDone(ownerId);
    await ensureSaasActiveSession(ownerId, OWNER_PHONE);

    const inviteCode = await ensureInviteLink(ownerId);

    const token = await mintMagicToken(ownerId);
    console.log(`✓ Magic token mintled`);

    const result = await callSeedEndpoint(token);
    console.log(`✓ Seed başarılı:`, result.seeded);

    console.log(`\n━━━ Doğrulama ━━━`);
    const counts = await verifyCounts();
    for (const [table, count] of Object.entries(counts)) {
      console.log(`  ${table}: ${count}`);
    }

    console.log(`\n━━━ Demo Hazır ━━━`);
    console.log(`Owner ID    : ${ownerId}`);
    console.log(`Owner WA    : +${OWNER_PHONE}`);
    console.log(`Invite Code : ${inviteCode || "(oluşturulamadı)"}`);
    console.log(`URL         : ${SEED_BASE_URL}/`);
    console.log(`WA Bot      : https://wa.me/31644967207`);
    console.log("");
    if (inviteCode) {
      const inviteText = encodeURIComponent(`Merhaba, demo için kayıt olmak istiyorum.\n\nKod: ${inviteCode}`);
      console.log(`Demo wa.me linki (prospect'e gönder):`);
      console.log(`  https://wa.me/31644967207?text=${inviteText}`);
      console.log("");
      console.log(`Prospect linke tıklar → WA'da prefilled mesaj atar → bot kodu tanır →`);
      console.log(`6-soruluk onboarding (~2 dk) → restoran tenant'a admin olarak girer →`);
      console.log(`Sultan Ahmet seed verisi orada hazır (8 masa, 30 menü, 8 müdavim, 7 rezervasyon).`);
    }
    console.log("");
  } catch (err) {
    console.error(`\n✗ Hata:`, err.message || err);
    process.exit(1);
  }
})();
