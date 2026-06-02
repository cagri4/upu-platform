#!/usr/bin/env node
/**
 * #106 self-test — kredi limiti enforcement E2E.
 *
 * Senaryo:
 *   a) credit_limit=10000, balance=8000, sipariş=1500 → 200 OK (8000+1500=9500<10000)
 *   b) balance=8000, sipariş=3000              → 409 credit_limit_exceeded (8000+3000=11000>10000)
 *   c) credit_limit=NULL                        → 200 OK (limitsiz)
 *   d) Admin endpoint ile limit=20000          → success
 *   e) Yeni limit ile sipariş=5000              → 200 OK (8000+5000=13000<20000)
 *
 * Çalıştırma:
 *   1. `npm run dev` ayrı terminalde
 *   2. `node scripts/test_credit_limit.mjs`
 */
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const SUPABASE_URL = "https://eodjowwdhsircwebxcmh.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZGpvd3dkaHNpcmN3ZWJ4Y21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5MTUzNywiZXhwIjoyMDg5ODY3NTM3fQ.wyBKr9n1ut9jid3dLXP9Md7VveSzshSQA0XBto5cjtQ";
const BAYI_TENANT_ID = "32f5feda-700f-44c6-a270-5bbb5a040994"; // saas_type=bayi
const BASE = "http://localhost:3000";
const HOST = "retailai.upudev.nl";

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function sb(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(`${r.status} ${path} → ${text}`);
  return body;
}

async function createAuthUser(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, email_confirm: true, password: randomBytes(16).toString("hex") }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`auth create failed ${r.status}: ${JSON.stringify(body)}`);
  return body.id; // auth.users.id
}

async function deleteAuthUser(authId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authId}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

function curl(url, payload) {
  // Node fetch yasakladığından Host header'ı curl ile override.
  const out = execFileSync("curl", [
    "-s", "-X", "POST",
    "-w", "\n__STATUS__:%{http_code}",
    "-H", `Host: ${HOST}`,
    "-H", "Content-Type: application/json",
    "--data-raw", JSON.stringify(payload),
    url,
  ], { encoding: "utf8" });
  const m = out.match(/^([\s\S]*?)\n?__STATUS__:(\d+)\s*$/);
  const rawBody = m ? m[1] : out;
  const status = m ? Number(m[2]) : 0;
  let body;
  try { body = rawBody ? JSON.parse(rawBody) : null; } catch { body = rawBody; }
  return { status, body };
}

function placeOrder(token, total, label) {
  return curl(`${BASE}/api/bayi-dealer-orders/create?t=${token}`, {
    items: [{ product_name: `Test Ürün ${label}`, unit_price: total, quantity: 1 }],
    notes: `self-test ${label}`,
  });
}

function setLimit(actorToken, dealerId, newLimit, reason) {
  return curl(`${BASE}/api/admin/bayi-dealers/${dealerId}/credit-limit?t=${actorToken}`, {
    new_limit: newLimit,
    reason,
  });
}

async function makeMagicToken(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
  await sb("magic_link_tokens", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, token, expires_at: expiresAt }),
  });
  return token;
}

