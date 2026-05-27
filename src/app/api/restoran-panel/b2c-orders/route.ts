/**
 * GET /api/restoran-panel/b2c-orders?t=<token>
 *
 * Panel için B2C sipariş listesi. Token validate → tenant_id eşleşmesi
 * (başka restoran siparişi görünmez).
 *
 * Query parametreleri:
 *   - status: comma-separated filter ('received,preparing,ready')
 *             default: 'received,preparing,ready,out_for_delivery'
 *   - limit: default 50, max 200
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_ACTIVE_STATUSES = ["received", "preparing", "ready", "out_for_delivery"];

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

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

    const statusFilter = req.nextUrl.searchParams.get("status");
    const statuses = statusFilter ? statusFilter.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ACTIVE_STATUSES;

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50", 10) || 50, 200);

    const { data: orders } = await supabase
      .from("rst_b2c_orders")
      .select(
        "id, order_number, customer_name, customer_phone, delivery_type, " +
        "delivery_address, items, notes, subtotal, delivery_fee, total, " +
        "status, payment_method, payment_status, estimated_ready_at, " +
        "table_id, source, created_at",
      )
      .eq("tenant_id", profile.tenant_id)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(limit);

    return NextResponse.json({ orders: orders || [] });
  } catch (err) {
    console.error("[restoran-panel/b2c-orders]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
