/**
 * POST /api/bayi/siparisler/[id]/tekrar — eski siparişi yeni sepete kopyala.
 *
 * Akış:
 *   1. Sipariş tenant + dealer guard
 *   2. Kalemleri al; aktif olmayan ürünleri ele
 *   3. Açık sepete merge (aynı ürün varsa miktar arttır)
 *   4. Cevap: kaç ürün eklendi, skip edilen ürünler
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;
  const { id } = await params;

  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!dealer) {
    return NextResponse.json({ error: "Bayi hesabı yok." }, { status: 400 });
  }
  const dealerId = dealer.id as string;

  const { data: order } = await sb
    .from("bayi_orders")
    .select("id, dealer_id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!order || order.dealer_id !== dealerId) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  const { data: items } = await sb
    .from("bayi_order_items")
    .select("product_id, quantity")
    .eq("tenant_id", tenantId)
    .eq("order_id", id);

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Sipariş kalemi yok." }, { status: 400 });
  }

  // Aktif ürünleri filtrele
  const productIds = Array.from(
    new Set(
      items
        .map((it) => it.product_id as string | null)
        .filter((x): x is string => !!x),
    ),
  );
  const { data: prods } = await sb
    .from("bayi_products")
    .select("id, base_price")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("id", productIds);
  const activeProducts = new Map<string, number>();
  (prods ?? []).forEach((p) =>
    activeProducts.set(p.id as string, Number(p.base_price ?? 0)),
  );

  // Açık sepeti bul / oluştur
  let cartId: string;
  const { data: cart } = await sb
    .from("bayi_carts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (cart) {
    cartId = cart.id as string;
  } else {
    const { data: created } = await sb
      .from("bayi_carts")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        dealer_id: dealerId,
        status: "open",
      })
      .select("id")
      .single();
    if (!created) {
      return NextResponse.json({ error: "Sepet oluşturulamadı." }, { status: 500 });
    }
    cartId = created.id as string;
  }

  const skipped: string[] = [];
  let added = 0;

  for (const it of items) {
    const pid = it.product_id as string | null;
    if (!pid) continue;
    if (!activeProducts.has(pid)) {
      skipped.push(pid);
      continue;
    }
    const qty = Number(it.quantity ?? 1);
    const { data: existing } = await sb
      .from("bayi_cart_items")
      .select("id, quantity")
      .eq("tenant_id", tenantId)
      .eq("cart_id", cartId)
      .eq("product_id", pid)
      .maybeSingle();
    if (existing) {
      await sb
        .from("bayi_cart_items")
        .update({ quantity: Number(existing.quantity) + qty })
        .eq("tenant_id", tenantId)
        .eq("id", existing.id);
    } else {
      await sb.from("bayi_cart_items").insert({
        tenant_id: tenantId,
        cart_id: cartId,
        product_id: pid,
        quantity: qty,
        unit_price: activeProducts.get(pid) ?? 0,
      });
    }
    added += 1;
  }

  await sb
    .from("bayi_carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", cartId);

  return NextResponse.json({
    success: true,
    cartId,
    added,
    skipped: skipped.length,
  });
}
