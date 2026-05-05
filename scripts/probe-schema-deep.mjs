#!/usr/bin/env node
/**
 * DEEP schema probe — tablo boş ise empty insert ile NOT NULL kolonlarını
 * keşfeder, dummy değerlerle doldurarak başarılı bir insert yapar, sonra
 * dönen row'un tüm kolonlarını listeler. Insert sonrası DELETE eder
 * (probe verisi tabloda kalmaz).
 *
 * Tablo dolu ise SELECT ile kolonları doğrudan listeler.
 *
 * Sondajlanan tablolar: bayi_orders, bayi_dealer_invoices,
 * bayi_dealer_transactions (kullanıcı talebi 2026-05-05).
 *
 * Tenant_id örnek için bir bayi profile/dealer kullanır.
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

// Ömer can hesabı (test sahibi) — sondaj için gerçek tenant + dealer
const TENANT_ID = "32f5feda-700f-44c6-a270-5bbb5a040994";
const PROFILE_ID = "16f9ca4d-e681-4fd2-aaaf-00d9a3262fde";

// Bir dealer + product ID al (sondaj için)
const { data: oneDealer } = await sb.from("bayi_dealers").select("id").eq("tenant_id", TENANT_ID).limit(1).maybeSingle();
const { data: oneProduct } = await sb.from("bayi_products").select("id").eq("tenant_id", TENANT_ID).limit(1).maybeSingle();
console.log(`\nReferences: dealer_id=${oneDealer?.id?.slice(0, 8)}… product_id=${oneProduct?.id?.slice(0, 8)}…\n`);

// Dummy values cache — bilinmeyen NOT NULL kolonlarına bunlardan denemek
const DUMMY_VALUES = {
  string: "test",
  number: 1,
  uuid: oneDealer?.id || "00000000-0000-0000-0000-000000000000",
  date: new Date().toISOString(),
  json: {},
  bool: false,
};

// Bilinen kolon isimleri için tipik default
const COL_HINTS = {
  // İsim → uygun değer ipucu
  tenant_id: TENANT_ID,
  user_id: PROFILE_ID,
  dealer_id: oneDealer?.id,
  product_id: oneProduct?.id,
  customer_id: oneDealer?.id,
  status: "pending",
  type: "fatura",
  amount: 100,
  total: 100,
  total_amount: 100,
  quantity: 1,
  qty: 1,
  unit_price: 50,
  price: 50,
  is_paid: false,
  paid: false,
  due_date: new Date().toISOString().slice(0, 10),
  invoice_date: new Date().toISOString().slice(0, 10),
  created_at: new Date().toISOString(),
  invoice_no: "PROBE-001",
  invoice_number: "PROBE-001",
  number: "PROBE-001",
  order_no: "PROBE-001",
  order_number: "PROBE-001",
  description: "probe",
  note: "probe",
  notes: "probe",
  memo: "probe",
  comment: "probe",
  currency: "TRY",
  vat_rate: 20,
};

async function probeTable(tableName, maxAttempts = 25) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📋 PROBE: ${tableName}`);
  console.log(`${"=".repeat(60)}`);

  // 1) Tablo dolu mu?
  const { data: existing, error: selErr } = await sb.from(tableName).select("*").limit(1);
  if (selErr) {
    console.log(`❌ SELECT hatası: ${selErr.message}`);
    return null;
  }
  if (existing && existing.length > 0) {
    const cols = Object.keys(existing[0]);
    console.log(`✅ Tablo dolu, ${cols.length} kolon:\n`);
    for (const c of cols) {
      const v = existing[0][c];
      const t = v === null ? "null" : Array.isArray(v) ? `array(${v.length})` : typeof v;
      console.log(`  ${c.padEnd(28)} ${t}`);
    }
    return cols;
  }

  // 2) Boş tablo — kademeli NOT NULL keşfi
  console.log(`📭 Tablo boş — empty insert ile NOT NULL keşfediliyor...\n`);

  const payload = {};
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data: inserted, error } = await sb.from(tableName).insert(payload).select("*");

    if (!inserted && !error) {
      console.log(`  ❓ Attempt ${attempt}: data=null error=null (servis hatası?)`);
      break;
    }

    if (!error) {
      // Başarılı insert — kolonları listele, sonra DELETE
      const row = inserted[0];
      const cols = Object.keys(row);
      console.log(`\n✅ Insert başarılı (attempt ${attempt}). ${cols.length} kolon:\n`);
      for (const c of cols) {
        const v = row[c];
        const t = v === null ? "null" : Array.isArray(v) ? `array(${v.length})` : typeof v;
        console.log(`  ${c.padEnd(28)} ${t} ${v !== null && t === "string" ? `"${String(v).slice(0, 30)}"` : ""}`);
      }
      // DELETE probe
      if (row.id) {
        await sb.from(tableName).delete().eq("id", row.id);
        console.log(`  🗑  Probe row deleted`);
      }
      return cols;
    }

    lastError = error.message;
    // NOT NULL hatası → kolon adını çıkart
    const nullM = error.message.match(/null value in column ["']?([a-zA-Z_]+)["']?/i);
    if (nullM) {
      const col = nullM[1];
      const hint = COL_HINTS[col] !== undefined ? COL_HINTS[col] : DUMMY_VALUES.string;
      payload[col] = hint;
      console.log(`  Attempt ${attempt}: NOT NULL ${col} → set "${String(hint).slice(0, 30)}"`);
      continue;
    }
    // CHECK constraint
    const checkM = error.message.match(/violates check constraint ["']?([a-zA-Z_]+)["']?/i);
    if (checkM) {
      console.log(`  Attempt ${attempt}: CHECK constraint ${checkM[1]} — son payload deneniyor`);
      console.log(`     full error: ${error.message}`);
      break;
    }
    // Foreign key
    const fkM = error.message.match(/foreign key constraint ["']?([a-zA-Z_]+)["']?/i);
    if (fkM) {
      console.log(`  Attempt ${attempt}: FK constraint ${fkM[1]} — referans gerekli`);
      console.log(`     full error: ${error.message}`);
      break;
    }
    // Schema cache (kolon önerileri için)
    const colMissingM = error.message.match(/Could not find the ['"]?([a-zA-Z_]+)['"]?/i);
    if (colMissingM) {
      console.log(`  Attempt ${attempt}: kolon ${colMissingM[1]} schema cache'de yok (insert payload'da olmamalı)`);
      delete payload[colMissingM[1]];
      continue;
    }

    console.log(`  Attempt ${attempt}: tanınmayan hata: ${error.message}`);
    break;
  }

  console.log(`\n❌ ${tableName} sondajı başarısız. Son hata: ${lastError}`);
  console.log(`   Toplanan payload:`, JSON.stringify(payload, null, 2));
  return null;
}

await probeTable("bayi_orders");
await probeTable("bayi_dealer_invoices");
await probeTable("bayi_dealer_transactions");

console.log(`\n${"=".repeat(60)}`);
console.log(`Sondaj tamam. Çıkardığın kolon isimlerini seed.ts'e taşı.`);
