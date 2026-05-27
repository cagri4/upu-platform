/**
 * POST /api/restoran-panel/b2c-orders/[id]/status
 *
 * Restoran sahibi sipariş durumunu günceller. Status değişimi:
 *   received → preparing (mutfak)
 *   preparing → ready (hazır)
 *   ready → out_for_delivery (kurye yola çıktı — delivery için)
 *   ready/out_for_delivery → delivered (teslim)
 *   * → cancelled (iptal, opsiyonel reason ile)
 *
 * ready status'a geçilince müşteriye WhatsApp + (varsa) e-mail bildirimi
 * gönderilir: "🍽 Siparişiniz hazır! #12345"
 *
 * delivered status'a geçilince loyalty member varsa visit_count + total_spent
 * artırılır (V2 — şimdilik sadece status update).
 *
 * Body: { status: '...', cancel_reason?: '...' }
 * Auth: magic token, tenant_id eşleşmesi şart.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

const VALID_TRANSITIONS: Record<string, string[]> = {
  received: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  pending_payment: ["cancelled"],
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await ctx.params;

    const body = (await req.json()) as { token?: string; status?: string; cancel_reason?: string };
    const token = body.token || req.nextUrl.searchParams.get("t");
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

    const newStatus = String(body.status || "").trim();
    if (!newStatus) return NextResponse.json({ error: "Status gerekli." }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

    // Order lookup + tenant check
    const { data: order } = await supabase
      .from("rst_b2c_orders")
      .select("id, status, customer_name, customer_phone, order_number, total, restaurant_id, delivery_type")
      .eq("id", orderId)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });

    // Valid transition
    const allowed = VALID_TRANSITIONS[order.status as string] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `${order.status} → ${newStatus} geçişi yapılamaz.` },
        { status: 400 },
      );
    }

    // Update
    const updates: Record<string, string | null> = { status: newStatus };
    if (newStatus === "cancelled") {
      updates.cancel_reason = String(body.cancel_reason || "manual").substring(0, 100);
      updates.cancelled_at = new Date().toISOString();
    }
    if (newStatus === "delivered") {
      updates.delivered_at = new Date().toISOString();
    }

    await supabase.from("rst_b2c_orders").update(updates).eq("id", orderId);

    // ready → WhatsApp bildirim
    if (newStatus === "ready" && order.customer_phone) {
      try {
        // Restoran brand_name'i fetch
        const { data: rest } = await supabase
          .from("rst_restaurants")
          .select("brand_name")
          .eq("id", order.restaurant_id)
          .maybeSingle();
        const brandName = rest?.brand_name || "Restoran";

        const message = order.delivery_type === "delivery"
          ? `🛵 *${brandName} — Sipariş #${order.order_number}*\n\nSiparişiniz hazırlandı, kurye yola çıkıyor. Tahmini varış süreniz birkaç dakika içinde başlar.\n\nİyi yemekler! 🍽`
          : order.delivery_type === "pickup"
            ? `🥡 *${brandName} — Sipariş #${order.order_number}*\n\nSiparişiniz hazır! Gelip alabilirsiniz.\n\nGörüşmek üzere! 🍽`
            : `🍽 *${brandName} — Sipariş #${order.order_number}*\n\nSiparişiniz hazır, masanıza getiriliyor.\n\nAfiyet olsun!`;

        // customer_phone formatla (international, + opsiyonel)
        const phone = order.customer_phone.replace(/[^\d+]/g, "");
        await sendText(phone, message);
      } catch (err) {
        console.error("[b2c-orders/status] WA send error:", err);
        // Bildirim hatası status update'i engellemez
      }
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error("[restoran-panel/b2c-orders/status]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
