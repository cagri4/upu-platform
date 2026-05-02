#!/usr/bin/env node
/**
 * Demo data seed — Hollanda Türk hırdavat/inşaat dağıtıcı senaryosu.
 *
 * Kullanım:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/seed-demo-bayi.mjs <ownerUserId>
 *
 * veya .env.local'de Supabase env'leri varsa:
 *   npm run seed:demo -- <ownerUserId>
 *
 * Argüman:
 *   ownerUserId — bayi tenant'ında admin/user rolünde profile.id (UUID)
 *
 * Etki:
 *   25 ürün + 12 bayi + 8 sipariş + 4 fatura aynı tenant_id'ye yazılır.
 *   Tenant'ta zaten ürün varsa skip eder (üst üste insert engeli).
 *
 * Bu script `/api/bayi-demo/import` endpoint'inin offline alternatifi —
 * doğrudan Supabase'e yazar, magic link gerekmez.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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

const ownerUserId = process.argv[2];
if (!ownerUserId) {
  console.error("❌ Kullanım: node scripts/seed-demo-bayi.mjs <ownerUserId>");
  console.error("   ownerUserId = bayi tenant admin/user profile.id (UUID)");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Dataset (src/tenants/bayi/demo-import/hardware-distributor.ts ile senkron) ───

const DEMO_PRODUCTS = [
  { name: "M8 × 40 Galvaniz Vida (250 lik)", code: "VID-M8-40", category: "Vida & Cıvata", unit: "paket", unit_price: 24.50, stock_quantity: 80, brand: "Bossard", vat_rate: 21, ean: "8714123456001" },
  { name: "M10 × 60 Inox Vida (100 lik)", code: "VID-M10-60-INOX", category: "Vida & Cıvata", unit: "paket", unit_price: 38.00, stock_quantity: 120, brand: "Bossard", vat_rate: 21, ean: "8714123456002" },
  { name: "Beton Dübel 6×40 (200 lik)", code: "DUBEL-6-40", category: "Vida & Cıvata", unit: "paket", unit_price: 16.75, stock_quantity: 200, brand: "Fischer", vat_rate: 21, ean: "8714123456003" },
  { name: "Çatı Vidası 6.3×100 (50 lik)", code: "VID-CATI-100", category: "Vida & Cıvata", unit: "paket", unit_price: 22.40, stock_quantity: 90, brand: "Spax", vat_rate: 21, ean: null },
  { name: "Akzo Beyaz İç Cephe Mat 15L", code: "BOYA-AKZO-IC-15L", category: "Boya & Vernik", unit: "kutu", unit_price: 89.90, stock_quantity: 45, brand: "Akzo Nobel", vat_rate: 21, ean: "8714987654001" },
  { name: "Akzo Yağlı Boya Beyaz 5L", code: "BOYA-AKZO-YAG-5L", category: "Boya & Vernik", unit: "kutu", unit_price: 64.50, stock_quantity: 30, brand: "Akzo Nobel", vat_rate: 21, ean: "8714987654002" },
  { name: "Tikkurila Dış Cephe Astar 10L", code: "BOYA-TIK-DIS-10L", category: "Boya & Vernik", unit: "kutu", unit_price: 72.00, stock_quantity: 22, brand: "Tikkurila", vat_rate: 21, ean: null },
  { name: "Bayer Vernik Şeffaf 2.5L", code: "VER-BAYER-25L", category: "Boya & Vernik", unit: "kutu", unit_price: 31.50, stock_quantity: 60, brand: "Bayer", vat_rate: 21, ean: null },
  { name: "Sika Polimerik Yapıştırıcı 290ml", code: "YAP-SIKA-290", category: "Yapıştırıcı", unit: "adet", unit_price: 8.75, stock_quantity: 250, brand: "Sika", vat_rate: 21, ean: "7610256789001" },
  { name: "Pattex Hızlı Tutkal 50g", code: "TUT-PATTEX-50", category: "Yapıştırıcı", unit: "adet", unit_price: 5.20, stock_quantity: 180, brand: "Pattex", vat_rate: 21, ean: null },
  { name: "Akrilik Mastik Beyaz 310ml", code: "MAS-AKRILIK-310", category: "Yapıştırıcı", unit: "adet", unit_price: 4.95, stock_quantity: 320, brand: "Soudal", vat_rate: 21, ean: null },
  { name: "NYM 3×2.5 Kablo (100m)", code: "KABLO-NYM-3X25", category: "Elektrik", unit: "rulo", unit_price: 145.00, stock_quantity: 18, brand: "Prysmian", vat_rate: 21, ean: null },
  { name: "Schuko Topraklı Priz Beyaz", code: "PRIZ-SCHUKO-BYZ", category: "Elektrik", unit: "adet", unit_price: 6.40, stock_quantity: 200, brand: "Niko", vat_rate: 21, ean: null },
  { name: "Anahtar Tek Kontrol Beyaz", code: "ANH-TEK-BYZ", category: "Elektrik", unit: "adet", unit_price: 4.85, stock_quantity: 220, brand: "Niko", vat_rate: 21, ean: null },
  { name: "LED Spot 7W Sıcak Beyaz", code: "LED-SPOT-7W-SB", category: "Elektrik", unit: "adet", unit_price: 8.90, stock_quantity: 350, brand: "Philips", vat_rate: 21, ean: null },
  { name: "PPR Boru 25mm (4m)", code: "PPR-25-4M", category: "Tesisat", unit: "adet", unit_price: 12.30, stock_quantity: 75, brand: "Wavin", vat_rate: 21, ean: null },
  { name: "Lavabo Bataryası Krom", code: "BAT-LAV-KRM", category: "Tesisat", unit: "adet", unit_price: 58.90, stock_quantity: 25, brand: "Grohe", vat_rate: 21, ean: null },
  { name: "Tuvalet Sifonu Komple", code: "SIFON-TUV-KMP", category: "Tesisat", unit: "adet", unit_price: 34.50, stock_quantity: 40, brand: "Geberit", vat_rate: 21, ean: null },
  { name: "EPS 50mm İzolasyon Plakası", code: "EPS-50MM", category: "İzolasyon", unit: "m2", unit_price: 7.20, stock_quantity: 480, brand: "Knauf", vat_rate: 21, ean: null },
  { name: "Cam Yünü 100mm (5m²)", code: "CAM-YUN-100", category: "İzolasyon", unit: "rulo", unit_price: 28.40, stock_quantity: 65, brand: "Isover", vat_rate: 21, ean: null },
  { name: "Bosch Akülü Vidalama 18V", code: "BOSCH-VID-18V", category: "Aletler", unit: "adet", unit_price: 189.00, stock_quantity: 12, brand: "Bosch", vat_rate: 21, ean: "3165140123456" },
  { name: "Stanley Çekiç 500g", code: "CEKIC-STAN-500", category: "Aletler", unit: "adet", unit_price: 18.50, stock_quantity: 60, brand: "Stanley", vat_rate: 21, ean: null },
  { name: "Maket Bıçağı 18mm", code: "BIC-MAK-18", category: "Aletler", unit: "adet", unit_price: 3.40, stock_quantity: 200, brand: "Stanley", vat_rate: 21, ean: null },
  { name: "İş Eldiveni (Çift)", code: "ELD-IS-CFT", category: "İş Güvenliği", unit: "çift", unit_price: 2.85, stock_quantity: 500, brand: "3M", vat_rate: 21, ean: null },
  { name: "Toz Maskesi FFP2 (10 lu)", code: "MAS-FFP2-10", category: "İş Güvenliği", unit: "paket", unit_price: 14.90, stock_quantity: 80, brand: "3M", vat_rate: 21, ean: null },
];

const DEMO_DEALERS = [
  { name: "Demir Yapı Market",       city: "Rotterdam",  country: "NL", contact_name: "Mehmet Demir",   contact_phone: "31612345671", is_active: true, balance: 4300 },
  { name: "Yıldız İnşaat Toptan",    city: "Amsterdam",  country: "NL", contact_name: "Ayşe Yıldız",    contact_phone: "31612345672", is_active: true, balance: 1850 },
  { name: "Bursa Hırdavat",          city: "Eindhoven",  country: "NL", contact_name: "Hasan Kaya",     contact_phone: "31612345673", is_active: true, balance: 6200 },
  { name: "Anadolu Yapı Malzemesi",  city: "Den Haag",   country: "NL", contact_name: "Selim Arslan",   contact_phone: "31612345674", is_active: true, balance: 0 },
  { name: "Hilal İnşaat",            city: "Utrecht",    country: "NL", contact_name: "Fatma Öztürk",   contact_phone: "31612345675", is_active: true, balance: 920 },
  { name: "Kara Boya & Vernik",      city: "Tilburg",    country: "NL", contact_name: "Ali Karaca",     contact_phone: "31612345676", is_active: true, balance: 2750 },
  { name: "Anatolia Bouw Supplies",  city: "Antwerpen",  country: "BE", contact_name: "Zeynep Aydın",   contact_phone: "32412345677", is_active: true, balance: 3100 },
  { name: "Ege Tesisat Malzeme",     city: "Almere",     country: "NL", contact_name: "İbrahim Şahin",  contact_phone: "31612345678", is_active: true, balance: 1450 },
  { name: "Marmara Elektrik",        city: "Groningen",  country: "NL", contact_name: "Mustafa Çelik",  contact_phone: "31612345679", is_active: true, balance: 0 },
  { name: "Akdeniz Yapı Marketi",    city: "Brussel",    country: "BE", contact_name: "Cenk Yılmaz",    contact_phone: "32412345670", is_active: true, balance: 5400 },
  { name: "Karadeniz Hırdavat",      city: "Nijmegen",   country: "NL", contact_name: "Hatice Polat",   contact_phone: "31612345681", is_active: false, balance: 0 },
  { name: "Toros Boya Toptan",       city: "Breda",      country: "NL", contact_name: "Veli Dursun",    contact_phone: "31612345682", is_active: true, balance: 780 },
];

const DEMO_ORDERS = [
  { dealer_index: 0,  product_index: 4,  quantity: 5,   status: "delivered",  days_ago: 14 },
  { dealer_index: 0,  product_index: 8,  quantity: 24,  status: "delivered",  days_ago: 9 },
  { dealer_index: 1,  product_index: 0,  quantity: 12,  status: "shipped",    days_ago: 4 },
  { dealer_index: 2,  product_index: 5,  quantity: 8,   status: "delivered",  days_ago: 18 },
  { dealer_index: 5,  product_index: 4,  quantity: 15,  status: "preparing",  days_ago: 2 },
  { dealer_index: 6,  product_index: 11, quantity: 4,   status: "preparing",  days_ago: 1 },
  { dealer_index: 7,  product_index: 15, quantity: 20,  status: "pending",    days_ago: 0 },
  { dealer_index: 9,  product_index: 4,  quantity: 25,  status: "shipped",    days_ago: 6 },
];

const DEMO_INVOICES = [
  { dealer_index: 0, amount: 4300, is_paid: false, due_days_offset: -3 },
  { dealer_index: 1, amount: 1850, is_paid: false, due_days_offset: 5 },
  { dealer_index: 2, amount: 6200, is_paid: false, due_days_offset: -12 },
  { dealer_index: 4, amount: 920,  is_paid: true,  due_days_offset: -7 },
];

// ─── Çalıştırma ────────────────────────────────────────────────────────

async function main() {
  console.log(`🌱 Demo seed başlıyor — owner: ${ownerUserId}`);

  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("id, tenant_id, role")
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

  const tenantId = profile.tenant_id;

  // Mevcut veri kontrolü
  const { count: existing } = await sb
    .from("bayi_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((existing || 0) > 0) {
    console.error(`❌ Tenant'ta zaten ${existing} ürün var. Üst üste insert yapılmaz.`);
    console.error("   Demo veriyi temizlemek için: bayi_products + bayi_dealers + bayi_orders + bayi_dealer_invoices tablolarından tenant_id ile silin.");
    process.exit(1);
  }

  // 1) Ürünler
  console.log(`📦 ${DEMO_PRODUCTS.length} ürün ekleniyor...`);
  const productsPayload = DEMO_PRODUCTS.map(p => ({
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
  console.log(`🏪 ${DEMO_DEALERS.length} bayi ekleniyor...`);
  const dealersPayload = DEMO_DEALERS.map(d => ({
    tenant_id: tenantId, user_id: ownerUserId,
    name: d.name, city: d.city, country: d.country,
    contact_name: d.contact_name, contact_phone: d.contact_phone,
    is_active: d.is_active, balance: d.balance,
  }));
  const { data: dealers, error: dErr } = await sb.from("bayi_dealers").insert(dealersPayload).select("id");
  if (dErr) { console.error("❌ Bayi insert:", dErr.message); process.exit(1); }

  // 3) Siparişler
  console.log(`📋 ${DEMO_ORDERS.length} sipariş ekleniyor...`);
  const ordersPayload = DEMO_ORDERS.map(o => {
    const productData = DEMO_PRODUCTS[o.product_index];
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
  console.log(`💳 ${DEMO_INVOICES.length} fatura ekleniyor...`);
  const today = new Date();
  const invoicesPayload = DEMO_INVOICES.map((inv, idx) => ({
    tenant_id: tenantId,
    dealer_id: dealers[inv.dealer_index]?.id,
    invoice_no: `DEMO-${String(idx + 1).padStart(4, "0")}`,
    amount: inv.amount,
    is_paid: inv.is_paid,
    due_date: new Date(today.getTime() + inv.due_days_offset * 86400000).toISOString().slice(0, 10),
    paid_at: inv.is_paid ? new Date(Date.now() - 86400000).toISOString() : null,
  }));
  const { error: iErr } = await sb.from("bayi_dealer_invoices").insert(invoicesPayload);
  if (iErr) { console.error("❌ Fatura insert:", iErr.message); process.exit(1); }

  console.log(`\n✅ Demo seed tamam:`);
  console.log(`   • ${products.length} ürün`);
  console.log(`   • ${dealers.length} bayi`);
  console.log(`   • ${ordersPayload.length} sipariş`);
  console.log(`   • ${invoicesPayload.length} fatura`);
  console.log(`\n🚀 retailai.upudev.nl'de bu owner ile login olunca veriler görünür.`);
}

main().catch(err => {
  console.error("❌ Beklenmedik hata:", err);
  process.exit(1);
});
