#!/usr/bin/env node
/**
 * READ-ONLY inspect — son kaydolan bayi tenant kullanıcısını + tenant
 * verisinin durumunu raporlar. DELETE / UPDATE yapmaz; sadece SELECT.
 *
 * Çıktı:
 *   - profile.id, profile.tenant_id, display_name, created_at, sektor
 *   - bayi_dealers / bayi_orders / bayi_dealer_invoices / bayi_products
 *     için tenant satır sayısı
 *   - dealer örnekleri (ilk 10): name + balance + dealer_id
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(join(__dirname, "..", ".env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// 1) Son kayıt: bayi tenant'ında, son 7 gün
const { data: profile } = await sb
  .from("profiles")
  .select("id, tenant_id, display_name, created_at, metadata")
  .order("created_at", { ascending: false })
  .limit(20);

const bayiProfiles = [];
for (const p of profile || []) {
  if (!p.tenant_id) continue;
  // tenants table: saas_type field tenant türünü tutuyor
  const { data: tenant } = await sb
    .from("tenants")
    .select("saas_type")
    .eq("id", p.tenant_id)
    .maybeSingle();
  if (tenant?.saas_type === "bayi") {
    bayiProfiles.push({
      ...p,
      tenant_type: tenant.saas_type,
      sektor: p.metadata?.firma_profili?.sektor || "—",
      discovery_step: p.metadata?.discovery_steps?.bayi ?? "—",
    });
  }
}

console.log(`\n📋 Son ${bayiProfiles.length} bayi tenant profile (created_at desc):\n`);
for (const p of bayiProfiles.slice(0, 5)) {
  console.log(`  • ${p.id}`);
  console.log(`    tenant_id: ${p.tenant_id}`);
  console.log(`    display_name: ${p.display_name || "—"}`);
  console.log(`    created_at: ${p.created_at}`);
  console.log(`    sektor: ${p.sektor}`);
  console.log(`    discovery_step bayi: ${p.discovery_step}`);
  console.log();
}

if (bayiProfiles.length === 0) {
  console.log("❌ Bayi tenant kullanıcısı yok.");
  process.exit(0);
}

const target = bayiProfiles[0];
console.log(`\n🎯 Target (en son): ${target.id} (tenant ${target.tenant_id})\n`);

// 2) Tenant veri sayımı
const tables = ["bayi_dealers", "bayi_dealer_invoices", "bayi_orders", "bayi_products"];
for (const t of tables) {
  const { count, error } = await sb.from(t).select("id", { count: "exact", head: true }).eq("tenant_id", target.tenant_id);
  console.log(`  ${t.padEnd(28)} ${error ? `ERROR: ${error.message}` : `${count} satır`}`);
}

// Opsiyonel tablolar (yoksa sessiz)
for (const t of ["bayi_dealer_notes", "bayi_dealer_messages", "bayi_dealer_campaigns"]) {
  const { count, error } = await sb.from(t).select("id", { count: "exact", head: true }).eq("tenant_id", target.tenant_id);
  if (error) {
    console.log(`  ${t.padEnd(28)} (tablo yok / erişilemez)`);
  } else {
    console.log(`  ${t.padEnd(28)} ${count} satır`);
  }
}

// 3) Bayi örnekleri — şu an tabloda ne var
const { data: dealers } = await sb
  .from("bayi_dealers")
  .select("id, name, company_name, balance, is_active")
  .eq("tenant_id", target.tenant_id)
  .order("created_at", { ascending: false })
  .limit(15);

console.log(`\n📦 İlk 15 bayi (tenant ${target.tenant_id}):\n`);
for (const d of dealers || []) {
  console.log(`  • ${(d.name || d.company_name || "—").padEnd(35)} balance=${d.balance ?? "null"} active=${d.is_active}`);
}

// 4) Vade hareketleri
const { data: invoices } = await sb
  .from("bayi_dealer_invoices")
  .select("dealer_id, amount, due_date, is_paid")
  .eq("tenant_id", target.tenant_id)
  .order("due_date", { ascending: true })
  .limit(10);

console.log(`\n💳 İlk 10 vade hareketi:\n`);
for (const inv of invoices || []) {
  const overdueDays = inv.due_date ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000) : "?";
  console.log(`  • dealer=${inv.dealer_id?.slice(0, 8)}… amount=${inv.amount} due=${inv.due_date} paid=${inv.is_paid} overdue_days=${overdueDays}`);
}

console.log(`\n✅ Inspect tamam. Cleanup için: node scripts/cleanup-bayi-tenant.mjs ${target.id}\n`);
