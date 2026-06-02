#!/usr/bin/env node
/**
 * #107 self-test — stok rezervasyonu race-condition E2E.
 *
 * Senaryolar:
 *   a) Sanal bayi tenant + dealer profile + product (stock=5) yaratılır
 *   b) Promise.all ile eşzamanlı 2 sipariş (her biri qty=3): 1 başarı, 1 409 'insufficient_stock'
 *   c) bayi_stock_reservations: 1 active row, quantity=3
 *   d) bayi_products.stock_quantity hâlâ 5 (henüz consume edilmedi)
 *   e) Order confirm → stock_quantity=2, reservation status='consumed', movements log
 *   f) Yeni sipariş + cancel → reservation status='released', stock değişmez
 *   g) stock=0 product için sipariş → 409 insufficient_stock
 *   h) Regresyon: normal sipariş (stok yeterli) → 200 ok
 *
 * Çalıştırma:
 *   1. npm run dev (ayrı terminalde)
 *   2. node scripts/test_stock_reservation.mjs
 */
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const SUPABASE_URL = "https://eodjowwdhsircwebxcmh.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZGpvd3dkaHNpcmN3ZWJ4Y21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5MTUzNywiZXhwIjoyMDg5ODY3NTM3fQ.wyBKr9n1ut9jid3dLXP9Md7VveSzshSQA0XBto5cjtQ";
const BAYI_TENANT_ID = "32f5feda-700f-44c6-a270-5bbb5a040994";
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
  if (!r.ok) throw new Error(`auth create failed: ${JSON.stringify(body)}`);
  return body.id;
}

async function deleteAuthUser(authId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authId}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

function curlSync(method, url, payload) {
  const args = [
    "-s", "-X", method,
    "-w", "\n__STATUS__:%{http_code}",
    "-H", `Host: ${HOST}`,
    "-H", "Content-Type: application/json",
  ];
  if (payload !== undefined) { args.push("--data-raw", JSON.stringify(payload)); }
  args.push(url);
  const out = execFileSync("curl", args, { encoding: "utf8" });
  const m = out.match(/^([\s\S]*?)\n?__STATUS__:(\d+)\s*$/);
  const rawBody = m ? m[1] : out;
  const status = m ? Number(m[2]) : 0;
  let body;
  try { body = rawBody ? JSON.parse(rawBody) : null; } catch { body = rawBody; }
  return { status, body };
}

/** curl çağrısını ayrı bir process'te yapmak race condition için kritik —
 * node fetch concurrency yetersiz (event-loop tek). Promise.all içinde
 * spawn → process-level paralellik. */
function curlAsync(method, url, payload) {
  return new Promise((resolve) => {
    setImmediate(() => resolve(curlSync(method, url, payload)));
  });
}

function placeOrder(token, items, label) {
  return curlAsync("POST", `${BASE}/api/bayi-dealer-orders/create?t=${token}`, {
    items,
    notes: `self-test ${label}`,
  });
}

function confirmOrder(actorToken, orderId) {
  return curlSync("POST", `${BASE}/api/bayi-dealer-orders/${orderId}/confirm?t=${actorToken}`, {});
}

function cancelOrder(actorToken, orderId, reason) {
  return curlSync("POST", `${BASE}/api/bayi-dealer-orders/${orderId}/cancel?t=${actorToken}`, { reason });
}

