/**
 * POST /api/r/[slug]/orders
 *
 * Public B2C sipariş oluştur. Akış:
 *   1. Slug validate → rst_restaurants lookup (published only)
 *   2. Body validate (items + delivery + payment)
 *   3. Re-compute server-side: subtotal + delivery_fee + total
 *      (client'a güvenme — fiyatlar DB'den)
 *   4. order_number üret: #YYMMDD-XXXX (random hex)
 *   5. rst_b2c_orders INSERT (status: pending_payment, payment_status: pending)
 *   6. Mollie ödeme gerekiyorsa createOrderPayment → checkoutUrl
 *      Yoksa (kapıda/masada öderim) order.status = 'received' direkt
 *   7. Return: { orderId, orderNumber, checkoutUrl? }
 *
 * Auth: anon. RLS rst_b2c_orders INSERT policy is_published filter ediyor.
 * Brute-force: order ID UUID v4 (cryptographic), order_number random.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getRestaurantBySlug } from "@/tenants/restoran/b2c/restaurant-resolver";
import { createOrderPayment } from "@/platform/mollie/restoran-payments";

export const dynamic = "force-dynamic";

interface IncomingItem {
  menu_item_id: string;
  name: string;
  variant: { id: string; name: string; price_diff: number } | null;
  addons: Array<{ id: string; name: string; price: number }>;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string | null;
}

interface IncomingBody {
  items: IncomingItem[];
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_type: "delivery" | "pickup" | "dine_in";
  delivery_address: Record<string, string | null> | null;
  payment_method: "ideal" | "card" | "cash_on_delivery" | "card_on_delivery" | "dine_in_later";
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  table_qr_token?: string | null;  // Sprint 3 D4 — QR'dan gelen masa
}

function makeOrderNumber(): string {
  const now = new Date();
  const ymd = `${String(now.getFullYear() % 100).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, "0");
  return `${ymd}-${rand}`;
}

function isOnlinePayment(method: IncomingBody["payment_method"]): boolean {
  return method === "ideal" || method === "card";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ error: "Restoran bulunamadı." }, { status: 404 });
    }

    const body = (await req.json()) as IncomingBody;

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Sepet boş." }, { status: 400 });
    }
    if (!body.customer_name || body.customer_name.trim().length < 2) {
      return NextResponse.json({ error: "Ad soyad gerekli." }, { status: 400 });
    }
    if (!body.customer_phone || !/^[+\d\s()-]{7,}$/.test(body.customer_phone.trim())) {
      return NextResponse.json({ error: "Geçerli telefon gerekli." }, { status: 400 });
    }
    if (!["delivery", "pickup", "dine_in"].includes(body.delivery_type)) {
      return NextResponse.json({ error: "Teslimat tipi geçersiz." }, { status: 400 });
    }
    if (body.delivery_type === "delivery" && !body.delivery_address) {
      return NextResponse.json({ error: "Adres gerekli." }, { status: 400 });
    }
    if (body.delivery_type === "dine_in" && !restaurant.accepts_dine_in) {
      return NextResponse.json({ error: "Bu restoran masa siparişi kabul etmiyor." }, { status: 400 });
    }
    if (isOnlinePayment(body.payment_method) && !restaurant.accepts_online_payment) {
      return NextResponse.json({ error: "Bu restoran online ödeme kabul etmiyor." }, { status: 400 });
    }
    if (
      (body.payment_method === "cash_on_delivery" || body.payment_method === "card_on_delivery") &&
      !restaurant.accepts_cash_on_delivery
    ) {
      return NextResponse.json({ error: "Bu restoran kapıda ödeme kabul etmiyor." }, { status: 400 });
    }
    if (body.payment_method === "dine_in_later" && body.delivery_type !== "dine_in") {
      return NextResponse.json({ error: "Masada ödeme sadece masa siparişlerinde." }, { status: 400 });
    }

    // Server-side fiyat doğrulama — client'a güvenme
    const sb = getServiceClient();
    const itemIds = Array.from(new Set(body.items.map((i) => i.menu_item_id)));
    const { data: dbItems } = await sb
      .from("rst_menu_items")
      .select("id, name, price, is_active, is_available, restaurant_id")
      .in("id", itemIds);

    const dbItemMap = new Map((dbItems || []).map((r) => [r.id as string, r]));

    // Tüm ürünler aynı restoran'a ait olmalı + active + available
    for (const it of body.items) {
      const dbItem = dbItemMap.get(it.menu_item_id);
      if (!dbItem) {
        return NextResponse.json({ error: `Ürün bulunamadı: ${it.name}` }, { status: 400 });
      }
      if (dbItem.restaurant_id !== restaurant.id) {
        return NextResponse.json({ error: "Ürün bu restorana ait değil." }, { status: 400 });
      }
      if (!dbItem.is_active || !dbItem.is_available) {
        return NextResponse.json({ error: `${dbItem.name} şu an mevcut değil.` }, { status: 400 });
      }
      if (it.quantity < 1 || it.quantity > 50) {
        return NextResponse.json({ error: "Adet 1-50 arasında olmalı." }, { status: 400 });
      }
    }

    // Re-compute subtotal — variant ve addon fiyatlarını DB'den doğrula
    // Variant + addon DB'den çek (idempotent fiyat doğrulama)
    const variantIds = body.items
      .map((i) => i.variant?.id)
      .filter((x): x is string => Boolean(x));
    const addonIds = body.items.flatMap((i) => i.addons.map((a) => a.id));

    const [variantRes, addonRes] = await Promise.all([
      variantIds.length > 0
        ? sb.from("rst_menu_variants").select("id, menu_item_id, name, price_diff").in("id", variantIds)
        : Promise.resolve({ data: [] as { id: string; menu_item_id: string; name: string; price_diff: number }[] }),
      addonIds.length > 0
        ? sb.from("rst_menu_addons").select("id, menu_item_id, name, price").in("id", addonIds)
        : Promise.resolve({ data: [] as { id: string; menu_item_id: string; name: string; price: number }[] }),
    ]);
    const variantMap = new Map((variantRes.data || []).map((v) => [v.id, v]));
    const addonMap = new Map((addonRes.data || []).map((a) => [a.id, a]));

    let serverSubtotal = 0;
    const verifiedItems: Array<{
      menu_item_id: string;
      name: string;
      variant_id: string | null;
      variant_name: string | null;
      addons: Array<{ id: string; name: string; price: number }>;
      quantity: number;
      unit_price: number;
      total: number;
      notes: string | null;
    }> = [];

    for (const it of body.items) {
      const dbItem = dbItemMap.get(it.menu_item_id)!;
      let unit = Number(dbItem.price) || 0;

      let variantName: string | null = null;
      if (it.variant) {
        const dbVar = variantMap.get(it.variant.id);
        if (!dbVar || dbVar.menu_item_id !== dbItem.id) {
          return NextResponse.json({ error: `Varyant geçersiz: ${it.name}` }, { status: 400 });
        }
        unit += Number(dbVar.price_diff) || 0;
        variantName = dbVar.name;
      }

      const verifiedAddons: Array<{ id: string; name: string; price: number }> = [];
      for (const a of it.addons) {
        const dbAd = addonMap.get(a.id);
        if (!dbAd || dbAd.menu_item_id !== dbItem.id) {
          return NextResponse.json({ error: `Ekstra geçersiz: ${it.name}` }, { status: 400 });
        }
        const adPrice = Number(dbAd.price) || 0;
        unit += adPrice;
        verifiedAddons.push({ id: dbAd.id, name: dbAd.name, price: adPrice });
      }

      const lineTotal = Math.round(unit * it.quantity * 100) / 100;
      serverSubtotal += lineTotal;

      verifiedItems.push({
        menu_item_id: dbItem.id,
        name: dbItem.name,
        variant_id: it.variant?.id || null,
        variant_name: variantName,
        addons: verifiedAddons,
        quantity: it.quantity,
        unit_price: Math.round(unit * 100) / 100,
        total: lineTotal,
        notes: (it.notes || "").substring(0, 200) || null,
      });
    }

    serverSubtotal = Math.round(serverSubtotal * 100) / 100;

    // Delivery fee — basit: ilk zone fee (gerçek postal-match V2)
    let serverDeliveryFee = 0;
    if (body.delivery_type === "delivery" && Array.isArray(restaurant.delivery_zones) && restaurant.delivery_zones.length > 0) {
      const zone = restaurant.delivery_zones[0];
      if (zone.min_order && serverSubtotal < zone.min_order) {
        return NextResponse.json({ error: `Eve teslimat için minimum sipariş €${zone.min_order}` }, { status: 400 });
      }
      serverDeliveryFee = Number(zone.fee) || 0;
    }

    const serverTotal = Math.round((serverSubtotal + serverDeliveryFee) * 100) / 100;

    // Masa QR token → table_id resolve (Sprint 3 D4)
    let tableId: string | null = null;
    let orderSource: "web" | "qr" = "web";
    if (body.table_qr_token) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.table_qr_token)) {
        return NextResponse.json({ error: "Geçersiz masa token." }, { status: 400 });
      }
      const { data: tableRow } = await sb
        .from("rst_tables")
        .select("id, restaurant_id, is_active")
        .eq("qr_token", body.table_qr_token)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();
      if (!tableRow || !tableRow.is_active) {
        return NextResponse.json({ error: "Masa bulunamadı." }, { status: 400 });
      }
      tableId = tableRow.id as string;
      orderSource = "qr";
      // Masa siparişlerinde delivery_type=dine_in zorunlu (cart-view bunu zaten lock'luyor)
      if (body.delivery_type !== "dine_in") {
        return NextResponse.json({ error: "Masa siparişlerinde teslimat masa olmalı." }, { status: 400 });
      }
    }

    // Order INSERT
    const orderNumber = makeOrderNumber();
    const estimatedReadyAt = new Date(Date.now() + (restaurant.estimated_prep_minutes || 30) * 60_000).toISOString();

    const { data: newOrder, error: insertErr } = await sb
      .from("rst_b2c_orders")
      .insert({
        tenant_id: restaurant.tenant_id,
        restaurant_id: restaurant.id,
        order_number: orderNumber,
        customer_name: body.customer_name.trim(),
        customer_phone: body.customer_phone.trim(),
        customer_email: body.customer_email?.trim() || null,
        delivery_type: body.delivery_type,
        delivery_address: body.delivery_address,
        table_id: tableId,
        items: verifiedItems,
        notes: body.notes?.trim().substring(0, 300) || null,
        subtotal: serverSubtotal,
        delivery_fee: serverDeliveryFee,
        total: serverTotal,
        status: "pending_payment",
        payment_method: body.payment_method,
        payment_status: "pending",
        source: orderSource,
        estimated_ready_at: estimatedReadyAt,
      })
      .select("id")
      .single();

    if (insertErr || !newOrder) {
      console.error("[restoran/orders] insert error", insertErr);
      return NextResponse.json({ error: "Sipariş kaydedilemedi." }, { status: 500 });
    }

    const orderId = newOrder.id as string;

    // Mollie ödeme gerekli mi?
    if (isOnlinePayment(body.payment_method)) {
      try {
        const payment = await createOrderPayment({
          orderId,
          orderNumber,
          restaurantSlug: slug,
          amountEur: serverTotal,
          description: `${restaurant.brand_name} — Sipariş #${orderNumber}`,
          customerEmail: body.customer_email?.trim() || undefined,
          method: body.payment_method === "ideal" ? "ideal" : body.payment_method === "card" ? "creditcard" : undefined,
        });

        const checkoutUrl = payment._links?.checkout?.href;
        if (!checkoutUrl) {
          throw new Error("Mollie checkout URL alınamadı.");
        }

        await sb
          .from("rst_b2c_orders")
          .update({
            mollie_payment_id: payment.id,
            mollie_checkout_url: checkoutUrl,
          })
          .eq("id", orderId);

        return NextResponse.json({
          orderId,
          orderNumber,
          checkoutUrl,
          paymentRequired: true,
        });
      } catch (err) {
        console.error("[restoran/orders] Mollie error", err);
        // Mollie hatası → sipariş iptal et (cleanup)
        await sb.from("rst_b2c_orders").update({ status: "cancelled", cancel_reason: "mollie_error" }).eq("id", orderId);
        return NextResponse.json({ error: "Ödeme oluşturulamadı. Tekrar deneyin." }, { status: 502 });
      }
    }

    // Online ödeme yok → direkt 'received' (kapıda öderim / masada öderim)
    await sb
      .from("rst_b2c_orders")
      .update({ status: "received" })
      .eq("id", orderId);

    return NextResponse.json({
      orderId,
      orderNumber,
      checkoutUrl: null,
      paymentRequired: false,
    });
  } catch (err) {
    console.error("[restoran/orders] error", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
