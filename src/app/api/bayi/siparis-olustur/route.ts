/**
 * POST /api/bayi/siparis-olustur — yeni sipariş yarat.
 *
 * body: {
 *   lines: [{ product_id, quantity, unit_price }],
 *   payment_method: 'card' | 'transfer' | 'open_account',
 *   delivery_address?: string,
 *   notes?: string,
 *   coupon_code?: string,
 *   clear_cart?: boolean  // varsayılan true
 * }
 *
 * Pipeline:
 *   1. Cart line'larını al, resolveDealerPrice ile birim fiyatları yeniden
 *      hesapla (frontend manipülasyonuna karşı)
 *   2. resolveCampaignsFor ile uygulanan kampanyaları al (toplam indirim)
 *   3. bayi_orders insert (status='pending', order_number üret)
 *   4. bayi_order_items insert (campaign_id varsa yaz)
 *   5. bayi_order_status_history audit
 *   6. clear_cart ise bayi_carts.status='checked_out'
 *
 * Faz 4'te WA bildirim wiring buraya hook olur (dağıtıcıya "yeni sipariş geldi").
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";
import { resolveDealerPrice } from "@/platform/bayi/resolve-dealer-price";
import { resolveCampaignsFor, type CartLine } from "@/platform/bayi/resolve-campaigns";

export const dynamic = "force-dynamic";

const PAYMENT_METHODS = ["card", "transfer", "open_account"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

interface OrderBody {
  lines?: Array<{ product_id?: string; quantity?: number | string }>;
  payment_method?: string;
  delivery_address?: string;
  notes?: string;
  coupon_code?: string;
  clear_cart?: boolean;
}

export async function POST(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as OrderBody;
  const lineInput = Array.isArray(body.lines) ? body.lines : [];

  if (lineInput.length === 0) {
    return NextResponse.json({ error: "Sepet boş." }, { status: 400 });
  }

  const paymentMethod = (body.payment_method || "transfer") as PaymentMethod;
  if (!(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
    return NextResponse.json({ error: "Geçersiz ödeme yöntemi." }, { status: 400 });
  }

  // Dealer şart — sipariş bir bayi adına oluşur
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id, name, company_name, address")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!dealer) {
    return NextResponse.json(
      {
        error:
          "Sipariş için bayi hesabı gerekli. Dağıtıcına seni bayi olarak eklemesini iste.",
      },
      { status: 400 },
    );
  }
  const dealerId = dealer.id as string;

  // Ürünler tenant'a ait + aktif kontrolü ve birim fiyat yeniden hesaplama
  const productIds = Array.from(
    new Set(lineInput.map((l) => l.product_id || "").filter((x) => x)),
  );
  const { data: prods } = await sb
    .from("bayi_products")
    .select("id, code, name, base_price, stock_quantity, is_active, category_id")
    .eq("tenant_id", tenantId)
    .in("id", productIds);

  type ProdRow = {
    id: string;
    code: string;
    name: string;
    base_price: number;
    stock_quantity: number;
    is_active: boolean;
    category_id: string | null;
  };
  const prodMap = new Map<string, ProdRow>();
  ((prods ?? []) as ProdRow[]).forEach((p) => prodMap.set(p.id, p));

  const cartLines: CartLine[] = [];
  const itemRows: Array<{
    product_id: string;
    product_code: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    line_discount: number;
    campaign_id: string | null;
    category_id: string | null;
  }> = [];

  let subtotal = 0;

  for (const l of lineInput) {
    const pid = (l.product_id || "").trim();
    const qty = Math.max(1, Math.floor(Number(l.quantity ?? 1)));
    const p = prodMap.get(pid);
    if (!p || !p.is_active) continue;

    const resolved = await resolveDealerPrice(sb, {
      tenantId,
      dealerId,
      productId: pid,
      quantity: qty,
    });
    const unitPrice = resolved ? resolved.finalPrice : Number(p.base_price);

    const lineSubtotal = unitPrice * qty;
    subtotal += lineSubtotal;

    cartLines.push({
      productId: pid,
      quantity: qty,
      unitPrice,
      categoryId: p.category_id,
    });
    itemRows.push({
      product_id: pid,
      product_code: p.code,
      product_name: p.name,
      quantity: qty,
      unit_price: unitPrice,
      total_price: lineSubtotal,
      line_discount: 0,
      campaign_id: null,
      category_id: p.category_id,
    });
  }

  if (itemRows.length === 0) {
    return NextResponse.json({ error: "Geçerli ürün yok." }, { status: 400 });
  }

  // Kampanyaları çöz — toplam üzerinden + line-level mapping basit
  const campResult = await resolveCampaignsFor(sb, {
    tenantId,
    dealerId,
    cart: cartLines,
    couponCode: body.coupon_code ?? null,
  });

  // Indirimi orantılı olarak satırlara dağıt (kalem-level kampanya
  // attribution Faz 3'te detaylanır)
  const totalDiscount = campResult.totalDiscount;
  if (totalDiscount > 0 && itemRows.length > 0) {
    const firstCampId = campResult.appliedCampaigns[0]?.campaignId ?? null;
    itemRows.forEach((row) => {
      const share = subtotal > 0 ? (row.total_price / subtotal) * totalDiscount : 0;
      row.line_discount = +share.toFixed(2);
      row.campaign_id = firstCampId;
    });
  }

  const finalTotal = +(subtotal - totalDiscount).toFixed(2);

  // Order number üret: YIL+AY+seri (basit, tenant başına ay başında sıfırlanır)
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { count: monthly } = await sb
    .from("bayi_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const seq = String((monthly ?? 0) + 1).padStart(4, "0");
  const orderNumber = `${ym}-${seq}`;

  // Sipariş oluştur
  const { data: order, error: orderErr } = await sb
    .from("bayi_orders")
    .insert({
      tenant_id: tenantId,
      dealer_id: dealerId,
      order_number: orderNumber,
      status: "pending",
      subtotal,
      discount_amount: totalDiscount,
      total_amount: finalTotal,
      coupon_code: body.coupon_code ?? null,
      notes: body.notes ?? null,
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    console.error("[bayi:siparis-olustur:order]", orderErr);
    return NextResponse.json({ error: "Sipariş kaydedilemedi." }, { status: 500 });
  }
  const orderId = order.id as string;

  // Kalemler
  const itemPayload = itemRows.map((it) => ({
    tenant_id: tenantId,
    order_id: orderId,
    product_id: it.product_id,
    product_code: it.product_code,
    product_name: it.product_name,
    quantity: it.quantity,
    unit_price: it.unit_price,
    total_price: it.total_price,
    line_discount: it.line_discount,
    campaign_id: it.campaign_id,
  }));
  const { error: itemsErr } = await sb.from("bayi_order_items").insert(itemPayload);
  if (itemsErr) {
    console.error("[bayi:siparis-olustur:items]", itemsErr);
    return NextResponse.json({ error: "Kalemler kaydedilemedi." }, { status: 500 });
  }

  // Audit
  await sb.from("bayi_order_status_history").insert({
    tenant_id: tenantId,
    order_id: orderId,
    from_status: null,
    to_status: "pending",
    reason: `Bayi siparişi oluşturuldu (${paymentMethod})`,
    changed_by_profile_id: profileId,
  });

  // Sepeti kapat (varsayılan true)
  if (body.clear_cart !== false) {
    await sb
      .from("bayi_carts")
      .update({ status: "checked_out", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("status", "open");
  }

  // Faz 4: sipariş oluşturuldu olayı — bayiye "alındı" + dağıtıcıya
  // "yeni sipariş geldi" bildirimi (mock/canlı, dispatcher karar verir).
  try {
    const { emitOrderEvent } = await import("@/platform/bayi/events/dispatcher");
    await emitOrderEvent(sb, { tenantId, orderId, kind: "created" });
  } catch (err) {
    console.error("[siparis-olustur:event]", err);
  }

  return NextResponse.json({
    success: true,
    orderId,
    orderNumber: order.order_number as string,
    subtotal,
    totalDiscount,
    finalTotal,
    paymentMethod,
    appliedCampaigns: campResult.appliedCampaigns,
  });
}
