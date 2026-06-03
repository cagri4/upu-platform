#!/usr/bin/env node
/**
 * #109 self-test — bayi-spesifik ürün görünürlüğü E2E.
 *
 * Senaryolar:
 *   a) Setup: 2 dealer + 3 product (P1 herkese görünür, P2 sadece dealer1'e,
 *      P3 ikisine de gizli)
 *   b) Dealer1 /api/urunler/list → P1 + P2 görür, P3 görmez
 *   c) Dealer2 /api/urunler/list → P1 görür, P2 + P3 görmez
 *   d) Admin /api/urunler/list → 3 ürünün tümünü görür (internal role)
 *   e) Dealer2 direkt sipariş (bypass attempt) — P2 product_id ile → 403
 *      product_not_available
 *   f) Admin endpoint GET → dealer2 için hidden_count=2, rows[].visible map
 *      doğru
 *   g) Admin endpoint POST → dealer2'ye P2'yi tekrar göster (visible=true)
 *      → hidden satırı silinmiş, dealer2 listede P1+P2 görür
 *   h) Admin endpoint POST → dealer1'e P1'i gizle, regresyon olmadığı
 *      doğrulanır (dealer2 etkilenmez)
 *
 * Çalıştırma:
 *   1. npm run dev (ayrı terminalde)
 *   2. node scripts/test_product_visibility.mjs
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
  if (!r.ok) throw new Error(`auth create: ${JSON.stringify(body)}`);
  return body.id;
}

async function deleteAuthUser(authId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authId}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

function curl(method, url, payload) {
  const args = ["-s", "-X", method, "-w", "\n__STATUS__:%{http_code}", "-H", `Host: ${HOST}`, "-H", "Content-Type: application/json"];
  if (payload !== undefined) args.push("--data-raw", JSON.stringify(payload));
  args.push(url);
  const out = execFileSync("curl", args, { encoding: "utf8" });
  const m = out.match(/^([\s\S]*?)\n?__STATUS__:(\d+)\s*$/);
  const rawBody = m ? m[1] : out;
  const status = m ? Number(m[2]) : 0;
  let body;
  try { body = rawBody ? JSON.parse(rawBody) : null; } catch { body = rawBody; }
  return { status, body };
}

async function makeMagicToken(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await sb("magic_link_tokens", { method: "POST", body: JSON.stringify({ user_id: userId, token, expires_at: expiresAt }) });
  return token;
}

const log = (...a) => console.log(...a);
const ok = (cond, label) => log(cond ? `✅ ${label}` : `❌ ${label}`);

async function main() {
  const stamp = Date.now().toString().slice(-6);
  log(`\n=== #109 ürün görünürlüğü E2E self-test ===\nstamp=${stamp}\n`);

  // Dealer1 profil + auth + bayi_dealers
  const d1Email = `vis_d1_${stamp}@example.com`;
  const d1AuthId = await createAuthUser(d1Email);
  const d1ProfileId = randomUUID();
  await sb("profiles", { method: "POST", body: JSON.stringify({
    id: d1ProfileId, auth_user_id: d1AuthId, tenant_id: BAYI_TENANT_ID,
    display_name: `Vis D1 ${stamp}`, role: "user", whatsapp_phone: `9300${stamp}`, email: d1Email,
  })});
  const d1Rows = await sb("bayi_dealers", { method: "POST", body: JSON.stringify({
    tenant_id: BAYI_TENANT_ID, user_id: d1ProfileId,
    company_name: `Vis Firma D1 ${stamp}`, name: `Vis Firma D1 ${stamp}`,
    email: d1Email, phone: `9300${stamp}`, balance: 0, is_active: true,
  })});
  const dealer1 = Array.isArray(d1Rows) ? d1Rows[0] : d1Rows;

  // Dealer2 profil + auth + bayi_dealers
  const d2Email = `vis_d2_${stamp}@example.com`;
  const d2AuthId = await createAuthUser(d2Email);
  const d2ProfileId = randomUUID();
  await sb("profiles", { method: "POST", body: JSON.stringify({
    id: d2ProfileId, auth_user_id: d2AuthId, tenant_id: BAYI_TENANT_ID,
    display_name: `Vis D2 ${stamp}`, role: "user", whatsapp_phone: `9301${stamp}`, email: d2Email,
  })});
  const d2Rows = await sb("bayi_dealers", { method: "POST", body: JSON.stringify({
    tenant_id: BAYI_TENANT_ID, user_id: d2ProfileId,
    company_name: `Vis Firma D2 ${stamp}`, name: `Vis Firma D2 ${stamp}`,
    email: d2Email, phone: `9301${stamp}`, balance: 0, is_active: true,
  })});
  const dealer2 = Array.isArray(d2Rows) ? d2Rows[0] : d2Rows;

  // Admin (internal — tüm ürünleri görür + visibility yönetimi yapar)
  const adminEmail = `vis_admin_${stamp}@example.com`;
  const adminAuthId = await createAuthUser(adminEmail);
  const adminProfileId = randomUUID();
  await sb("profiles", { method: "POST", body: JSON.stringify({
    id: adminProfileId, auth_user_id: adminAuthId, tenant_id: BAYI_TENANT_ID,
    display_name: `Vis Admin ${stamp}`, role: "admin", whatsapp_phone: `9302${stamp}`, email: adminEmail,
  })});

  // 3 ürün — kod prefix testin sonunda cleanup için kullanılır
  const productData = [];
  for (let i = 1; i <= 3; i++) {
    const rows = await sb("bayi_products", { method: "POST", body: JSON.stringify({
      tenant_id: BAYI_TENANT_ID,
      code: `VIS-TEST-${stamp}-P${i}`,
      name: `Vis Test Ürün ${stamp} P${i}`,
      base_price: 100 * i, unit_price: 100 * i, stock_quantity: 50, is_active: true,
    })});
    productData.push(Array.isArray(rows) ? rows[0] : rows);
  }
  const [P1, P2, P3] = productData;
  log(`P1=${P1.id.slice(0,8)} P2=${P2.id.slice(0,8)} P3=${P3.id.slice(0,8)}\n`);

  // Initial visibility:
  //   D1: P1, P2 visible; P3 hidden
  //   D2: P1 visible; P2, P3 hidden
  await sb("bayi_product_visibility", { method: "POST", body: JSON.stringify([
    { tenant_id: BAYI_TENANT_ID, dealer_id: dealer1.id, product_id: P3.id, visible: false, reason: "test-d1-P3" },
    { tenant_id: BAYI_TENANT_ID, dealer_id: dealer2.id, product_id: P2.id, visible: false, reason: "test-d2-P2" },
    { tenant_id: BAYI_TENANT_ID, dealer_id: dealer2.id, product_id: P3.id, visible: false, reason: "test-d2-P3" },
  ])});

  const d1Token = await makeMagicToken(d1ProfileId);
  const d2Token = await makeMagicToken(d2ProfileId);
  const adminToken = await makeMagicToken(adminProfileId);

  function pageIdsForToken(token) {
    // pageSize=200 + name filter ile sadece test ürünlerini topla
    const q = encodeURIComponent(`Vis Test Ürün ${stamp}`);
    const r = curl("GET", `${BASE}/api/urunler/list?t=${token}&q=${q}&pageSize=100`);
    return { status: r.status, ids: ((r.body?.rows) || []).map((x) => x.id), total: r.body?.total };
  }

  const results = {};
  const createdHiddenIds = [];

  try {
    // a) setup OK (yukarıda hatasız tamamlandı)
    results.a = true;
    ok(results.a, "a) setup tamamlandı");

    // b) Dealer1 listesi → P1, P2 (P3 yok)
    const r1 = pageIdsForToken(d1Token);
    log(`Dealer1 görünür ürünler:`, r1);
    results.b =
      r1.status === 200 &&
      r1.ids.includes(P1.id) &&
      r1.ids.includes(P2.id) &&
      !r1.ids.includes(P3.id);
    ok(results.b, "b) Dealer1 → P1+P2 görür, P3 gizli");

    // c) Dealer2 listesi → P1 (P2, P3 yok)
    const r2 = pageIdsForToken(d2Token);
    log(`Dealer2 görünür ürünler:`, r2);
    results.c =
      r2.status === 200 &&
      r2.ids.includes(P1.id) &&
      !r2.ids.includes(P2.id) &&
      !r2.ids.includes(P3.id);
    ok(results.c, "c) Dealer2 → sadece P1");

    // d) Admin → 3 ürün de
    const ra = pageIdsForToken(adminToken);
    log(`Admin görünür ürünler:`, ra);
    results.d =
      ra.status === 200 &&
      ra.ids.includes(P1.id) &&
      ra.ids.includes(P2.id) &&
      ra.ids.includes(P3.id);
    ok(results.d, "d) Admin (internal) → tüm 3 ürünü görür");

    // e) Dealer2 direkt P2 ile sipariş — 403 bekleniyor
    const bypass = curl("POST", `${BASE}/api/bayi-dealer-orders/create?t=${d2Token}`, {
      items: [{ product_id: P2.id, product_name: P2.name, unit_price: 200, quantity: 1 }],
      notes: "bypass attempt",
    });
    log(`Dealer2 bypass sipariş status=${bypass.status}`, bypass.body);
    results.e =
      bypass.status === 403 &&
      bypass.body.error === "product_not_available" &&
      bypass.body.product_id === P2.id;
    ok(results.e, "e) Dealer2 bypass attempt → 403 product_not_available");

    // f) Admin GET endpoint → dealer2 için doğru visibility map
    const getRes = curl("GET", `${BASE}/api/admin/bayi-dealers/${dealer2.id}/product-visibility?t=${adminToken}`);
    log(`Admin GET dealer2 hidden_count=${getRes.body?.hidden_count}`);
    const p2Row = (getRes.body?.rows || []).find((r) => r.id === P2.id);
    const p3Row = (getRes.body?.rows || []).find((r) => r.id === P3.id);
    const p1Row = (getRes.body?.rows || []).find((r) => r.id === P1.id);
    results.f =
      getRes.status === 200 &&
      getRes.body.hidden_count >= 2 &&
      p1Row?.visible === true &&
      p2Row?.visible === false &&
      p3Row?.visible === false;
    ok(results.f, "f) Admin GET → P1 visible, P2/P3 hidden");

    // g) Admin POST → dealer2'ye P2'yi tekrar göster
    const postRes = curl("POST", `${BASE}/api/admin/bayi-dealers/${dealer2.id}/product-visibility?t=${adminToken}`, {
      changes: [{ product_id: P2.id, visible: true }],
      reason: "test g show p2",
    });
    log(`Admin POST sonuç:`, postRes.body);
    const r2After = pageIdsForToken(d2Token);
    log(`Dealer2 listesi (after show P2):`, r2After);
    results.g =
      postRes.status === 200 &&
      postRes.body.shown_deleted === 1 &&
      r2After.ids.includes(P1.id) &&
      r2After.ids.includes(P2.id) &&
      !r2After.ids.includes(P3.id);
    ok(results.g, "g) POST visible=true → satır silindi, dealer2 P2 görür");

    // h) Admin POST → dealer1'e P1'i gizle, dealer2 etkilenmez
    const postH = curl("POST", `${BASE}/api/admin/bayi-dealers/${dealer1.id}/product-visibility?t=${adminToken}`, {
      changes: [{ product_id: P1.id, visible: false }],
      reason: "test h hide p1 for d1",
    });
    log(`Hide P1 for D1:`, postH.body);
    const r1After = pageIdsForToken(d1Token);
    const r2NoChange = pageIdsForToken(d2Token);
    log(`Dealer1 after:`, r1After);
    log(`Dealer2 after (no change):`, r2NoChange);
    results.h =
      postH.status === 200 &&
      !r1After.ids.includes(P1.id) &&
      r1After.ids.includes(P2.id) && // d1 hala P2 görür
      r2NoChange.ids.includes(P1.id) && // d2 hala P1 görür (regression)
      r2NoChange.ids.includes(P2.id);
    ok(results.h, "h) D1'e P1 gizle → D2 etkilenmez (cross-dealer izolasyon)");
  } finally {
    log("\n--- cleanup ---");
    await sb(`bayi_product_visibility?dealer_id=eq.${dealer1.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`bayi_product_visibility?dealer_id=eq.${dealer2.id}`, { method: "DELETE" }).catch(() => {});
    for (const p of productData) {
      await sb(`bayi_products?id=eq.${p.id}`, { method: "DELETE" }).catch(() => {});
    }
    await sb(`bayi_dealers?id=eq.${dealer1.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`bayi_dealers?id=eq.${dealer2.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`magic_link_tokens?user_id=eq.${d1ProfileId}`, { method: "DELETE" }).catch(() => {});
    await sb(`magic_link_tokens?user_id=eq.${d2ProfileId}`, { method: "DELETE" }).catch(() => {});
    await sb(`magic_link_tokens?user_id=eq.${adminProfileId}`, { method: "DELETE" }).catch(() => {});
    await sb(`profiles?id=eq.${d1ProfileId}`, { method: "DELETE" }).catch(() => {});
    await sb(`profiles?id=eq.${d2ProfileId}`, { method: "DELETE" }).catch(() => {});
    await sb(`profiles?id=eq.${adminProfileId}`, { method: "DELETE" }).catch(() => {});
    await deleteAuthUser(d1AuthId).catch(() => {});
    await deleteAuthUser(d2AuthId).catch(() => {});
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
