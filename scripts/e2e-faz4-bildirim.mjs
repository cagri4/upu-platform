#!/usr/bin/env node
/**
 * Faz 4 E2E — WA bildirim olay zinciri doğrulaması (production, mock send).
 *
 * Senaryo (brief şart 5):
 *   bayi sipariş ver → dağıtıcıya 'Yeni sipariş' → dağıtıcı onayla →
 *   bayiye 'Sipariş onaylandı' (+fatura) → kargoya ver → bayiye
 *   'Kargonuz çıktı' + takip linki
 *
 * Test identity: 31600000001 (sabit OTP 112233, bayi tenant).
 * Aynı kullanıcı role=user → hem bayi hem dağıtıcı API'lerine yetkili
 * (tenant sahibi), zincirin iki ucunu tek session'la oynatabiliyoruz.
 *
 * Setup: test kullanıcısının bayi_dealers kaydı yoksa Logo mock bayisine
 * user_id bağlanır (test tenant'ı, Çağrı brief onayı kapsamında).
 *
 * Çalıştırma: node scripts/e2e-faz4-bildirim.mjs
 * (.env.local'den SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL okur)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const BASE = "https://retailai.upudev.nl";
const PHONE = "31600000001";
const OTP = "112233";

// ── .env.local parse ────────────────────────────────────────────────────
const env = {};
for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const pass = (n, d = "") => { results.push({ n, ok: true, d }); console.log(`  ✓ ${n}${d ? " — " + d : ""}`); };
const fail = (n, d = "") => { results.push({ n, ok: false, d }); console.log(`  ✗ ${n}${d ? " — " + d : ""}`); };

let cookie = "";
async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(opts.headers || {}),
    },
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const c of setCookie) {
    if (c.startsWith("upu_session=")) cookie = c.split(";")[0];
  }
  let json = null;
  try { json = await res.json(); } catch { /* redirect vb. */ }
  return { status: res.status, json };
}

async function notifCount(profileId, type, sinceIso) {
  const { data } = await sb
    .from("notifications")
    .select("id, channels_sent, payload, title")
    .eq("user_id", profileId)
    .eq("type", type)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  return data ?? [];
}

