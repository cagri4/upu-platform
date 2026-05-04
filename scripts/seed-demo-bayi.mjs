#!/usr/bin/env node
/**
 * Demo data seed — sektör bazlı dataset (Hollanda Türk dağıtıcı senaryosu).
 *
 * Kullanım:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/seed-demo-bayi.mjs <ownerUserId> [--sector=<slug>] [--force]
 *
 *   veya .env.local'de Supabase env'leri varsa:
 *   npm run seed:demo -- <ownerUserId> --sector=gida
 *
 * Argümanlar:
 *   ownerUserId   — bayi tenant'ında admin/user rolünde profile.id (UUID)
 *   --sector=     — boya | gida | hirdavat | tekstil | temizlik
 *                   (default: profile.metadata.firma_profili.sektor → yoksa boya)
 *   --force       — tenant'ta zaten ürün varsa yine de insert et (mevcut veri kalır)
 *
 * Etki:
 *   20 ürün + 5 bayi + 7 sipariş + 3 vade hareketi aynı tenant_id'ye yazılır.
 *   --force yoksa tenant'ta ürün varsa script çıkar (üst üste insert engeli).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getSectorDataset, listSectorSlugs } from "./sector-data.mjs";

// .env.local fallback (eğer env-var verilmemişse)
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(join(__dirname, "..", ".env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* .env.local yoksa env-var elle verilmiş demektir */ }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env-var gerekli");
  process.exit(1);
}

// Argv parse
const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith("--"));
const flags = args.filter(a => a.startsWith("--"));
const ownerUserId = positional[0];
const sectorFlag = flags.find(f => f.startsWith("--sector="))?.replace("--sector=", "");
const force = flags.includes("--force");

if (!ownerUserId) {
  console.error("❌ Kullanım: node scripts/seed-demo-bayi.mjs <ownerUserId> [--sector=<slug>] [--force]");
  console.error(`   Sektörler: ${listSectorSlugs().join(", ")}`);
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log(`🌱 Demo seed başlıyor — owner: ${ownerUserId}`);

  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("id, tenant_id, role, metadata")
    .eq("id", ownerUserId)
    .maybeSingle();
  if (profErr || !profile) {
    console.error("❌ Profile bulunamadı:", profErr?.message || "yok");
    process.exit(1);
  }
  if (!profile.tenant_id) {
    console.error("❌ Profile'da tenant_id yok");
    process.exit(1);
  }
  if (profile.role !== "admin" && profile.role !== "user") {
    console.error(`❌ Sadece admin/user rolü demo seed yapabilir (rol: ${profile.role})`);
    process.exit(1);
  }

  // Sektör resolution: --sector flag > metadata.firma_profili.sektor > boya default
  const meta = profile.metadata || {};
  const firmaSektor = meta?.firma_profili?.sektor;
  const sectorSlug = sectorFlag || firmaSektor || "boya";
  const dataset = getSectorDataset(sectorSlug);
  console.log(`📁 Sektör: ${dataset.label} (slug: ${dataset.slug})`);

  const tenantId = profile.tenant_id;

  // Mevcut veri kontrolü
  const { count: existing } = await sb
    .from("bayi_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((existing || 0) > 0) {
    if (!force) {
      console.error(`❌ Tenant'ta zaten ${existing} ürün var. Üst üste insert yapılmaz.`);
      console.error("   --force ile yine de yüklemek için: ... --force");
      console.error("   Demo veriyi temizlemek için: bayi_products + bayi_dealers + bayi_orders + bayi_dealer_invoices tablolarından tenant_id ile silin.");
      process.exit(1);
    }
    console.warn(`⚠️  Tenant'ta zaten ${existing} ürün var ama --force ile devam ediliyor.`);
  }

  // 1) Ürünler
  console.log(`📦 ${dataset.products.length} ürün ekleniyor...`);
  const productsPayload = dataset.products.map(p => ({
    tenant_id: tenantId,
    user_id: ownerUserId,
    name: p.name, code: p.code, category: p.category, unit: p.unit,
    unit_price: p.unit_price, base_price: p.unit_price,
    stock_quantity: p.stock_quantity, brand: p.brand, is_active: true,
    metadata: { vat_rate: p.vat_rate, ean: p.ean },
  }));
  const { data: products, error: pErr } = await sb.from("bayi_products").insert(productsPayload).select("id");
  if (pErr) { console.error("❌ Ürün insert:", pErr.message); process.exit(1); }

  // 2) Bayiler
  console.log(`🏪 ${dataset.dealers.length} bayi ekleniyor...`);
  const dealersPayload = dataset.dealers.map(d => ({
    tenant_id: tenantId, user_id: ownerUserId,
    name: d.name, city: d.city, country: d.country,
    contact_name: d.contact_name, contact_phone: d.contact_phone,
    is_active: d.is_active, balance: d.balance,
  }));
  const { data: dealers, error: dErr } = await sb.from("bayi_dealers").insert(dealersPayload).select("id");
  if (dErr) { console.error("❌ Bayi insert:", dErr.message); process.exit(1); }

  // 3) Siparişler
  console.log(`📋 ${dataset.orders.length} sipariş ekleniyor...`);
  const ordersPayload = dataset.orders.map(o => {
    const productData = dataset.products[o.product_index];
    const total = productData.unit_price * o.quantity;
    const createdAt = new Date(Date.now() - o.days_ago * 86400000).toISOString();
    return {
      tenant_id: tenantId, user_id: ownerUserId,
      dealer_id: dealers[o.dealer_index]?.id,
      product_id: products[o.product_index]?.id,
      quantity: o.quantity,
      unit_price: productData.unit_price,
      total_amount: total,
      status: o.status, created_at: createdAt,
    };
  });
  const { error: oErr } = await sb.from("bayi_orders").insert(ordersPayload);
  if (oErr) { console.error("❌ Sipariş insert:", oErr.message); process.exit(1); }

  // 4) Faturalar
  console.log(`💳 ${dataset.invoices.length} vade hareketi ekleniyor...`);
  const today = new Date();
  const invoicesPayload = dataset.invoices.map((inv, idx) => ({
    tenant_id: tenantId,
    dealer_id: dealers[inv.dealer_index]?.id,
    invoice_no: `DEMO-${dataset.slug.toUpperCase()}-${String(idx + 1).padStart(4, "0")}`,
    amount: inv.amount,
    is_paid: inv.is_paid,
    due_date: new Date(today.getTime() + inv.due_days_offset * 86400000).toISOString().slice(0, 10),
    paid_at: inv.is_paid ? new Date(Date.now() - 86400000).toISOString() : null,
  }));
  const { error: iErr } = await sb.from("bayi_dealer_invoices").insert(invoicesPayload);
  if (iErr) { console.error("❌ Fatura insert:", iErr.message); process.exit(1); }

  console.log(`\n✅ Demo seed tamam — ${dataset.label}:`);
  console.log(`   • ${products.length} ürün`);
  console.log(`   • ${dealers.length} bayi`);
  console.log(`   • ${ordersPayload.length} sipariş`);
  console.log(`   • ${invoicesPayload.length} vade hareketi`);
  console.log(`\n🚀 retailai.upudev.nl'de bu owner ile login olunca veriler görünür.`);
}

main().catch(err => {
  console.error("❌ Beklenmedik hata:", err);
  process.exit(1);
});