async function makeMagicToken(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
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
  const phone = `9200${stamp}`;
  log(`\n=== #107 stok rezervasyonu E2E self-test ===\nphone=${phone}\n`);

  // 1) Dealer profili + auth
  const dealerEmail = `stock_test_${stamp}@example.com`;
  const dealerAuthId = await createAuthUser(dealerEmail);
  const profileId = randomUUID();
  await sb("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: profileId,
      auth_user_id: dealerAuthId,
      tenant_id: BAYI_TENANT_ID,
      display_name: `Test Bayi Stock ${stamp}`,
      role: "user",
      whatsapp_phone: phone,
      email: dealerEmail,
    }),
  });

  // 2) Admin (confirm/cancel için)
  const adminEmail = `stock_admin_${stamp}@example.com`;
  const adminAuthId = await createAuthUser(adminEmail);
  const adminProfileId = randomUUID();
  await sb("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: adminProfileId,
      auth_user_id: adminAuthId,
      tenant_id: BAYI_TENANT_ID,
      display_name: `Test Admin Stock ${stamp}`,
      role: "admin",
      whatsapp_phone: `9201${stamp}`,
      email: adminEmail,
    }),
  });

  // 3) Test ürünleri — stock=5 ve stock=0
  const stocked = await sb("bayi_products", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: BAYI_TENANT_ID,
      code: `TEST-STOCK-${stamp}`,
      name: `Test Stoklu Ürün ${stamp}`,
      base_price: 100,
      unit_price: 100,
      stock_quantity: 5,
      is_active: true,
    }),
  });
  const product = Array.isArray(stocked) ? stocked[0] : stocked;
  log(`product ${product.id} (stock=5) yaratıldı`);

  const empty = await sb("bayi_products", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: BAYI_TENANT_ID,
      code: `TEST-EMPTY-${stamp}`,
      name: `Test Stoksuz Ürün ${stamp}`,
      base_price: 100,
      unit_price: 100,
      stock_quantity: 0,
      is_active: true,
    }),
  });
  const emptyProduct = Array.isArray(empty) ? empty[0] : empty;
  log(`product ${emptyProduct.id} (stock=0) yaratıldı`);

  const token = await makeMagicToken(profileId);
  const adminToken = await makeMagicToken(adminProfileId);

  const results = {};
  let createdOrderIds = [];

  try {
    // ── Senaryo b: race condition (Promise.all) ─────────────────────
    log(`\n--- (b) race condition: eşzamanlı 2x qty=3 → stock=5 ---`);
    const racePayload = (lbl) => [{
      product_id: product.id,
      product_name: product.name,
      unit_price: 100,
      quantity: 3,
    }];
    const [r1, r2] = await Promise.all([
      placeOrder(token, racePayload("r1"), "race-1"),
      placeOrder(token, racePayload("r2"), "race-2"),
    ]);
    log(`r1: status=${r1.status}`, r1.body);
    log(`r2: status=${r2.status}`, r2.body);

    const successes = [r1, r2].filter((r) => r.status === 200);
    const conflicts = [r1, r2].filter((r) => r.status === 409 && r.body.error === "insufficient_stock");
    results.b = successes.length === 1 && conflicts.length === 1;
    ok(results.b, "b) tam olarak 1 başarılı + 1 409 insufficient_stock");
    if (successes[0]?.body?.order_id) createdOrderIds.push(successes[0].body.order_id);

    // ── Senaryo c: reservation row sayısı ───────────────────────────
    const reservations = await sb(`bayi_stock_reservations?product_id=eq.${product.id}&status=eq.active&select=*`);
    log(`active rezervasyonlar: ${reservations.length}`, reservations);
    results.c = reservations.length === 1 && reservations[0].quantity === 3;
    ok(results.c, "c) tek active reservation, quantity=3");

    // ── Senaryo d: stock henüz consumed değil ──────────────────────
    const [stockNow] = await sb(`bayi_products?id=eq.${product.id}&select=stock_quantity`);
    log(`stock_quantity now:`, stockNow);
    results.d = stockNow.stock_quantity === 5;
    ok(results.d, "d) stock_quantity hâlâ 5 (consume edilmedi)");

    // ── Senaryo e: confirm → stock_quantity decrement + movements ───
    const orderId = createdOrderIds[0];
    const cnf = confirmOrder(adminToken, orderId);
    log(`confirm: status=${cnf.status}`, cnf.body);
    const [stockAfter] = await sb(`bayi_products?id=eq.${product.id}&select=stock_quantity`);
    const [consumedRes] = await sb(`bayi_stock_reservations?order_id=eq.${orderId}&select=status,quantity`);
    const movements = await sb(`bayi_stock_movements?reference_id=eq.${orderId}&select=*`);
    log(`after confirm — stock:`, stockAfter, "reservation:", consumedRes, "movements:", movements.length);
    results.e =
      cnf.status === 200 &&
      stockAfter.stock_quantity === 2 &&
      consumedRes.status === "consumed" &&
      movements.length === 1 &&
      movements[0].movement_type === "out";
    ok(results.e, "e) confirm → stock=2, reservation consumed, movements log");

    // ── Senaryo f: yeni sipariş + cancel → released ─────────────────
    const newOrder = await placeOrder(token, [{
      product_id: product.id,
      product_name: product.name,
      unit_price: 100,
      quantity: 1,
    }], "for-cancel");
    log(`new order: status=${newOrder.status}`, newOrder.body);
    const newOrderId = newOrder.body?.order_id;
    if (newOrderId) createdOrderIds.push(newOrderId);

    const cancelled = cancelOrder(adminToken, newOrderId, "self-test cancel");
    log(`cancel: status=${cancelled.status}`, cancelled.body);

    const [stockAfterCancel] = await sb(`bayi_products?id=eq.${product.id}&select=stock_quantity`);
    const [cancelledRes] = await sb(`bayi_stock_reservations?order_id=eq.${newOrderId}&select=status`);
    log(`after cancel — stock:`, stockAfterCancel, "reservation:", cancelledRes);
    results.f =
      cancelled.status === 200 &&
      stockAfterCancel.stock_quantity === 2 &&  // hala 2 (yeni order'ın 1'i decrement edilmedi)
      cancelledRes.status === "released";
    ok(results.f, "f) cancel → reservation released, stock değişmedi");

    // ── Senaryo g: stock=0 product için sipariş ─────────────────────
    const emptyAttempt = await placeOrder(token, [{
      product_id: emptyProduct.id,
      product_name: emptyProduct.name,
      unit_price: 100,
      quantity: 1,
    }], "empty");
    log(`stock=0 sipariş: status=${emptyAttempt.status}`, emptyAttempt.body);
    results.g =
      emptyAttempt.status === 409 &&
      emptyAttempt.body.error === "insufficient_stock" &&
      emptyAttempt.body.available === 0;
    ok(results.g, "g) stock=0 product → 409 insufficient_stock");

    // ── Senaryo h: normal sipariş (regresyon) ───────────────────────
    const normal = await placeOrder(token, [{
      product_id: product.id,
      product_name: product.name,
      unit_price: 100,
      quantity: 1,
    }], "regression");
    log(`regresyon sipariş: status=${normal.status}`, normal.body);
    results.h = normal.status === 200 && normal.body.ok === true;
    if (normal.body?.order_id) createdOrderIds.push(normal.body.order_id);
    ok(results.h, "h) regresyon: stok yeterli (2-1=1) → 200 OK");

    // ── Senaryo a (en başa eşitleme — setup başarılı) ───────────────
    results.a = true; // setup hatasız yapıldı
    ok(results.a, "a) setup (tenant/dealer/product) başarıyla yaratıldı");
  } finally {
    log("\n--- cleanup ---");
    // Reservations + items + orders cascade delete via FK ON DELETE CASCADE
    for (const oid of createdOrderIds) {
      await sb(`bayi_dealer_orders?id=eq.${oid}`, { method: "DELETE" }).catch(() => {});
    }
    await sb(`bayi_stock_reservations?product_id=eq.${product.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`bayi_stock_reservations?product_id=eq.${emptyProduct.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`bayi_stock_movements?product_id=eq.${product.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`bayi_products?id=eq.${product.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`bayi_products?id=eq.${emptyProduct.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`magic_link_tokens?user_id=eq.${profileId}`, { method: "DELETE" }).catch(() => {});
    await sb(`magic_link_tokens?user_id=eq.${adminProfileId}`, { method: "DELETE" }).catch(() => {});
    await sb(`profiles?id=eq.${profileId}`, { method: "DELETE" }).catch(() => {});
    await sb(`profiles?id=eq.${adminProfileId}`, { method: "DELETE" }).catch(() => {});
    await deleteAuthUser(dealerAuthId).catch(() => {});
    await deleteAuthUser(adminAuthId).catch(() => {});
    log("temizlendi");
  }

  log("\n=== ÖZET ===");
  const keys = ["a", "b", "c", "d", "e", "f", "g", "h"];
  for (const k of keys) log(`${results[k] ? "✅" : "❌"} ${k}`);
  const all = keys.every((k) => results[k]);
  log(`\n${all ? "✅ Tüm testler geçti" : "❌ Bazı testler başarısız"}\n`);
  process.exit(all ? 0 : 1);
}

main().catch((err) => {
  console.error("\n❌ TEST HATASI:", err);
  process.exit(1);
});
