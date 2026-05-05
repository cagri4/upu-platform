#!/usr/bin/env node
/**
 * DESTRUCTIVE — bir bayi tenant'ının tüm bayi_* verisini siler ve
 * boya sektör seed'ini yeniden yükler. Kullanıcı onayı 2026-05-04.
 *
 * Kullanım:
 *   node scripts/cleanup-and-reseed-bayi.mjs <profileId> [--dry-run]
 *
 * Adımlar:
 *   1. Profile + tenant_id doğrula
 *   2. DELETE FROM bayi_dealer_invoices, bayi_orders, bayi_dealers,
 *      bayi_products WHERE tenant_id = <X>
 *   3. (varsa) bayi_dealer_notes/messages/campaigns
 *   4. Boya sektör dataset'ten seed insert (phone kolonu, paid_at
 *      defensive, yeni alanlar: tax_number/iban/credit_limit/...)
 *   5. profile.metadata.discovery_steps.bayi = 2 (Task 2 prompt yeniden)
 *   6. Doğrulama özet
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getSectorDataset } from "./sector-data.mjs";

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

const profileId = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!profileId) {
  console.error("❌ Kullanım: node scripts/cleanup-and-reseed-bayi.mjs <profileId> [--dry-run]");
  process.exit(1);
}

console.log(`\n🔍 Profile sondaj: ${profileId}\n`);

const { data: profile, error: pErr } = await sb
  .from("profiles")
  .select("id, tenant_id, role, display_name, metadata, whatsapp_phone")
  .eq("id", profileId)
  .maybeSingle();

if (pErr || !profile) {
  console.error(`❌ Profile bulunamadı: ${pErr?.message || "yok"}`);
  process.exit(1);
}
if (!profile.tenant_id) {
  console.error("❌ Profile.tenant_id boş");
  process.exit(1);
}

const tenantId = profile.tenant_id;
const sektor = profile.metadata?.firma_profili?.sektor || "boya";
console.log(`  display_name: ${profile.display_name}`);
console.log(`  tenant_id:    ${tenantId}`);
console.log(`  sektor:       ${sektor}`);
console.log(`  whatsapp:     ${profile.whatsapp_phone}`);

if (dryRun) {
  console.log(`\n🟡 --dry-run: gerçek değişiklik yapılmadı. Çalıştırmak için flag'i kaldır.\n`);
  process.exit(0);
}

// ── 2. DELETE eski veri ────────────────────────────────────────────
const tables = [
  "bayi_dealer_invoices",
  "bayi_orders",
  "bayi_dealers",
  "bayi_products",
];
const optionalTables = [
  "bayi_dealer_notes",
  "bayi_dealer_messages",
  "bayi_dealer_campaigns",
  "bayi_dealer_transactions",
];

console.log(`\n🗑  DELETE eski veri (tenant ${tenantId}):\n`);
for (const t of [...tables, ...optionalTables]) {
  const { count: before } = await sb.from(t).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (before === null) {
    console.log(`  ${t.padEnd(28)} (tablo yok / erişim yok, atla)`);
    continue;
  }
  if (before === 0) {
    console.log(`  ${t.padEnd(28)} 0 satır, atla`);
    continue;
  }
  const { error } = await sb.from(t).delete().eq("tenant_id", tenantId);
  if (error) {
    console.error(`  ${t.padEnd(28)} DELETE HATA: ${error.message}`);
  } else {
    console.log(`  ${t.padEnd(28)} ${before} satır silindi`);
  }
}

// ── 3. SEED yeniden yükle (boya sektörü, yeni schema'ya uyumlu) ────
const dataset = getSectorDataset(sektor);
console.log(`\n📦 Seed: ${dataset.label} (${dataset.dealers.length} bayi, ${dataset.products.length} ürün)\n`);

// Bayi dataset'ten genişletilmiş alanlar (boya.ts inline mirror) — mjs'in
// kısıtlı olduğu durumda fallback değerler. Kritik bayi (idx 2) için
// credit_limit/payment_term/discount_rate/risk_status/tags düşürmesi
// önemli. boya.ts ile birebir aynı sıraya tutuyoruz.
const DEALER_ENRICH = {
  boya: [
    { tax_number: "1234567890", tax_office: "Pendik V.D.",   iban: "TR320010009999987654321001", credit_limit: 15000, payment_term_days: 60, discount_rate: 10, risk_status: "clean", tags: ["VIP"],         district: "Kaynarca",       address_line: "Atatürk Cad. No:142",        email: "info@kalfaboya.com.tr" },
    { tax_number: "1234567891", tax_office: "Çankaya V.D.",  iban: "",                            credit_limit:  5000, payment_term_days: 30, discount_rate:  0, risk_status: "clean", tags: ["yeni"],        district: "Bahçelievler",   address_line: "Şehit Cengiz Topel Sok. 8/A", email: "hasan@hasanhirdavat.com" },
    { tax_number: "1234567892", tax_office: "Osmangazi V.D.", iban: "TR450004600118888888888801",  credit_limit: 10000, payment_term_days: 30, discount_rate:  5, risk_status: "watch", tags: ["kritik"],      district: "Osmangazi",      address_line: "İnönü Cad. Demir Apt. No:24", email: "ahmet@demirticaret.com.tr" },
    { tax_number: "1234567893", tax_office: "Karşıyaka V.D.", iban: "TR670006400000123456789012",  credit_limit:  8000, payment_term_days: 45, discount_rate:  8, risk_status: "clean", tags: [],              district: "Karşıyaka",      address_line: "Mavişehir Bulvarı 12",        email: "ayse@ayseyapi.com" },
    { tax_number: "1234567894", tax_office: "Selçuklu V.D.",  iban: "TR140012300055544411122233",  credit_limit: 20000, payment_term_days: 90, discount_rate: 12, risk_status: "clean", tags: ["VIP","kurumsal"], district: "Selçuklu",   address_line: "Yeni İstanbul Cad. 88",       email: "veli@yilmazboya.com" },
  ],
}[dataset.slug] || [];

// 3a) Ürünler — gerçek schema: barcode + specs (jsonb), metadata YOK.
const productsBase = dataset.products.map(p => ({
  tenant_id: tenantId,
  user_id: profileId,
  name: p.name, code: p.code, category: p.category, unit: p.unit,
  unit_price: p.unit_price, base_price: p.unit_price,
  stock_quantity: p.stock_quantity, brand: p.brand, is_active: true,
  barcode: p.ean,
  specs: { vat_rate: p.vat_rate },
}));
let productsResp = await sb.from("bayi_products").insert(productsBase).select("id");
if (productsResp.error && /column|schema cache|could not find/i.test(productsResp.error.message || "")) {
  console.warn(`  ⚠️  Ürün şema farkı — minimal retry: ${productsResp.error.message}`);
  const minimal = dataset.products.map(p => ({
    tenant_id: tenantId, user_id: profileId,
    name: p.name, code: p.code, category: p.category, unit: p.unit,
    unit_price: p.unit_price, base_price: p.unit_price,
    stock_quantity: p.stock_quantity, brand: p.brand, is_active: true,
  }));
  productsResp = await sb.from("bayi_products").insert(minimal).select("id");
}
if (productsResp.error) {
  console.error("❌ Ürün insert:", productsResp.error.message);
  process.exit(1);
}
const products = productsResp.data;
console.log(`  📦 ${products.length} ürün insert`);

// 3b) Bayiler — gerçek schema (probe-schema.mjs ile sondajlandı):
// id, tenant_id, company_id, company_name, email, phone, address,
// is_active, created_at, updated_at, user_id, contact_name, city,
// district, tax_no, founded_year, product_group, balance, status, name
// Migration kolonları (address_line/tax_number/iban/credit_limit/risk_status/
// tags) UYGULANMAMIŞ → eski şema isimleriyle insert ediyoruz.
const baseDealersPayload = dataset.dealers.map((d, i) => {
  const enrich = DEALER_ENRICH[i] || {};
  return {
    tenant_id: tenantId,
    user_id: profileId,
    name: d.name,
    company_name: d.name,
    email: enrich.email || `bayi-${i}@demo.local`,
    phone: d.contact_phone,
    contact_name: d.contact_name,
    city: d.city,
    district: enrich.district || null,
    address: enrich.address_line || null,
    tax_no: enrich.tax_number || null,
    is_active: d.is_active,
    balance: d.balance,
    status: "active",
  };
});

// Defensive insert: schema cache'inde olmayan kolonları kademeli at.
// Kademe 1: tüm yeni alanlar (migration uygulanmışsa)
// Kademe 2: minimal — schema cache'de KESIN var olan kolonlar (bayi-upu.ts
//           ve diğer mevcut handler'lar bunları kullanıyor)
// Kademe 3: en minimal — tenant_id + user_id + name + company_name
const COL_ERR = /column|schema cache|could not find/i;

async function insertDealersTryCascade() {
  // Kademe 1: full payload
  let resp = await sb.from("bayi_dealers").insert(baseDealersPayload).select("id");
  if (!resp.error) return resp;
  console.warn(`  ⚠️  Kademe 1 (full) hata: ${resp.error.message}`);
  if (!COL_ERR.test(resp.error.message || "")) return resp;

  // Kademe 2: bayi-upu.ts pattern — name + company_name + email (NOT NULL) +
  // city + phone + contact_name + balance + is_active
  const k2 = dataset.dealers.map((d, i) => ({
    tenant_id: tenantId, user_id: profileId,
    name: d.name, company_name: d.name,
    email: (DEALER_ENRICH[i]?.email) || `bayi-${i}@demo.local`,
    city: d.city, contact_name: d.contact_name, phone: d.contact_phone,
    is_active: d.is_active, balance: d.balance,
  }));
  resp = await sb.from("bayi_dealers").insert(k2).select("id");
  if (!resp.error) {
    console.warn(`  ✓ Kademe 2 başarılı (email NOT NULL dahil, address_line YOK)`);
    return resp;
  }
  console.warn(`  ⚠️  Kademe 2 hata: ${resp.error.message}`);
  if (!/column|schema cache|could not find|null value/i.test(resp.error.message || "")) return resp;

  // Kademe 3: minimal + email (NOT NULL)
  const k3 = dataset.dealers.map((d, i) => ({
    tenant_id: tenantId, user_id: profileId,
    name: d.name, company_name: d.name,
    email: (DEALER_ENRICH[i]?.email) || `bayi-${i}@demo.local`,
    is_active: d.is_active, balance: d.balance,
  }));
  resp = await sb.from("bayi_dealers").insert(k3).select("id");
  if (!resp.error) console.warn(`  ✓ Kademe 3 başarılı (name/company_name/email/balance)`);
  return resp;
}

const dealersInsertResp = await insertDealersTryCascade();
if (dealersInsertResp.error) {
  console.error("❌ Bayi insert tüm kademeler başarısız:", dealersInsertResp.error.message);
  process.exit(1);
}
const dealers = dealersInsertResp.data;
console.log(`  🏪 ${dealers.length} bayi insert`);

// Kademe 2/3 ile geçmiş olabilir — eksik alanları (balance/risk vb)
// ayrı UPDATE ile dene. balance kritik (kritik bayide 8500 olmalı).
for (let i = 0; i < dealers.length; i++) {
  const d = dataset.dealers[i];
  const updates = { balance: d.balance };
  const { error } = await sb.from("bayi_dealers").update(updates).eq("id", dealers[i].id);
  if (error && !COL_ERR.test(error.message)) {
    console.warn(`  ⚠️  Bayi[${i}] balance update hata: ${error.message}`);
  }
}

// 3c) Siparişler
const ordersPayload = dataset.orders.map(o => {
  const productData = dataset.products[o.product_index];
  return {
    tenant_id: tenantId, user_id: profileId,
    dealer_id: dealers[o.dealer_index]?.id,
    product_id: products[o.product_index]?.id,
    quantity: o.quantity,
    unit_price: productData.unit_price,
    total_amount: productData.unit_price * o.quantity,
    status: o.status,
    created_at: new Date(Date.now() - o.days_ago * 86400000).toISOString(),
  };
});
const { error: oErr } = await sb.from("bayi_orders").insert(ordersPayload);
if (oErr) console.warn(`  ⚠️  Sipariş insert hata (devam): ${oErr.message}`);
else console.log(`  📋 ${ordersPayload.length} sipariş insert`);

// 3d) Vade hareketleri — bayi_dealer_invoices schema'sı tam belirsiz
// (probe boş tablo, kolon listesi yok). Önce invoice'a dene, hata olursa
// transactions'a düş. Hiçbiri çalışmazsa balance üzerinden dolaylı vade
// (bayi.balance>0 → list endpoint "Borçlu" badge gösteriyor).
const today = new Date();
const tryInvoicePayload = dataset.invoices.map((inv, idx) => ({
  tenant_id: tenantId,
  dealer_id: dealers[inv.dealer_index]?.id,
  invoice_no: `DEMO-${dataset.slug.toUpperCase()}-${String(idx + 1).padStart(4, "0")}`,
  amount: inv.amount,
  is_paid: inv.is_paid,
  due_date: new Date(today.getTime() + inv.due_days_offset * 86400000).toISOString().slice(0, 10),
}));
let invoiceOk = false;
let { error: invErr } = await sb.from("bayi_dealer_invoices").insert(tryInvoicePayload);
if (!invErr) {
  invoiceOk = true;
  console.log(`  💳 ${tryInvoicePayload.length} vade hareketi (bayi_dealer_invoices) insert`);
} else {
  console.warn(`  ⚠️  bayi_dealer_invoices başarısız: ${invErr.message}`);
  // Transactions tablosunu dene
  const txPayload = dataset.invoices.map((inv) => ({
    tenant_id: tenantId,
    dealer_id: dealers[inv.dealer_index]?.id,
    type: "fatura",
    amount: inv.amount,
    note: `Vade: ${new Date(today.getTime() + inv.due_days_offset * 86400000).toISOString().slice(0, 10)}${inv.is_paid ? " (ödendi)" : ""}`,
    due_date: new Date(today.getTime() + inv.due_days_offset * 86400000).toISOString().slice(0, 10),
    created_at: new Date(today.getTime() + inv.due_days_offset * 86400000).toISOString(),
  }));
  const { error: txErr } = await sb.from("bayi_dealer_transactions").insert(txPayload);
  if (!txErr) {
    invoiceOk = true;
    console.log(`  💳 ${txPayload.length} vade hareketi (bayi_dealer_transactions) insert`);
  } else {
    console.warn(`  ⚠️  bayi_dealer_transactions de başarısız: ${txErr.message}`);
    console.warn(`  ℹ️  Vade hareketi atlandı; bayi balance>0 üzerinden "Borçlu" badge gelir.`);
  }
}
if (!invoiceOk) {
  console.warn(`  ℹ️  Tour Task 2 için detail endpoint isCritical balance>0'a duyarlı (a0644da sonrası deploy ile).`);
}

// ── 5. Discovery step reset ────────────────────────────────────────
const meta = profile.metadata || {};
const newSteps = { ...(meta.discovery_steps || {}), bayi: 2 };
const newMeta = { ...meta, discovery_steps: newSteps };
const { error: stepErr } = await sb.from("profiles")
  .update({ metadata: newMeta })
  .eq("id", profileId);
if (stepErr) {
  console.error(`  ⚠️  discovery_step reset hata: ${stepErr.message}`);
} else {
  console.log(`\n🔄 discovery_steps.bayi: ${meta.discovery_steps?.bayi ?? "—"} → 2 (Task 1 baştan başlasın)`);
}

// ── 6. Doğrulama ──────────────────────────────────────────────────
console.log(`\n✅ Doğrulama:\n`);
const { data: verifyDealers } = await sb
  .from("bayi_dealers")
  .select("name, balance, risk_status")
  .eq("tenant_id", tenantId)
  .order("name");
for (const d of verifyDealers || []) {
  console.log(`  • ${(d.name || "—").padEnd(30)} balance=${d.balance} risk=${d.risk_status || "—"}`);
}
const { data: verifyInvoices } = await sb
  .from("bayi_dealer_invoices")
  .select("dealer_id, amount, due_date, is_paid")
  .eq("tenant_id", tenantId);
console.log(`\n  Vade hareketleri: ${verifyInvoices?.length || 0} satır`);
for (const inv of verifyInvoices || []) {
  const overdueDays = inv.due_date ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000) : "?";
  console.log(`    amount=${inv.amount} due=${inv.due_date} paid=${inv.is_paid} overdue=${overdueDays} gün`);
}

console.log(`\n🚀 Tamam. /tr/bayiler aç, Demir Ticaret KRİTİK görünmeli.\n`);
