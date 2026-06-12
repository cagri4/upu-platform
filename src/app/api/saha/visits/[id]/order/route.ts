/**
 * POST /api/saha/visits/[id]/order — ziyaret sırasında bayi adına sipariş al.
 *   body: { lines: [{ product_id, quantity }], note?, payment_method? }
 *
 * Sipariş ziyaretin bayisi (dealer) adına oluşturulur. Birim fiyatlar
 * sunucuda yeniden hesaplanır (resolveDealerPrice) — mobil manipülasyona
 * karşı. bayi_orders.visit_id + bayi_visit_orders linki yazılır. Faz 4 olay
 * motoru "yeni sipariş" bildirimini tetikler (dağıtıcıya + bayiye).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSahaAuth } from "../../../_auth";
import { resolveDealerPrice } from "@/platform/bayi/resolve-dealer-price";
import { resolveCampaignsFor, type CartLine } from "@/platform/bayi/resolve-campaigns";

export const dynamic = "force-dynamic";

const PAYMENT_METHODS = ["card", "transfer", "open_account"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
const MAX_LINE_QTY = 100000;

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface OrderBody {
  lines?: Array<{ product_id?: string; quantity?: number | string }>;
  note?: string;
  payment_method?: string;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getSahaAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId, salesRepId } = auth;
  const { id: visitId } = await params;

  // Ziyaret elemana + tenant'a ait mi
  const { data: visit } = await sb
    .from("bayi_visits")
    .select("id, dealer_id")
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", salesRepId)
    .eq("id", visitId)
    .maybeSingle();
  if (!visit) return NextResponse.json({ error: "Ziyaret bulunamadı." }, { status: 404 });
  const dealerId = visit.dealer_id as string;

  const body = (await req.json().catch(() => ({}))) as OrderBody;
  const lineInput = Array.isArray(body.lines) ? body.lines : [];
  if (lineInput.length === 0) {
    return NextResponse.json({ error: "Sipariş satırı yok." }, { status: 400 });
  }

  const paymentMethod = (body.payment_method || "open_account") as PaymentMethod;
  if (!(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
    return NextResponse.json({ error: "Geçersiz ödeme yöntemi." }, { status: 400 });
  }

  const productIds = Array.from(
    new Set(lineInput.map((l) => (l.product_id || "").trim()).filter((x) => x)),
  );
  const { data: prods } = await sb
    .from("bayi_products")
    .select("id, code, name, base_price, is_active, category_id")
    .eq("tenant_id", tenantId)
    .in("id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);

  type ProdRow = {
    id: string; code: string; name: string; base_price: number;
    is_active: boolean; category_id: string | null;
  };
  const prodMap = new Map<string, ProdRow>();
  ((prods ?? []) as ProdRow[]).forEach((p) => prodMap.set(p.id, p));

  const cartLines: CartLine[] = [];
  const itemRows: Array<{
    product_id: string; product_code: string; product_name: string;
    quantity: number; unit_price: number; total_price: number;
    line_discount: number; campaign_id: string | null;
  }> = [];
  let subtotal = 0;

  for (const l of lineInput) {
    const pid = (l.product_id || "").trim();
    const rawQty = Number(l.quantity ?? 1);
    if (!Number.isFinite(rawQty)) {
      return NextResponse.json({ error: "Geçersiz miktar." }, { status: 400 });
    }
    const qty = Math.floor(rawQty);
    if (qty < 1) return NextResponse.json({ error: "Miktar en az 1 olmalı." }, { status: 400 });
    if (qty > MAX_LINE_QTY) {
      return NextResponse.json(
        { error: `Miktar çok yüksek (satır başına en fazla ${MAX_LINE_QTY}).` },
        { status: 400 },
      );
    }
    const p = prodMap.get(pid);
    if (!p || !p.is_active) continue;

    const resolved = await resolveDealerPrice(sb, { tenantId, dealerId, productId: pid, quantity: qty });
    const unitPrice = resolved ? resolved.finalPrice : Number(p.base_price);
    const lineSubtotal = unitPrice * qty;
    subtotal += lineSubtotal;

    cartLines.push({ productId: pid, quantity: qty, unitPrice, categoryId: p.category_id });
    itemRows.push({
      product_id: pid, product_code: p.code, product_name: p.name,
      quantity: qty, unit_price: unitPrice, total_price: lineSubtotal,
      line_discount: 0, campaign_id: null,
    });
  }

  if (itemRows.length === 0) {
    return NextResponse.json({ error: "Geçerli ürün yok." }, { status: 400 });
  }

  const campResult = await resolveCampaignsFor(sb, {
    tenantId, dealerId, cart: cartLines, couponCode: null,
  });
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

  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { count: monthly } = await sb
    .from("bayi_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const seq = String((monthly ?? 0) + 1).padStart(4, "0");
  const orderNumber = `${ym}-${seq}`;

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
      notes: body.note?.trim() || `Saha siparişi (${auth.repName})`,
      visit_id: visitId,
    })
    .select("id, order_number")
    .single();
  if (orderErr || !order) {
    console.error("[saha:order:create]", orderErr);
    return NextResponse.json({ error: "Sipariş kaydedilemedi." }, { status: 500 });
  }
  const orderId = order.id as string;

  const { error: itemsErr } = await sb.from("bayi_order_items").insert(
    itemRows.map((it) => ({
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
    })),
  );
  if (itemsErr) {
    console.error("[saha:order:items]", itemsErr);
    return NextResponse.json({ error: "Kalemler kaydedilemedi." }, { status: 500 });
  }

  // Ziyaret ↔ sipariş linki
  await sb.from("bayi_visit_orders").insert({ tenant_id: tenantId, visit_id: visitId, order_id: orderId });

  // Audit
  await sb.from("bayi_order_status_history").insert({
    tenant_id: tenantId,
    order_id: orderId,
    from_status: null,
    to_status: "pending",
    reason: `Saha siparişi — ${auth.repName} (ziyaret ${visitId.slice(0, 8)})`,
    changed_by_profile_id: profileId,
  });

  // Faz 4: yeni sipariş bildirimi (dağıtıcıya + bayiye)
  try {
    const { emitOrderEvent } = await import("@/platform/bayi/events/dispatcher");
    await emitOrderEvent(sb, { tenantId, orderId, kind: "created" });
  } catch (err) {
    console.error("[saha:order:event]", err);
  }

  return NextResponse.json({
    success: true,
    orderId,
    orderNumber: order.order_number as string,
    finalTotal,
  });
}
