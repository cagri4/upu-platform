import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

// GET — dealer data: catalog, orders, balance
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const section = req.nextUrl.searchParams.get("section") || "catalog";
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, dealer_id, invited_by")
      .eq("id", userId)
      .single();

    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const ownerId = profile.invited_by;
    const dealerId = profile.dealer_id;

    if (section === "catalog") {
      // Get owner's products (active only)
      const { data: products } = await supabase
        .from("bayi_products")
        .select("id, name, description, base_price, unit_price, stock_quantity, category, unit, min_order, image_url, images, brand, specs")
        .eq("user_id", ownerId)
        .eq("is_active", true)
        .gt("stock_quantity", 0)
        .order("category")
        .order("name");

      const categories = [...new Set((products || []).map(p => p.category).filter(Boolean))];
      return NextResponse.json({ products: products || [], categories });
    }

    if (section === "orders") {
      const { data: orders } = await supabase
        .from("bayi_orders")
        .select("id, status, total_amount, created_at, notes")
        .eq("dealer_id", dealerId || userId)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(20);

      // Get order items for each order
      const orderIds = (orders || []).map(o => o.id);
      let items: Record<string, unknown>[] = [];
      if (orderIds.length > 0) {
        const { data: orderItems } = await supabase
          .from("bayi_order_items")
          .select("order_id, product_id, quantity, unit_price")
          .in("order_id", orderIds);
        items = orderItems || [];
      }

      // Get product names
      const productIds = [...new Set(items.map((i: Record<string, unknown>) => i.product_id as string))];
      let productNames: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: prods } = await supabase.from("bayi_products").select("id, name").in("id", productIds);
        for (const p of prods || []) productNames[p.id] = p.name;
      }

      const ordersWithItems = (orders || []).map(o => ({
        ...o,
        items: items
          .filter((i: Record<string, unknown>) => i.order_id === o.id)
          .map((i: Record<string, unknown>) => ({
            ...i,
            product_name: productNames[i.product_id as string] || "?",
          })),
      }));

      return NextResponse.json({ orders: ordersWithItems });
    }

    if (section === "balance") {
      if (!dealerId) return NextResponse.json({ balance: 0, invoices: [], payments: [] });

      const { data: dealer } = await supabase
        .from("bayi_dealers")
        .select("name, balance")
        .eq("id", dealerId)
        .single();

      const { data: invoices } = await supabase
        .from("bayi_dealer_invoices")
        .select("id, invoice_no, amount, status, due_date, created_at")
        .eq("dealer_id", dealerId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: payments } = await supabase
        .from("bayi_dealer_transactions")
        .select("id, amount, type, description, created_at")
        .eq("dealer_id", dealerId)
        .order("created_at", { ascending: false })
        .limit(10);

      return NextResponse.json({
        balance: dealer?.balance || 0,
        dealerName: dealer?.name || "",
        invoices: invoices || [],
        payments: payments || [],
      });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (err) {
    console.error("[dealer GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — create order from cart
export async function POST(req: NextRequest) {
  try {
    const { userId, items, notes } = await req.json();
    if (!userId || !items?.length) return NextResponse.json({ error: "userId and items required" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, dealer_id, invited_by, display_name")
      .eq("id", userId)
      .single();

    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Calculate total
    const productIds = items.map((i: { productId: string }) => i.productId);
    const { data: products } = await supabase.from("bayi_products").select("id, unit_price, base_price, name").in("id", productIds);
    const priceMap: Record<string, number> = {};
    const nameMap: Record<string, string> = {};
    for (const p of products || []) {
      priceMap[p.id] = p.unit_price || p.base_price || 0;
      nameMap[p.id] = p.name;
    }

    let totalAmount = 0;
    const orderItems = items.map((i: { productId: string; quantity: number }) => {
      const price = priceMap[i.productId] || 0;
      totalAmount += price * i.quantity;
      return { product_id: i.productId, quantity: i.quantity, unit_price: price };
    });

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from("bayi_orders")
      .insert({
        tenant_id: profile.tenant_id,
        dealer_id: profile.dealer_id || userId,
        status: "pending",
        total_amount: totalAmount,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (orderErr || !order) return NextResponse.json({ error: "Order creation failed" }, { status: 500 });

    // Create order items
    await supabase.from("bayi_order_items").insert(
      orderItems.map((item: Record<string, unknown>) => ({ ...item, order_id: order.id }))
    );

    // Notify owner
    const ownerId = profile.invited_by;
    if (ownerId) {
      const { data: owner } = await supabase.from("profiles").select("whatsapp_phone").eq("id", ownerId).single();
      if (owner?.whatsapp_phone) {
        const { sendButtons } = await import("@/platform/whatsapp/send");
        const itemSummary = items.map((i: { productId: string; quantity: number }) =>
          `• ${nameMap[i.productId] || "?"} x${i.quantity}`
        ).join("\n");
        await sendButtons(owner.whatsapp_phone,
          `📦 *Yeni Sipariş!*\n\n🏢 ${profile.display_name}\n\n${itemSummary}\n\n💰 Toplam: ${new Intl.NumberFormat("tr-TR").format(totalAmount)} TL`,
          [{ id: "cmd:siparisler", title: "📋 Siparişler" }]
        );
      }
    }

    return NextResponse.json({ ok: true, orderId: order.id, totalAmount });
  } catch (err) {
    console.error("[dealer POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