(async () => {
  console.log("Faz 4 E2E — bildirim zinciri\n");
  const startIso = new Date().toISOString();

  // 1) OTP login
  let r = await api("/api/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE, purpose: "login", locale: "tr" }),
  });
  if (r.status !== 200) { fail("OTP request", JSON.stringify(r.json)); process.exit(1); }
  r = await api("/api/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE, code: OTP, purpose: "login", locale: "tr" }),
  });
  if (r.status !== 200 || !cookie) { fail("OTP verify/cookie", JSON.stringify(r.json)); process.exit(1); }
  pass("OTP login", `cookie alındı`);

  // 2) Profil + tenant + dealer çöz (service-role)
  const me = await api("/api/bayi/me");
  if (me.status !== 200) { fail("/api/bayi/me", String(me.status)); process.exit(1); }
  const tenantId = me.json.tenant.id;
  const profileId = (
    await sb.from("profiles").select("id").eq("whatsapp_phone", PHONE).eq("tenant_id", tenantId).limit(1).maybeSingle()
  ).data?.id;
  if (!profileId) { fail("profile lookup"); process.exit(1); }
  pass("kimlik", `tenant=${tenantId.slice(0, 8)} profile=${profileId.slice(0, 8)}`);

  // 3) Dealer bağla (yoksa) — mock Logo bayisine user_id ata
  if (!me.json.dealer) {
    const { data: candidate } = await sb
      .from("bayi_dealers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .is("user_id", null)
      .limit(1)
      .maybeSingle();
    if (!candidate) { fail("setup: boş dealer yok"); process.exit(1); }
    // auth uid'yi cookie'deki uid ile değil profile id ile bağla — _auth
    // requireAuth.userId döner; profiles.id ile aynı (cookie uid=profile.id)
    await sb.from("bayi_dealers").update({ user_id: profileId }).eq("id", candidate.id);
    pass("setup: dealer bağlandı", candidate.name);
  } else {
    pass("setup: dealer mevcut", me.json.dealer.name);
  }

  // 4) Katalogdan ürün al + sipariş ver
  const kat = await api("/api/bayi/katalog?status=active&pageSize=3");
  const product = kat.json?.items?.[0];
  if (!product) { fail("katalog boş"); process.exit(1); }
  const order = await api("/api/bayi/siparis-olustur", {
    method: "POST",
    body: JSON.stringify({
      lines: [{ product_id: product.id, quantity: 12 }],
      payment_method: "open_account",
      notes: "Faz 4 E2E test siparişi",
    }),
  });
  if (order.status !== 200 || !order.json?.orderId) {
    fail("sipariş oluştur", JSON.stringify(order.json)); process.exit(1);
  }
  const orderId = order.json.orderId;
  pass("sipariş oluştu", `#${order.json.orderNumber} (${product.name} × 12)`);

  // 5) created event'leri: bayi_siparis_alindi + dagitici_yeni_siparis
  await new Promise((res) => setTimeout(res, 1500));
  const alindi = await notifCount(profileId, "bayi_siparis_alindi", startIso);
  const yeni = await notifCount(profileId, "dagitici_yeni_siparis", startIso);
  alindi.length > 0 && alindi[0].channels_sent.includes("wa-mock")
    ? pass("bayi_siparis_alindi", `wa-mock ✓ "${alindi[0].title}"`)
    : fail("bayi_siparis_alindi", JSON.stringify(alindi[0]?.channels_sent));
  yeni.length > 0 && yeni[0].channels_sent.includes("wa-mock")
    ? pass("dagitici_yeni_siparis", `wa-mock ✓ "${yeni[0].title}"`)
    : fail("dagitici_yeni_siparis", JSON.stringify(yeni[0]?.channels_sent));

  // 6) Dağıtıcı onayla
  const onay = await api(`/api/dagitici/siparisler/${orderId}/onayla`, { method: "POST" });
  onay.status === 200 ? pass("dağıtıcı onayladı") : fail("onay", JSON.stringify(onay.json));

  await new Promise((res) => setTimeout(res, 1500));
  const onaylandi = await notifCount(profileId, "bayi_siparis_onaylandi", startIso);
  onaylandi.length > 0
    ? pass("bayi_siparis_onaylandi", `wa-mock ${onaylandi[0].channels_sent.includes("wa-mock") ? "✓" : "✗"}`)
    : fail("bayi_siparis_onaylandi", "bildirim yok");
  const fatura = await notifCount(profileId, "bayi_fatura_kesildi", startIso);
  fatura.length > 0
    ? pass("bayi_fatura_kesildi", fatura[0].payload?.invoice_no || "")
    : fail("bayi_fatura_kesildi", "bildirim yok");

  // 7) Kargoya ver
  const kargo = await api(`/api/dagitici/siparisler/${orderId}/kargo`, {
    method: "POST",
    body: JSON.stringify({ carrier: "aras" }),
  });
  kargo.status === 200 && kargo.json?.trackingNo
    ? pass("kargoya verildi", `${kargo.json.carrier} ${kargo.json.trackingNo}${kargo.json.mocked ? " (mock)" : ""}`)
    : fail("kargo", JSON.stringify(kargo.json));

  await new Promise((res) => setTimeout(res, 1500));
  const cikti = await notifCount(profileId, "bayi_kargo_cikti", startIso);
  cikti.length > 0 && cikti[0].payload?.tracking_no
    ? pass("bayi_kargo_cikti", `takip=${cikti[0].payload.tracking_no} url=${cikti[0].payload.tracking_url ? "✓" : "✗"}`)
    : fail("bayi_kargo_cikti", "bildirim/tracking yok");

  // ── Özet ─────────────────────────────────────────────────────────────
  const ok = results.filter((x) => x.ok).length;
  console.log(`\n${ok}/${results.length} adım geçti`);
  process.exit(ok === results.length ? 0 : 1);
})();