const log = (...a) => console.log(...a);
const ok = (cond, label) => log(cond ? `✅ ${label}` : `❌ ${label}`);

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const phone = `9000${stamp}`;
  log(`\n=== #106 kredi limiti E2E self-test ===\nphone=${phone}\n`);

  // 1) Test dealer profili — önce auth.users sonra profiles
  const profileEmail = `credit_test_${stamp}@example.com`;
  const dealerAuthId = await createAuthUser(profileEmail);
  const profileId = randomUUID();
  await sb("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: profileId,
      auth_user_id: dealerAuthId,
      tenant_id: BAYI_TENANT_ID,
      display_name: `Test Bayi ${stamp}`,
      role: "user",
      whatsapp_phone: phone,
      email: profileEmail,
    }),
  });
  log(`profile ${profileId} oluşturuldu`);

  // 2) bayi_dealers row — user_id linked, credit_limit=10000, balance=8000
  const dealerRows = await sb("bayi_dealers", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: BAYI_TENANT_ID,
      user_id: profileId,
      company_name: `Test Şirket ${stamp}`,
      name: `Test Şirket ${stamp}`,
      email: `test_${stamp}@example.com`,
      phone,
      balance: 8000,
      credit_limit: 10000,
      is_active: true,
    }),
  });
  const dealer = Array.isArray(dealerRows) ? dealerRows[0] : dealerRows;
  log(`dealer ${dealer.id} oluşturuldu (balance=8000, credit_limit=10000)`);

  // 3) Magic token
  const token = await makeMagicToken(profileId);
  log(`magic token üretildi\n`);

  const results = {};
  try {
    // a) total=1500 → 200 ok
    const a = placeOrder(token, 1500, "a-pass");
    log(`a) total=1500 → status ${a.status}`, a.body);
    results.a = a.status === 200 && a.body.ok === true;
    ok(results.a, "a) total=1500 → 200 OK (8000+1500=9500 < 10000)");

    // b) total=3000 → 409
    const b = placeOrder(token, 3000, "b-block");
    log(`b) total=3000 → status ${b.status}`, b.body);
    results.b = b.status === 409 && b.body.error === "credit_limit_exceeded" && Math.abs(b.body.exceeded_by - 1000) < 0.01;
    ok(results.b, "b) total=3000 → 409 credit_limit_exceeded (exceeded_by=1000)");

    // c) credit_limit = NULL → herhangi tutar geçmeli
    await sb(`bayi_dealers?id=eq.${dealer.id}`, {
      method: "PATCH",
      body: JSON.stringify({ credit_limit: null }),
    });
    const c = placeOrder(token, 50000, "c-unlimited");
    log(`c) credit_limit=NULL, total=50000 → status ${c.status}`, c.body);
    results.c = c.status === 200 && c.body.ok === true;
    ok(results.c, "c) credit_limit=NULL → limitsiz geçti");

    // d) Admin endpoint → limit=20000 (platform admin lazım — sahibi profilini bul)
    // Platform admin = role='admin' AND tenant_id IS NULL. test-identities ile yaratılmış sahip lazım.
    // Bunun yerine tenant sahibi rolü kullanalım — kendi tenant'ındaki bayi için izinli.
    // Önce bir tenant admin profili oluştur:
    const adminEmail = `credit_test_admin_${stamp}@example.com`;
    const adminAuthId = await createAuthUser(adminEmail);
    const adminProfileId = randomUUID();
    results.__adminAuthId = adminAuthId;
    await sb("profiles", {
      method: "POST",
      body: JSON.stringify({
        id: adminProfileId,
        auth_user_id: adminAuthId,
        tenant_id: BAYI_TENANT_ID,
        display_name: `Test Admin ${stamp}`,
        role: "admin",
        whatsapp_phone: `9100${stamp}`,
        email: adminEmail,
      }),
    });
    const adminToken = await makeMagicToken(adminProfileId);
    log(`admin profile ${adminProfileId} oluşturuldu, token alındı`);

    const d = setLimit(adminToken, dealer.id, 20000, "self-test d");
    log(`d) admin set limit=20000 → status ${d.status}`, d.body);
    results.d = d.status === 200 && d.body.ok === true && d.body.new_limit === 20000;
    ok(results.d, "d) admin endpoint → limit=20000");

    // e) Yeni limit ile total=5000 → 200 OK
    const e = placeOrder(token, 5000, "e-after-raise");
    log(`e) limit=20000, balance=8000, total=5000 → status ${e.status}`, e.body);
    results.e = e.status === 200 && e.body.ok === true;
    ok(results.e, "e) yeni limit=20000 ile total=5000 geçti (8000+5000=13000<20000)");

    // f) Aşımı doğrula — total=13000 → 409 (8000+13000=21000>20000)
    const f = placeOrder(token, 13000, "f-still-blocks");
    log(`f) limit=20000, total=13000 → status ${f.status}`, f.body);
    results.f = f.status === 409 && f.body.error === "credit_limit_exceeded";
    ok(results.f, "f) limit=20000 ile total=13000 → 409 (8000+13000=21000>20000)");

    // Audit log doğrula
    const audit = await sb(`bayi_credit_limit_audit?dealer_id=eq.${dealer.id}&select=*`);
    log(`\naudit kayıtları (${audit.length}):`, audit);
    results.audit = audit.length >= 1 && Number(audit[0].new_limit) === 20000;
    ok(results.audit, "audit log yazıldı");
  } finally {
    // Cleanup
    log("\n--- cleanup ---");
    await sb(`bayi_dealer_order_items?order_id=in.(select id from bayi_dealer_orders where dealer_user_id=eq.${profileId})`, { method: "DELETE" }).catch(() => {});
    await sb(`bayi_dealer_orders?dealer_user_id=eq.${profileId}`, { method: "DELETE" }).catch(() => {});
    await sb(`bayi_credit_limit_audit?dealer_id=eq.${dealer.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`bayi_dealers?id=eq.${dealer.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`magic_link_tokens?user_id=eq.${profileId}`, { method: "DELETE" }).catch(() => {});
    await sb(`profiles?id=eq.${profileId}`, { method: "DELETE" }).catch(() => {});
    await deleteAuthUser(dealerAuthId).catch(() => {});
    if (results.__adminAuthId) {
      await sb(`magic_link_tokens?user_id=eq.${results.__adminAuthId}`, { method: "DELETE" }).catch(() => {});
      await sb(`profiles?auth_user_id=eq.${results.__adminAuthId}`, { method: "DELETE" }).catch(() => {});
      await deleteAuthUser(results.__adminAuthId).catch(() => {});
    }
    delete results.__adminAuthId;
    log("temizlendi");
  }

  log("\n=== ÖZET ===");
  for (const [k, v] of Object.entries(results)) log(`${v ? "✅" : "❌"} ${k}`);
  const all = Object.values(results).every(Boolean);
  log(`\n${all ? "✅ Tüm testler geçti" : "❌ Bazı testler başarısız"}\n`);
  process.exit(all ? 0 : 1);
}

main().catch(err => {
  console.error("\n❌ TEST HATASI:", err);
  process.exit(1);
});
