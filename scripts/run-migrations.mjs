import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync("/home/cagr/Masaüstü/upu-platform/.env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

console.log("═══ DOĞRULAMA ═══\n");

// 1. looking_for + deleted_at kolonlarına SELECT ata — yoksa schema cache'den hata döner
console.log("1) Kolon varlığı (SELECT looking_for, deleted_at)");
const { data: rows, error: e1, count: total } = await sb
  .from("emlak_customers")
  .select("id, listing_type, looking_for, deleted_at", { count: "exact" })
  .limit(5);
if (e1) { console.log("   ❌", e1.message); process.exit(1); }
console.log("   ✅ Kolonlar mevcut. Toplam müşteri:", total);
console.log("   Örnek 5 satır:");
for (const r of rows || []) {
  console.log(`     ${r.id.slice(0,8)} | listing_type=${r.listing_type} | looking_for=${JSON.stringify(r.looking_for)} | deleted_at=${r.deleted_at}`);
}

// 2. Backfill durumu — looking_for NULL olmayan kaç satır var
console.log("\n2) Backfill kapsama");
const { count: withLF } = await sb
  .from("emlak_customers")
  .select("*", { count: "exact", head: true })
  .not("looking_for", "is", null);
const { count: nullLF } = await sb
  .from("emlak_customers")
  .select("*", { count: "exact", head: true })
  .is("looking_for", null);
console.log(`   looking_for DOLU: ${withLF}`);
console.log(`   looking_for NULL: ${nullLF}`);

// 3. Soft delete — şu an silinmiş satır var mı?
console.log("\n3) Soft-delete state");
const { count: deletedCount } = await sb
  .from("emlak_customers")
  .select("*", { count: "exact", head: true })
  .not("deleted_at", "is", null);
console.log(`   deleted_at DOLU: ${deletedCount}`);

// 4. listing_type değer dağılımı — backfill'in doğruluğunu kontrol et
console.log("\n4) listing_type dağılımı (backfill kontrolü)");
const { data: lts } = await sb
  .from("emlak_customers")
  .select("listing_type, looking_for")
  .limit(100);
const dist = {};
for (const r of lts || []) {
  const key = `lt=${r.listing_type ?? "NULL"} lf=${JSON.stringify(r.looking_for)}`;
  dist[key] = (dist[key] || 0) + 1;
}
for (const [k, v] of Object.entries(dist)) console.log(`   ${k}: ${v}`);

// 5. INSERT testi — yeni record looking_for array kabul ediyor mu?
console.log("\n5) INSERT smoke test (SELECT 1 row, dry check)");
const { data: smokeProfile } = await sb
  .from("profiles")
  .select("id, tenant_id")
  .eq("tenant_id", "3f3598fc-a93e-4c73-bd33-7c4217f6c089")
  .limit(1)
  .maybeSingle();
if (!smokeProfile) {
  console.log("   ⚠️ emlak tenant'ında profile yok, INSERT testi atlandı");
} else {
  console.log(`   Profile bulundu: ${smokeProfile.id.slice(0,8)} (insert deneyimi yapılmıyor — readonly doğrulama)`);
}

console.log("\n═══ DOĞRULAMA TAMAM ═══");
