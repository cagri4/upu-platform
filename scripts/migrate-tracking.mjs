#!/usr/bin/env node
/**
 * Supabase production migration apply + verify
 *
 * Adımlar:
 *  1) Bilinen exec/SQL RPC isimlerini probe et
 *  2) Bulunmazsa şu anki schema durumunu diagnose et
 *  3) Multi-row INSERT testi yap (constraint kalmış mı kontrol et)
 *  4) Rapor üret
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.production.local'i manuel oku
const envPath = resolve(__dirname, "..", ".env.production.local");
const envText = readFileSync(envPath, "utf8");
const env = {};
envText.split("\n").forEach((line) => {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
});

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SVC) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env yok.");
  process.exit(1);
}

const sb = createClient(URL, SVC, { auth: { persistSession: false } });

console.log(`\n🔌 Bağlantı: ${URL}\n`);

// ── 1) SQL RPC probe ──────────────────────────────────────────────
const RPC_CANDIDATES = ["exec_sql", "execute_sql", "run_sql", "query", "sql"];
console.log("1️⃣  SQL exec RPC probe:");
let foundRpc = null;
for (const name of RPC_CANDIDATES) {
  const { error } = await sb.rpc(name, { sql: "select 1" });
  if (!error) {
    console.log(`   ✅ '${name}' bulundu — DDL'i bu RPC ile uygulayacağız`);
    foundRpc = name;
    break;
  }
  // 404 = function yok, 400 = function var ama parametre uyumsuz
  if (error.code === "PGRST202" || error.message?.includes("not found")) {
    console.log(`   ❌ '${name}' yok`);
  } else {
    console.log(`   ⚠️  '${name}' var ama beklenmeyen hata: ${error.message}`);
  }
}

if (!foundRpc) {
  console.log("\n   Sonuç: hiçbir SQL exec RPC fonksiyonu yok.");
  console.log("   service-role JWT ile DDL programatik olarak çalıştırılamaz.\n");
}

// ── 2) Mevcut şema durumu ─────────────────────────────────────────
console.log("\n2️⃣  Mevcut emlak_tracking_criteria şema diagnose:");

// `name` kolonu var mı? Select dener — yoksa hata "column not found" döner
const nameProbe = await sb.from("emlak_tracking_criteria").select("name").limit(1);
const hasNameColumn = !nameProbe.error;
console.log(`   • name kolonu: ${hasNameColumn ? "✅ VAR" : "❌ YOK"}`);
if (!hasNameColumn) console.log(`     hata: ${nameProbe.error.message}`);

// `status` kolonu var mı?
const statusProbe = await sb.from("emlak_tracking_criteria").select("status").limit(1);
const hasStatusColumn = !statusProbe.error;
console.log(`   • status kolonu: ${hasStatusColumn ? "✅ VAR" : "❌ YOK (active boolean kullanılıyor)"}`);

// active boolean hala var mı?
const activeProbe = await sb.from("emlak_tracking_criteria").select("active").limit(1);
const hasActiveColumn = !activeProbe.error;
console.log(`   • active kolonu: ${hasActiveColumn ? "✅ VAR" : "❌ YOK"}`);

// id PK?
const idProbe = await sb.from("emlak_tracking_criteria").select("id").limit(1);
const hasIdColumn = !idProbe.error;
console.log(`   • id kolonu: ${hasIdColumn ? "✅ VAR" : "❌ YOK"}`);

// Mevcut row sayısı
const { count: totalRows } = await sb.from("emlak_tracking_criteria")
  .select("*", { count: "exact", head: true });
console.log(`   • toplam row: ${totalRows ?? 0}`);

// Distinct user sayısı (multi-row test için)
const { data: byUser } = await sb.from("emlak_tracking_criteria").select("user_id");
const userCount = byUser ? new Set(byUser.map(r => r.user_id)).size : 0;
const dupUsers = byUser ? byUser.length - userCount : 0;
console.log(`   • distinct user: ${userCount}, multi-row user: ${dupUsers > 0 ? "✅ VAR" : "❌ YOK (UNIQUE constraint hala aktif olabilir)"}`);

// ── 3) UNIQUE constraint test (INSERT denemesi) ──────────────────────
console.log("\n3️⃣  UNIQUE constraint testi (test row insert/cleanup):");
if (totalRows && totalRows > 0 && byUser && byUser.length > 0) {
  const sampleUserId = byUser[0].user_id;
  const insertProbe = await sb.from("emlak_tracking_criteria")
    .insert({
      user_id: sampleUserId,
      neighborhoods: [],
      property_types: [],
      listing_type: null,
      ...(hasNameColumn ? { name: "MIGRATION_TEST_DELETE_ME" } : {}),
      ...(hasStatusColumn ? { status: "active" } : { active: true }),
    })
    .select("id")
    .single();
  if (insertProbe.error) {
    if (insertProbe.error.code === "23505" || insertProbe.error.message?.includes("unique")) {
      console.log("   ❌ UNIQUE constraint aktif (uq_tracking_user) — multi-row henüz açılmadı");
    } else {
      console.log(`   ⚠️  Insert hata: ${insertProbe.error.message}`);
    }
  } else if (insertProbe.data?.id) {
    console.log(`   ✅ Multi-row INSERT başarılı (id=${insertProbe.data.id}) — UNIQUE constraint kaldırılmış`);
    // Cleanup test row
    await sb.from("emlak_tracking_criteria").delete().eq("id", insertProbe.data.id);
    console.log("   🧹 Test row temizlendi");
  }
} else {
  console.log("   ⏭  Mevcut takip yok, INSERT testi atlandı");
}

// ── 4) Migration plan kararı ─────────────────────────────────────
console.log("\n4️⃣  Karar:");
const allReady = hasNameColumn && hasIdColumn;
if (allReady && dupUsers > 0) {
  console.log("   ✅ Migration UYGULANMIŞ — multi-row aktif. Doğrulama tamam.");
} else if (allReady && dupUsers === 0) {
  console.log("   ⚠️  Şema migrate'd ama henüz multi-row data yok (kullanıcı henüz 2. takip eklememiş)");
} else if (foundRpc) {
  console.log(`   ▶️  Migration RPC ('${foundRpc}') ile uygulanabilir — sonraki adım.`);
} else {
  console.log("   ⏳ Migration MANUEL uygulanmalı:");
  console.log("      1) Supabase Dashboard → SQL Editor");
  console.log("      2) supabase/migrations/20260508120000_tracking_multirow.sql içeriğini yapıştır");
  console.log("      3) Run");
  console.log("      4) Bu scripti tekrar çalıştır (verify)");
}

console.log("");
