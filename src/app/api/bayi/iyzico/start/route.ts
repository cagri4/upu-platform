/**
 * POST /api/bayi/iyzico/start — iyzico checkout başlat.
 *
 * body: { order_id }
 *
 * Akış:
 *   1. order_id'yi tenant + dealer guard ile çek
 *   2. iyzico initCheckout çağır (basketItems, buyer info, callback URL)
 *   3. bayi_payments satırı oluştur (provider=iyzico, checkout_url, pending)
 *   4. paymentPageUrl döner — frontend redirect eder
 *
 * iyzico config yoksa adapter mock URL döner; callback'te de mock token
 * geçerli işler. UI test edilebilir kalır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../../_auth";
import { initCheckout } from "@/platform/payment/iyzico";
import { resolveTenantOrigin } from "@/platform/tenant-origin";

export const dynamic = "force-dynamic";

interface StartBody {
  order_id?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId, displayName } = auth;

  const body = (await req.json().catch(() => ({}))) as StartBody;
  const orderId = (body.order_id || "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "order_id gerekli." }, { status: 400 });
  }

  // Dealer + sipariş guard
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id, name, company_name, address, city, region, phone, email")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!dealer) {
    return NextResponse.json({ error: "Bayi hesabı yok." }, { status: 400 });
  }

  const { data: order } = await sb
    .from("bayi_orders")
    .select(
      "id, order_number, total_amount, payment_status, dealer_id",
    )
    .eq("tenant_id", tenantId)
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.dealer_id !== dealer.id) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }
  if (order.payment_status === "paid") {
    return NextResponse.json({ error: "Sipariş zaten ödendi." }, { status: 400 });
  }

  // Sipariş kalemleri (basketItems)
  const { data: items } = await sb
    .from("bayi_order_items")
    .select("product_id, product_code, product_name, total_price, quantity, unit_price")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId);

  const basketItems = (items ?? []).map((it) => ({
    id: (it.product_id as string) || (it.product_code as string),
    name: (it.product_name as string) || (it.product_code as string),
    category: "Ürün",
    price: Number(it.total_price ?? 0),
  }));

  if (basketItems.length === 0) {
    return NextResponse.json({ error: "Sipariş kalemi yok." }, { status: 400 });
  }

  // Buyer info
  const dealerName = (dealer.company_name as string) || (dealer.name as string) || "Bayi";
  const [firstName, ...rest] = dealerName.split(/\s+/);
  const surname = rest.join(" ") || "—";

  // Tenant-aware origin: canonical_url > request host > env (trim'li).
  // APP_URL tek domain'e işaret ediyor — multi-tenant'ta yanlış SaaS'a
  // redirect üretirdi (audit 2026-06-10 P0 #1).
  const origin = await resolveTenantOrigin(sb, tenantId, req);
  const callbackUrl = `${origin}/api/bayi/iyzico/callback`;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const result = await initCheckout(sb, {
    tenantId,
    orderId: order.id as string,
    orderNumber: (order.order_number as string) || (order.id as string),
    total: Number(order.total_amount ?? 0),
    currency: "TRY",
    callbackUrl,
    buyer: {
      id: dealer.id as string,
      name: firstName || displayName || "Bayi",
      surname,
      email: (dealer.email as string) || "bayi@upudev.nl",
      phone: (dealer.phone as string) || undefined,
      registrationAddress: (dealer.address as string) || "Adres",
      city: (dealer.city as string) || (dealer.region as string) || "Istanbul",
      country: "Turkey",
      ip,
    },
    basketItems,
    conversationId: order.id as string,
  });

  if (result.status !== "success" || !result.paymentPageUrl || !result.token) {
    return NextResponse.json(
      { error: result.errorMessage || "iyzico başlatılamadı." },
      { status: 502 },
    );
  }

  // bayi_payments satırı oluştur veya güncelle
  const { data: existing } = await sb
    .from("bayi_payments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId)
    .eq("provider", "iyzico")
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    await sb
      .from("bayi_payments")
      .update({
        provider_payment_id: result.token,
        checkout_url: result.paymentPageUrl,
        metadata: { conversationId: result.conversationId, mocked: !!result.mocked },
      })
      .eq("tenant_id", tenantId)
      .eq("id", existing.id);
  } else {
    await sb.from("bayi_payments").insert({
      tenant_id: tenantId,
      dealer_user_id: userId,
      order_id: orderId,
      amount: Number(order.total_amount ?? 0),
      currency: "TRY",
      payment_date: new Date().toISOString().slice(0, 10),
      status: "pending",
      provider: "iyzico",
      provider_payment_id: result.token,
      checkout_url: result.paymentPageUrl,
      metadata: { conversationId: result.conversationId, mocked: !!result.mocked },
    });
  }

  // Sipariş payment_status = 'pending'
  await sb
    .from("bayi_orders")
    .update({ payment_status: "pending", payment_method: "card" })
    .eq("tenant_id", tenantId)
    .eq("id", orderId);

  return NextResponse.json({
    success: true,
    token: result.token,
    paymentPageUrl: result.paymentPageUrl,
    mocked: !!result.mocked,
  });
}
