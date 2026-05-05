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

  // 3) Siparişler
  const ordersPayload = dataset.orders.map(o => {
    const productData = dataset.products[o.product_index];
    const total = productData.unit_price * o.quantity;
    const createdAt = new Date(Date.now() - o.days_ago * 86400000).toISOString();
    return {
      tenant_id: tenantId,
      user_id: ownerId,
      dealer_id: dealers[o.dealer_index]?.id,
      product_id: products[o.product_index]?.id,
      quantity: o.quantity,
      unit_price: productData.unit_price,
      total_amount: total,
      status: o.status,
      created_at: createdAt,
    };
  });
  const { error: oErr } = await supabase.from("bayi_orders").insert(ordersPayload);
  if (oErr) {
    return { ok: false, reason: `Sipariş insert hatası: ${oErr.message}`, sector: dataset.slug };
  }

  // 4) Vade hareketleri (faturalar) — defensive insert.
  // bayi_dealer_invoices schema'sında paid_at kolonu farklı ortamlarda
  // var/yok olabilir (mark-paid endpoint'i de fallback yapıyor). Önce
  // paid_at'li dene; "column ... does not exist" hatasında retry.
  const today = new Date();
  const baseInvoicePayload = dataset.invoices.map((inv, idx) => ({
    tenant_id: tenantId,
    dealer_id: dealers[inv.dealer_index]?.id,
    invoice_no: `DEMO-${dataset.slug.toUpperCase()}-${String(idx + 1).padStart(4, "0")}`,
    amount: inv.amount,
    is_paid: inv.is_paid,
    due_date: new Date(today.getTime() + inv.due_days_offset * 86400000).toISOString().slice(0, 10),
  }));
  const withPaidAt = baseInvoicePayload.map((p, i) => ({
    ...p,
    paid_at: dataset.invoices[i].is_paid ? new Date(Date.now() - 86400000).toISOString() : null,
  }));

  let iErr = (await supabase.from("bayi_dealer_invoices").insert(withPaidAt)).error;
  if (iErr && /paid_at|column/i.test(iErr.message || "")) {
    console.warn("[seed] paid_at kolonu yok — retry without paid_at");
    iErr = (await supabase.from("bayi_dealer_invoices").insert(baseInvoicePayload)).error;
  }
  if (iErr) {
    return { ok: false, reason: `Vade insert hatası: ${iErr.message}`, sector: dataset.slug };
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
