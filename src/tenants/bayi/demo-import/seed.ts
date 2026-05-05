/**
 * Demo seed runner — sektör bazlı dataset'i tenant'a yazar.
 *
 * Hem /api/bayi-demo/import (web onboarding) hem de WhatsApp discovery
 * chain "Devam Et" callback'i bu fonksiyonu çağırır. Tek truth-source:
 * sectors/index.ts dispatcher.
 *
 * Idempotency: tenant'ta zaten ürün varsa default skip (force=true ile zorla).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSectorDataset, type SectorDataset } from "./sectors";

export interface SeedResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  sector?: string;
  summary?: {
    products: number;
    dealers: number;
    orders: number;
    invoices: number;
  };
}

export interface SeedOptions {
  force?: boolean;
}

/**
 * Sektör bazlı demo dataset'i ilgili tenant'a yazar.
 *
 * @param supabase service-role client (RLS bypass)
 * @param tenantId hedef tenant_id
 * @param ownerId  owner profile.id (insert'lerde user_id alanı)
 * @param sector   sektör slug ("boya"|"gida"|"hirdavat"|"tekstil"|"temizlik")
 *                 — bilinmeyen → "boya" default (sectors/index.ts dispatch).
 * @param options  { force?: boolean } — force=true tenant'ta veri varsa yine yazar.
 */
