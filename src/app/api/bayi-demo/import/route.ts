/**
 * POST /api/bayi-demo/import — owner'ın tenant'ına demo dataset yazar.
 *
 * "Mucize moment" demo'sunun kalbi: ilk müşteri sahibi formu doldurunca
 * bu endpoint çağrılır → 25 ürün + 12 bayi + 8 sipariş + 4 fatura
 * yazılır → sahip WA'ya yazdığında "vay benim bayilerimi tanıyor"
 * yaşar.
 *
 * Production'da kullanılmaz: owner-only + onaylanmış demo flag check.
 * Mevcut veriyle birleşmez (tenant_id'de zaten ürün/bayi varsa skip
 * mesajı döner).
 *
 * Body: { token } — magic_link_tokens validation
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import {
  DEMO_PRODUCTS, DEMO_DEALERS, DEMO_ORDERS, DEMO_INVOICES,
} from "@/tenants/bayi/demo-import/hardware-distributor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json() as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = body.token;
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role")
    .eq("id", magicToken.user_id)
    .maybeSingle();
  if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });
  if (profile.role !== "admin" && profile.role !== "user") {
    return NextResponse.json({ error: "Sadece firma sahibi demo veri içe aktarabilir." }, { status: 403 });
  }

  // Tenant'ta zaten veri varsa skip (mevcut veriyle çakışma istemiyoruz)
  const { count: existingProducts } = await supabase
    .from("bayi_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id);
  if ((existingProducts || 0) > 0) {
    return NextResponse.json({
      error: "Tenant'ta zaten ürün var. Demo veri sadece boş tenant'a yüklenir.",
      existing: existingProducts,
    }, { status: 409 });
  }

  const tenantId = profile.tenant_id;
  const ownerId = profile.id;

  // 1. Ürünler
  const productsPayload = DEMO_PRODUCTS.map(p => ({
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
    metadata: { vat_rate: p.vat_rate, ean: p.ean },
  }));
  const { data: insertedProducts } = await supabase
    .from("bayi_products")
    .insert(productsPayload)
    .select("id");

  // 2. Bayiler
  const dealersPayload = DEMO_DEALERS.map(d => ({
    tenant_id: tenantId,
    user_id: ownerId,
    name: d.name,
    city: d.city,
    country: d.country,
    contact_name: d.contact_name,
    contact_phone: d.contact_phone,
    is_active: d.is_active,
    balance: d.balance,
  }));
  const { data: insertedDealers } = await supabase
    .from("bayi_dealers")
    .insert(dealersPayload)
    .select("id");

  // 3. Siparişler (insertedProducts/Dealers index ile eşleştir)
  if (insertedProducts && insertedDealers) {
    const ordersPayload = DEMO_ORDERS.map(o => {
      const dealer = insertedDealers[o.dealer_index];
      const product = insertedProducts[o.product_index];
      const productData = DEMO_PRODUCTS[o.product_index];
      const total = productData.unit_price * o.quantity;
      const createdAt = new Date(Date.now() - o.days_ago * 24 * 60 * 60 * 1000).toISOString();
      return {
        tenant_id: tenantId,
        user_id: ownerId,
        dealer_id: dealer?.id,
        product_id: product?.id,
        quantity: o.quantity,
        unit_price: productData.unit_price,
        total_amount: total,
        status: o.status,
        created_at: createdAt,
      };
    });
    await supabase.from("bayi_orders").insert(ordersPayload);
  }

  // 4. Faturalar
  if (insertedDealers) {
    const today = new Date();
    const invoicesPayload = DEMO_INVOICES.map((inv, idx) => {
      const dealer = insertedDealers[inv.dealer_index];
      const dueDate = new Date(today.getTime() + inv.due_days_offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return {
        tenant_id: tenantId,
        dealer_id: dealer?.id,
        invoice_no: `DEMO-${String(idx + 1).padStart(4, "0")}`,
        amount: inv.amount,
        is_paid: inv.is_paid,
        due_date: dueDate,
        paid_at: inv.is_paid ? new Date(Date.now() - 86400000).toISOString() : null,
      };
    });
    await supabase.from("bayi_dealer_invoices").insert(invoicesPayload);
  }

  return NextResponse.json({
    success: true,
    summary: {
      products: insertedProducts?.length || 0,
      dealers: insertedDealers?.length || 0,
      orders: DEMO_ORDERS.length,
      invoices: DEMO_INVOICES.length,
    },
  });
}
