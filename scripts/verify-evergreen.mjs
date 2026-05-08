#!/usr/bin/env node
/**
 * Production /api/panel/evergreen verify — multi-tenant fix sonrası.
 *
 * 1) Bir test user_id bul (whatsapp_phone'u 2+ profile sahip varsa onu seç,
 *    multi-tenant scenario'sunu test etmek için)
 * 2) ?uid=<user_id> ile redirect testi → /tr/panel?t=<fresh> beklenir
 * 3) ?phone=<duplicate_phone> ile legacy fallback → first profile fresh token
 * 4) Token DB'ye yazıldı mı?
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "..", ".env.production.local"), "utf8");
const env = {};
envText.split("\n").forEach(line => {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
});

const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = "https://estateai.upudev.nl";

const sb = createClient(SB_URL, SVC, { auth: { persistSession: false } });

console.log(`\n🔌 Test: ${APP_URL}/api/panel/evergreen\n`);

// 1) Multi-tenant kullanıcı bul (aynı phone'a 2+ profil)
console.log("1️⃣  Multi-tenant kullanıcı arama (aynı phone'a 2+ profil):");
const { data: profiles } = await sb
  .from("profiles")
  .select("id, whatsapp_phone, tenant_id, display_name");

const phoneGroups = {};
for (const p of (profiles || [])) {
  if (!p.whatsapp_phone) continue;
  if (!phoneGroups[p.whatsapp_phone]) phoneGroups[p.whatsapp_phone] = [];
  phoneGroups[p.whatsapp_phone].push(p);
}

const dupPhones = Object.entries(phoneGroups).filter(([, arr]) => arr.length > 1);
console.log(`   Toplam profil: ${profiles?.length ?? 0}`);
console.log(`   Aynı phone'a 2+ profil: ${dupPhones.length}`);
if (dupPhones.length > 0) {
  for (const [phone, arr] of dupPhones.slice(0, 3)) {
    console.log(`   • ${phone}: ${arr.length} profil (${arr.map(p => p.tenant_id?.slice(0,8) || "no-tenant").join(", ")})`);
  }
}

// 2) Test uid (multi-tenant varsa onu seç, yoksa rastgele bir profil)
const testProfile = dupPhones.length > 0 ? dupPhones[0][1][0] : (profiles && profiles[0]);
if (!testProfile) {
  console.log("\n❌ Hiç profil yok, test atlanıyor.");
  process.exit(0);
}

console.log(`\n2️⃣  Test profil: id=${testProfile.id} phone=${testProfile.whatsapp_phone}`);

// 3) Pre-test: mevcut token sayısı
const { count: tokensBefore } = await sb
  .from("magic_link_tokens")
  .select("*", { count: "exact", head: true })
  .eq("user_id", testProfile.id);
console.log(`   Token sayısı (öncesi): ${tokensBefore ?? 0}`);

// 4) ?uid=... → redirect bekle
console.log(`\n3️⃣  ?uid=<id> redirect testi:`);
const r1 = await fetch(`${APP_URL}/api/panel/evergreen?uid=${encodeURIComponent(testProfile.id)}`, { redirect: "manual" });
console.log(`   HTTP status: ${r1.status} ${r1.statusText}`);
const loc1 = r1.headers.get("location");
console.log(`   Location: ${loc1}`);
if (r1.status === 307 || r1.status === 302) {
  if (loc1 && loc1.includes("/tr/panel?t=")) {
    console.log("   ✅ /tr/panel'e fresh token ile redirect — uid lookup ÇALIŞIYOR");
  } else if (loc1 && loc1.endsWith("/tr")) {
    console.log("   ❌ /tr landing'e redirect — uid lookup başarısız (deploy henüz tamamlanmadı?)");
  } else {
    console.log(`   ⚠️  Beklenmeyen redirect: ${loc1}`);
  }
}

// 5) ?phone=... legacy fallback
if (testProfile.whatsapp_phone) {
  console.log(`\n4️⃣  ?phone=<phone> legacy fallback:`);
  const r2 = await fetch(`${APP_URL}/api/panel/evergreen?phone=${encodeURIComponent(testProfile.whatsapp_phone)}`, { redirect: "manual" });
  console.log(`   HTTP status: ${r2.status}`);
  const loc2 = r2.headers.get("location");
  console.log(`   Location: ${loc2}`);
  if (loc2 && loc2.includes("/tr/panel?t=")) {
    console.log("   ✅ Legacy phone path da çalışıyor (multi-match'te first row alındı)");
  } else if (loc2 && loc2.endsWith("/tr")) {
    console.log("   ❌ Phone path /tr landing — yine kırık?");
  }
}

// 6) Post-test: yeni token yazıldı mı?
const { count: tokensAfter } = await sb
  .from("magic_link_tokens")
  .select("*", { count: "exact", head: true })
  .eq("user_id", testProfile.id);
console.log(`\n5️⃣  Token sayısı (sonrası): ${tokensAfter ?? 0} (öncesi: ${tokensBefore ?? 0})`);
const newTokens = (tokensAfter ?? 0) - (tokensBefore ?? 0);
if (newTokens > 0) {
  console.log(`   ✅ ${newTokens} fresh token mint edildi (DB'ye yazıldı)`);
} else {
  console.log(`   ⚠️  Hiç yeni token yok — endpoint çalışmamış olabilir`);
}

console.log("");