export async function seedTenantDemoData(
  supabase: SupabaseClient,
  tenantId: string,
  ownerId: string,
  sector: string | null | undefined,
  options: SeedOptions = {},
): Promise<SeedResult> {
  const dataset: SectorDataset = getSectorDataset(sector);

  // Idempotency check
  const { count: existing } = await supabase
    .from("bayi_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((existing || 0) > 0 && !options.force) {
    return {
      ok: false,
      skipped: true,
      reason: `Tenant'ta zaten ${existing} ürün var. Demo seed sadece boş tenant'a yüklenir.`,
      sector: dataset.slug,
    };
  }

  // 1) Ürünler — gerçek bayi_products schema (probe-schema.mjs):
  //   id, tenant_id, code, name, description, base_price, stock_quantity,
  //   low_stock_threshold, image_url, is_active, user_id, category_id, sku,
  //   unit, unit_price, min_order, barcode, specs (jsonb), images, weight,
  //   brand, category
  // 'metadata' kolonu YOK; ean → 'barcode', vat_rate → 'specs.vat_rate'.
  // Eski 'metadata' field'ı defansif fallback için tutuluyor (yeni şema'lı
  // ortamlarda bozulmasın).
  const productsBase = dataset.products.map(p => ({
    tenant_id: tenantId,
    user_id: ownerId,
    name: p.name,
    code: p.code,
    category: p.category,
    unit: p.unit,
    unit_price: p.unit_price,
    base_price: p.unit_price,
    stock_quantity: p.stock_quantity,
    brand: p.brand,
    is_active: true,
    barcode: p.ean,
    specs: { vat_rate: p.vat_rate },
  }));
  // Önce yeni şema (specs + barcode) ile dene; PostgREST schema cache'inde
  // bir kolon yoksa minimal payload'a düş.
  const COL_ERR = /column|schema cache|could not find/i;
  let productsResp = await supabase.from("bayi_products").insert(productsBase).select("id");
  if (productsResp.error && COL_ERR.test(productsResp.error.message || "")) {
    console.warn("[seed] product schema farklılığı, minimal retry:", productsResp.error.message);
    const minimal = dataset.products.map(p => ({
      tenant_id: tenantId, user_id: ownerId,
      name: p.name, code: p.code, category: p.category, unit: p.unit,
      unit_price: p.unit_price, base_price: p.unit_price,
      stock_quantity: p.stock_quantity, brand: p.brand, is_active: true,
    }));
    productsResp = await supabase.from("bayi_products").insert(minimal).select("id");
  }
  const { data: products, error: pErr } = productsResp;
  if (pErr || !products) {
    return { ok: false, reason: `Ürün insert hatası: ${pErr?.message || "unknown"}`, sector: dataset.slug };
  }

  // 2) Bayiler — genişletilmiş alanlar (2026-05-04 migration sonrası).
  // Migration uygulanmamışsa eski kolonlar payload'da; yeni alanları
  // koşullu yazıyoruz ki tablo'da yoksa unknown column hatası alalım
  // (debug kolaylığı için açık).
  const dealersPayload = dataset.dealers.map(d => ({
    tenant_id: tenantId,
    user_id: ownerId,
    name: d.name,
    company_name: d.name,
    city: d.city,
    district: d.district || null,
    country: d.country,
    contact_name: d.contact_name,
    phone: d.contact_phone,
    email: d.email || null,
    address_line: d.address_line || null,
    tax_number: d.tax_number || null,
    tax_office: d.tax_office || null,
    iban: d.iban || null,
    credit_limit: d.credit_limit ?? null,
    payment_term_days: d.payment_term_days ?? null,
    discount_rate: d.discount_rate ?? null,
    risk_status: d.risk_status || "clean",
    tags: d.tags || [],
    is_active: d.is_active,
    balance: d.balance,
  }));
  const { data: dealers, error: dErr } = await supabase
    .from("bayi_dealers")
    .insert(dealersPayload)
    .select("id");
  if (dErr || !dealers) {
    return { ok: false, reason: `Bayi insert hatası: ${dErr?.message || "unknown"}`, sector: dataset.slug };
  }

  // 3) Siparişler — gerçek schema (probe-schema-deep.mjs):
  // bayi_orders: id, tenant_id, order_number, dealer_id, status_id (UUID FK),
  //   subtotal, discount_amount, total_amount, notes, vehicle_plate,
  //   driver_name, driver_phone, cargo_notes
  // bayi_order_items: id, tenant_id, order_id, product_id, product_code,
  //   product_name, quantity, unit_price, total_price
  // status_id lookup: bayi_order_statuses tablosundan code → id map.
  const { data: statuses } = await supabase
    .from("bayi_order_statuses")
    .select("id, code");
  const statusMap = new Map<string, string>();
  for (const s of statuses || []) statusMap.set(s.code as string, s.id as string);

  const today = new Date();
  // Önce orders insert et (id alacağız), sonra order_items
  const ordersPayload = dataset.orders.map((o, idx) => {
    const productData = dataset.products[o.product_index];
    const total = productData.unit_price * o.quantity;
    return {
      tenant_id: tenantId,
      order_number: `DEMO-${dataset.slug.toUpperCase()}-O${String(idx + 1).padStart(4, "0")}`,
      dealer_id: dealers[o.dealer_index]?.id,
      status_id: statusMap.get(o.status) || null,
      subtotal: total,
      discount_amount: 0,
      total_amount: total,
      created_at: new Date(today.getTime() - o.days_ago * 86400000).toISOString(),
    };
  });
  const { data: insertedOrders, error: oErr } = await supabase
    .from("bayi_orders")
    .insert(ordersPayload)
    .select("id");
  if (oErr) {
    console.warn(`[seed] orders insert hata: ${oErr.message}`);
  } else if (insertedOrders) {
    const itemsPayload = dataset.orders.map((o, idx) => {
      const productData = dataset.products[o.product_index];
      const total = productData.unit_price * o.quantity;
      return {
        tenant_id: tenantId,
        order_id: insertedOrders[idx]?.id,
        product_id: products[o.product_index]?.id,
        product_code: productData.code,
        product_name: productData.name,
        quantity: o.quantity,
        unit_price: productData.unit_price,
        total_price: total,
      };
    });
    const { error: itemsErr } = await supabase.from("bayi_order_items").insert(itemsPayload);
    if (itemsErr) console.warn(`[seed] order_items insert hata: ${itemsErr.message}`);
  }

  // 4a) Faturalar — minimal schema (id, tenant_id, dealer_id, invoice_number,
  // invoice_date, total_amount, created_at). due_date YOK; vade hareketi
  // bayi_dealer_transactions tablosunda tutuluyor.
  const baseInvoicePayload = dataset.invoices.map((inv, idx) => ({
    tenant_id: tenantId,
    dealer_id: dealers[inv.dealer_index]?.id,
    invoice_number: `DEMO-${dataset.slug.toUpperCase()}-${String(idx + 1).padStart(4, "0")}`,
    invoice_date: new Date(today.getTime() + inv.due_days_offset * 86400000).toISOString().slice(0, 10),
    total_amount: inv.amount,
  }));

  let iErr = (await supabase.from("bayi_dealer_invoices").insert(baseInvoicePayload)).error;
  if (iErr && /invoice_no\b|amount\b|paid_at|column/i.test(iErr.message || "")) {
    console.warn("[seed] invoice schema farkı — atlandı:", iErr.message);
    iErr = null;
  }
  if (iErr) {
    console.warn(`[seed] invoice insert hata (devam): ${iErr.message}`);
  }

  // 4b) Vade hareketleri — bayi_dealer_transactions (gerçek vade DB).
  // Schema: tenant_id, dealer_id, transaction_type_id (UUID FK), amount,
  //   description (NOT NULL), transaction_date (NOT NULL), due_date,
  //   reference_number, order_id, notes, created_at
  // bayi_transaction_types lookup: 'sale' = debit (bayi borçlanır).
  // Sale transaction.due_date = vade tarihi → list endpoint en eski overdue.
  const { data: txTypes } = await supabase
    .from("bayi_transaction_types")
    .select("id, code");
  const saleTypeId = (txTypes || []).find(t => t.code === "sale")?.id;

  if (saleTypeId) {
    const txPayload = dataset.invoices.map((inv, idx) => {
      const dueDate = new Date(today.getTime() + inv.due_days_offset * 86400000);
      // Satış tarihi vadenin önce olsun (örn 30 gün önce sale, 12 gün geçmiş due)
      const txDate = new Date(dueDate.getTime() - 30 * 86400000);
      return {
        tenant_id: tenantId,
        dealer_id: dealers[inv.dealer_index]?.id,
        transaction_type_id: saleTypeId,
        amount: inv.amount,
        description: `DEMO satış #${idx + 1} — ${dataset.slug}`,
        transaction_date: txDate.toISOString(),
        due_date: dueDate.toISOString().slice(0, 10),
        reference_number: `DEMO-${dataset.slug.toUpperCase()}-T${String(idx + 1).padStart(4, "0")}`,
      };
    });
    const { error: txErr } = await supabase.from("bayi_dealer_transactions").insert(txPayload);
    if (txErr) console.warn(`[seed] transactions insert hata (devam): ${txErr.message}`);
  } else {
    console.warn(`[seed] sale transaction_type bulunamadı — vade hareketleri atlandı`);
  }

  return {
    ok: true,
    sector: dataset.slug,
    summary: {
      products: products.length,
      dealers: dealers.length,
      orders: ordersPayload.length,
      invoices: baseInvoicePayload.length,
    },
  };
}
