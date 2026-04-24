/**
 * POST /api/bayi-siparis/save — insert bayi_orders + bayi_order_items
 * from the web form. Sends WhatsApp confirmation to caller. Magic link
 * token is invalidated so the form is single-use; owner can create a
 * new order by tapping the WA command again.
 *
 * Body: {
 *   token,
 *   dealer_id,
 *   items: [{ product_id, quantity }],
 *   notes?: string,
 *   delivery_date?: ISO
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import { BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function formatPrice(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const dealerId = String(body.dealer_id || "").trim();
    const notes = body.notes ? String(body.notes).trim() : null;
    const deliveryDate = body.delivery_date ? String(body.delivery_date).trim() : null;
    const itemsRaw = Array.isArray(body.items) ? body.items : [];

    if (!dealerId) return NextResponse.json({ error: "Bayi seçmelisiniz." }, { status: 400 });
    if (itemsRaw.length === 0) return NextResponse.json({ error: "En az bir ürün ekleyin." }, { status: 400 });

    interface OrderItemInput { product_id: string; quantity: number }
    const items: OrderItemInput[] = itemsRaw
      .map((i: { product_id?: string; quantity?: number | string }): OrderItemInput => ({
        product_id: String(i.product_id || "").trim(),
        quantity: Math.max(1, Math.round(Number(i.quantity) || 0)),
      }))
      .filter((i: OrderItemInput) => i.product_id && i.quantity > 0);
    if (items.length === 0) return NextResponse.json({ error: "Geçerli ürün/miktar yok." }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();
    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    if (new Date(magicToken.expires_at) < new Date()) return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, tenant_id, role, capabilities, dealer_id, whatsapp_phone, invited_by")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const caps = (profile.capabilities as string[] | null) || [];
    const canCreateOrder = caps.includes("*") || caps.includes(BAYI_CAPABILITIES.ORDERS_CREATE);
    if (!canCreateOrder) return NextResponse.json({ error: "Sipariş oluşturma yetkiniz yok." }, { status: 403 });

    // Dealer callers can only order for themselves
    const isDealer = profile.role === "dealer";
    if (isDealer && profile.dealer_id !== dealerId) {
      return NextResponse.json({ error: "Sadece kendi adınıza sipariş verebilirsiniz." }, { status: 403 });
    }

    // Verify dealer exists in tenant
    const { data: dealer } = await supabase
      .from("bayi_dealers")
      .select("id, company_name, balance")
      .eq("id", dealerId)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (!dealer) return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 });
    const dealerName = dealer.company_name as string;

    // Resolve product prices (unit_price preferred, base_price fallback)
    const productIds = items.map((i) => i.product_id);
    const { data: products } = await supabase
      .from("bayi_products")
      .select("id, name, unit_price, base_price, stock_quantity")
      .in("id", productIds);
    const prodMap = new Map<string, { name: string; unit_price: number; stock: number }>();
    for (const p of products || []) {
      prodMap.set(p.id as string, {
        name: p.name as string,
        unit_price: Number(p.unit_price || p.base_price || 0),
        stock: Number(p.stock_quantity || 0),
      });
    }
    const missing = items.find((i) => !prodMap.has(i.product_id));
    if (missing) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

    // Compute total
    let total = 0;
    const insertItems: Array<{ product_id: string; quantity: number; unit_price: number }> = [];
    for (const it of items) {
      const p = prodMap.get(it.product_id)!;
      total += p.unit_price * it.quantity;
      insertItems.push({ product_id: it.product_id, quantity: it.quantity, unit_price: p.unit_price });
    }

    // Insert order. Stash delivery_date in notes if provided since the
    // bayi_orders table may not carry a dedicated column across tenants.
    const fullNotes = [
      notes,
      deliveryDate ? `Teslimat: ${new Date(deliveryDate).toLocaleDateString("tr-TR")}` : null,
    ].filter(Boolean).join(" | ") || null;
    const orderRow: Record<string, unknown> = {
      tenant_id: profile.tenant_id,
      dealer_id: dealer.id,
      status: "pending",
      total_amount: total,
      notes: fullNotes,
      created_by: profile.id,
    };

    const { data: order, error: orderErr } = await supabase
      .from("bayi_orders")
      .insert(orderRow)
      .select("id")
      .single();
    if (orderErr || !order) {
      console.error("[bayi-siparis:save] order err", orderErr);
      return NextResponse.json({ error: orderErr?.message || "Sipariş kaydedilemedi." }, { status: 500 });
    }

    // Insert items (no tenant_id — table doesn't have one per existing schema)
    const itemRows = insertItems.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }));
    const { error: itemErr } = await supabase.from("bayi_order_items").insert(itemRows);
    if (itemErr) {
      console.error("[bayi-siparis:save] items err", itemErr);
      // Best-effort cleanup
      await supabase.from("bayi_orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Sipariş kalemleri kaydedilemedi." }, { status: 500 });
    }

    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    // Notify caller
    if (profile.whatsapp_phone) {
      try {
        const lines = insertItems.map((i) => {
          const p = prodMap.get(i.product_id)!;
          return `• ${p.name} x${i.quantity} — ${formatPrice(p.unit_price * i.quantity)} ₺`;
        }).join("\n");
        await sendButtons(profile.whatsapp_phone,
          `✅ Sipariş oluşturuldu!\n\n🏪 ${dealerName}\n${lines}\n\n💰 Toplam: ${formatPrice(total)} ₺${deliveryDate ? `\n📅 Teslimat: ${new Date(deliveryDate).toLocaleDateString("tr-TR")}` : ""}`,
          [
            { id: "cmd:siparisler", title: "📋 Siparişler" },
            { id: "cmd:menu", title: "Ana Menü" },
          ],
        );
      } catch (waErr) {
        console.error("[bayi-siparis:save] WA notify failed:", waErr);
      }
    }

    // Event-based fan-out: notify users with stock:edit for prep (Phase 4).
    // We trigger here so the notification engine runs on every order, not
    // only ones created in the WA corridor.
    try {
      const { notifyUsersByCapability } = await import("@/platform/cron/notifications");
      await notifyUsersByCapability(
        profile.tenant_id,
        BAYI_CAPABILITIES.STOCK_EDIT,
        `📦 Yeni sipariş: ${dealerName} — ${formatPrice(total)} ₺\nHazırlık başlayabilir.`,
        { excludeUserId: profile.id },
      );
    } catch (notifyErr) {
      console.warn("[bayi-siparis:save] capability notify skipped:", notifyErr);
    }

    return NextResponse.json({ success: true, orderId: order.id, total });
  } catch (err) {
    console.error("[bayi-siparis:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
