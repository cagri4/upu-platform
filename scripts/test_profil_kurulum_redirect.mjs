#!/usr/bin/env node
/**
 * profil-kurulum multi-tenant kök fix — E2E self-test.
 *
 * Yapı: 7 SaaS için signup akışında OTP verify'in döndürdüğü redirect URL'ini
 * doğrular. Her SaaS için profil-kurulum-redirect.ts'in çıktısını gerçek
 * HTTP üzerinden test eder.
 *
 * Test senaryoları:
 *   1) emlak signup    → /tr/profil-kurulum  (eski URL, (emlak) group içinde)
 *   2) bayi signup     → /tr/bayi-profil
 *   3) restoran signup → /tr/restoran-profil
 *   4) market signup   → /tr/profil-kurulum-mini (shell-içi page bypass)
 *   5) otel signup     → /tr/profil-kurulum-mini
 *   6) siteyonetim     → /tr/profil-kurulum-mini
 *   7) muhasebe signup → /tr/profil-kurulum-mini (dedicated yok)
 *   8) Build/typecheck pass (separate adım, npx tsc'le)
 *   9) /api/profil/save bayi token + office_name → yoksayılır, 200
 *  10) Leak audit: /profil-kurulum-mini sayfasında emlak hardcoded yok
 *
 * Çalıştırma:
 *   1. npm run dev (ayrı terminalde)
 *   2. node scripts/test_profil_kurulum_redirect.mjs
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync as fsRead } from "node:fs";

const SUPABASE_URL = "https://eodjowwdhsircwebxcmh.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZGpvd3dkaHNpcmN3ZWJ4Y21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5MTUzNywiZXhwIjoyMDg5ODY3NTM3fQ.wyBKr9n1ut9jid3dLXP9Md7VveSzshSQA0XBto5cjtQ";
const BASE = "http://localhost:3000";

// Config'deki DEMO tenant id'leri — direkt otp_codes insert için.
const SAAS_MAPPING = {
  emlak:       { host: "estateai.upudev.nl",    tenantId: "3f3598fc-a93e-4c73-bd33-7c4217f6c089", expectedPath: "/tr/profil-kurulum" },
  bayi:        { host: "retailai.upudev.nl",    tenantId: "32f5feda-700f-44c6-a270-5bbb5a040994", expectedPath: "/tr/bayi-profil" },
  restoran:    { host: "restoranai.upudev.nl",  tenantId: "03f58dcb-b931-4dcf-bd47-a0885f9286e8", expectedPath: "/tr/restoran-profil" },
  market:      { host: "marketai.upudev.nl",    tenantId: "af1f27b0-2ec1-4423-9b93-2aa29979b73a", expectedPath: "/tr/profil-kurulum-mini" },
  otel:        { host: "hotelai.upudev.nl",     tenantId: "16871326-afef-4ba3-a079-2c5ede8fac4d", expectedPath: "/tr/profil-kurulum-mini" },
  siteyonetim: { host: "residenceai.upudev.nl", tenantId: "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e", expectedPath: "/tr/profil-kurulum-mini" },
  muhasebe:    { host: "accountai.upudev.nl",   tenantId: "31a22a5a-cf38-48b5-914d-a67bde4c1e16", expectedPath: "/tr/profil-kurulum-mini" },
};

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

async function deleteAuthUserByEmail(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) return;
  const { users } = await r.json();
  for (const u of users || []) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
  }
}

function curl(method, url, payload, extraHeaders = {}) {
  const args = ["-s", "-X", method, "-w", "\n__STATUS__:%{http_code}", "-H", "Content-Type: application/json"];
  for (const [k, v] of Object.entries(extraHeaders)) args.push("-H", `${k}: ${v}`);
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

// OTP signup simülasyonu: rate-limit + WA template send'i bypass etmek için
// otp_codes'a doğrudan satır insert edip verify endpoint'ini çağırıyoruz.
async function seedOtpCode(phone, tenantId) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await sb("otp_codes", {
    method: "POST",
    body: JSON.stringify({
      phone,
      code,
      purpose: "signup",
      tenant_id: tenantId,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }),
  });
  return code;
}

async function verifyOtp(phone, code, host) {
  return curl("POST", `${BASE}/api/auth/otp/verify`, {
    phone,
    code,
    purpose: "signup",
    locale: "tr",
  }, { Host: host });
}

async function cleanupPhone(phone) {
  // tenants kaskad CASCADE değil; manual sıralı temizlik
  const profiles = await sb(`profiles?whatsapp_phone=eq.${encodeURIComponent(phone)}&select=id,tenant_id,auth_user_id`);
  for (const p of profiles) {
    await sb(`magic_link_tokens?user_id=eq.${p.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`onboarding_state?user_id=eq.${p.id}`, { method: "DELETE" }).catch(() => {});
    await sb(`profiles?id=eq.${p.id}`, { method: "DELETE" }).catch(() => {});
    if (p.tenant_id) {
      await sb(`tenants?id=eq.${p.tenant_id}`, { method: "DELETE" }).catch(() => {});
    }
    if (p.auth_user_id) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${p.auth_user_id}`, {
        method: "DELETE",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }).catch(() => {});
    }
  }
  await sb(`otp_codes?phone=eq.${encodeURIComponent(phone)}`, { method: "DELETE" }).catch(() => {});
}

const log = (...a) => console.log(...a);
const ok = (cond, label) => log(cond ? `✅ ${label}` : `❌ ${label}`);

async function main() {
  const stamp = Date.now().toString().slice(-6);
  log(`\n=== profil-kurulum multi-tenant redirect E2E ===\nstamp=${stamp}\n`);

  const results = {};

  // Senaryolar 1-7: her SaaS için signup → redirect URL kontrolü
  let phoneIdx = 0;
  for (const [tenantKey, cfg] of Object.entries(SAAS_MAPPING)) {
    phoneIdx += 1;
    const phone = `9500${stamp}${phoneIdx}`;
    log(`\n--- ${tenantKey} (${cfg.host}) phone=${phone} ---`);

    try {
      // OTP direkt DB'ye yaz (rate-limit + WA template bypass)
      const code = await seedOtpCode(phone, cfg.tenantId);

      // Verify
      const verify = await verifyOtp(phone, code, cfg.host);
      log(`verify:`, verify);
      const actualPath = verify.body?.redirect || "";
      const passed = verify.status === 200 && actualPath === cfg.expectedPath;
      results[tenantKey] = passed;
      ok(passed, `${tenantKey} → ${cfg.expectedPath} (gerçek: ${actualPath})`);
    } finally {
      await cleanupPhone(phone).catch(() => {});
    }
  }

  // 8) Yapısal kontrol — dosya konumları doğru mu?
  let buildCheck = false;
  let buildMsg = "";
  try {
    fsRead("/home/cagr/Masaüstü/upu-platform/src/app/[locale]/profil-kurulum/page.tsx", "utf8");
    buildMsg = "eski profil-kurulum hala root-level (taşıma başarısız)";
  } catch {
    try {
      fsRead("/home/cagr/Masaüstü/upu-platform/src/app/[locale]/(emlak)/profil-kurulum/page.tsx", "utf8");
      fsRead("/home/cagr/Masaüstü/upu-platform/src/app/[locale]/profil-kurulum-mini/page.tsx", "utf8");
      fsRead("/home/cagr/Masaüstü/upu-platform/src/platform/auth/profil-kurulum-redirect.ts", "utf8");
      buildCheck = true;
    } catch (err) {
      buildMsg = `yeni dosyalar yok: ${err.message}`;
    }
  }
  results.build = buildCheck;
  ok(buildCheck, `8) yapı: (emlak)/profil-kurulum + profil-kurulum-mini + redirect util var${buildMsg ? ` — ${buildMsg}` : ""}`);

  // 9) /api/profil/save guard — bayi tenant token + body.office_name → yoksayılır
  const bayiPhone = `9501${stamp}9`;
  try {
    const code = await seedOtpCode(bayiPhone, SAAS_MAPPING.bayi.tenantId);
    await verifyOtp(bayiPhone, code, SAAS_MAPPING.bayi.host);
    // Doğrudan magic_link_tokens yarat (curl-cookie geçirmek karmaşık).
    const [profileRow] = await sb(`profiles?whatsapp_phone=eq.${bayiPhone}&select=id`);
    const profileId = profileRow?.id;
    if (!profileId) throw new Error("bayi profile yaratılamadı");

    const magicToken = randomBytes(32).toString("hex");
    await sb("magic_link_tokens", {
      method: "POST",
      body: JSON.stringify({
        user_id: profileId,
        token: magicToken,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    });

    const saveRes = curl("POST", `${BASE}/api/profil/save`, {
      token: magicToken,
      display_name: "Bayi Test",
      office_name: "ABC EMLAK",  // emlak-spec, yoksayılmalı
      location: "Bodrum",         // emlak-spec, yoksayılmalı
      experience_years: "10",     // emlak-spec, yoksayılmalı
      email: "test@example.com",
      briefing_enabled: true,
    });
    log(`bayi save:`, saveRes);

    const [profileAfter] = await sb(`profiles?id=eq.${profileId}&select=display_name,metadata`);
    const meta = profileAfter?.metadata || {};
    log(`bayi profile metadata after save:`, meta);

    results.guard =
      saveRes.status === 200 &&
      meta.office_name == null && // null veya undefined
      meta.location == null &&
      meta.experience_years == null &&
      meta.email === "test@example.com" &&
      profileAfter.display_name === "Bayi Test" &&
      saveRes.body?.saas_type === "bayi";
    ok(results.guard, "9) /api/profil/save guard: bayi'de office_name/location/experience_years yoksayıldı");
  } finally {
    await cleanupPhone(bayiPhone).catch(() => {});
  }

  // 10) Leak audit: profil-kurulum-mini sayfasında emlak hardcoded yok
  const miniContent = fsRead("/home/cagr/Masaüstü/upu-platform/src/app/[locale]/profil-kurulum-mini/page.tsx", "utf8");
  const leakKeywords = ["ABC Emlak", "Bodrum Merkez", "canemlak.com", "Çalıştığınız bölge", "Tecrübe (yıl)", "Sunumlarda imza", "office_name", "experience_years"];
  const leaks = leakKeywords.filter(k => miniContent.includes(k));
  results.leak = leaks.length === 0;
  ok(results.leak, `10) Leak audit (mini sayfa): ${leaks.length === 0 ? "temiz" : `SIZINTI: ${leaks.join(", ")}`}`);

  log("\n=== ÖZET ===");
  const orderedKeys = ["emlak", "bayi", "restoran", "market", "otel", "siteyonetim", "muhasebe", "build", "guard", "leak"];
  for (const k of orderedKeys) log(`${results[k] ? "✅" : "❌"} ${k}`);
  const all = orderedKeys.every(k => results[k]);
  log(`\n${all ? "✅ Tüm testler geçti" : "❌ Bazı testler başarısız"}\n`);
  process.exit(all ? 0 : 1);
}

main().catch((err) => {
  console.error("\n❌ TEST HATASI:", err);
  process.exit(1);
});
