/**
 * POST /api/bayi-dealer-orders/create
 *
 * Bayi sepetinden yeni sipariş — pending status. Bayi sadece kendi adına
 * sipariş ekler. Admin tarafı /api/bayi-orders/confirm ile onaylar.
 *
 * Body: {
 *   items: [{ product_id?, product_name, unit_price, quantity }],
 *   notes?
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { notifyAdminsNewOrder } from "@/platform/bayi-orders/notify";
import { checkCreditLimit } from "@/platform/bayi-finansal/credit-limit";

export const dynamic = "force-dynamic";

interface ItemInput {
  product_id?: string | null;
  product_name?: string;
  unit_price?: number;
  quantity?: number;
}

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostTenant = getTenantByDomain(host);
  if (hostTenant?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde kullanılır." }, { status: 400 });
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    display_name: string | null;
    metadata: Record<string, unknown> | null;
    whatsapp_phone: string | null;
    email: string | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, display_name, metadata, whatsapp_phone, email",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  let body: { items?: ItemInput[]; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "En az bir ürün ekleyin." }, { status: 400 });
  }

  // Validate + line_total hesapla
  const cleanItems = items.map((it) => {
    const name = (it.product_name || "").trim().slice(0, 200);
    const price = Number(it.unit_price) || 0;
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 0));
    return {
      product_id: it.product_id || null,
      product_name: name,
      unit_price: price,
      quantity: qty,
      line_total: Math.round(price * qty * 100) / 100,
    };
  }).filter((it) => it.product_name && it.unit_price > 0 && it.quantity > 0);

  if (cleanItems.length === 0) {
    return NextResponse.json({ error: "Geçerli ürün satırı yok." }, { status: 400 });
  }

  const total = cleanItems.reduce((s, it) => s + it.line_total, 0);

  const credit = await checkCreditLimit(sb, {
    tenantId: lookup.tenantId,
    profileId: lookup.profile.id,
    profile: {
      whatsapp_phone: lookup.profile.whatsapp_phone,
      email: lookup.profile.email,
    },
    attemptedTotal: total,
  });
  if (credit.status === "exceeded") {
    return NextResponse.json(
      {
        error: "credit_limit_exceeded",
        message: `Kredi limitiniz aşıldı. Mevcut bakiye ${credit.currentBalance.toLocaleString("tr-TR")} ₺, sipariş tutarı ${total.toLocaleString("tr-TR")} ₺, limit ${(credit.creditLimit ?? 0).toLocaleString("tr-TR")} ₺. ${credit.exceededBy.toLocaleString("tr-TR")} ₺ aşım var — sipariş tutarını düşürün veya yöneticinize başvurun.`,
        current_balance: credit.currentBalance,
        attempted_total: credit.attemptedTotal,
        credit_limit: credit.creditLimit,
        exceeded_by: credit.exceededBy,
      },
      { status: 409 },
    );
  }

  const { data: order, error: insertErr } = await sb
    .from("bayi_dealer_orders")
    .insert({
      tenant_id: lookup.tenantId,
      dealer_user_id: lookup.profile.id,
      status: "pending",
      total_amount: total,
      notes: body.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (insertErr || !order) {
    console.error("[bayi-dealer-orders/create]", insertErr);
    return NextResponse.json({ error: "Sipariş oluşturulamadı." }, { status: 500 });
  }

  const { error: itemsErr } = await sb
    .from("bayi_dealer_order_items")
    .insert(cleanItems.map((it) => ({ ...it, order_id: order.id })));
  if (itemsErr) {
    console.error("[bayi-dealer-orders/create] items err:", itemsErr);
    // Items başarısız → order'ı sil (atomic değil ama RDB'de cascade DELETE)
    await sb.from("bayi_dealer_orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Sipariş ürünleri kaydedilemedi." }, { status: 500 });
  }

  await sb.from("bayi_dealer_order_status_history").insert({
    order_id: order.id,
    old_status: null,
    new_status: "pending",
    changed_by_user_id: lookup.profile.id,
  });

  // Admin'lere bildirim (best-effort)
  const meta = (lookup.profile.metadata as Record<string, unknown>) || {};
  const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
  const dealerName = firma?.ticari_unvan || lookup.profile.display_name || "Bayi";
  void notifyAdminsNewOrder(sb, lookup.tenantId, order.id, dealerName, total);

  return NextResponse.json({ ok: true, order_id: order.id, total });
}
