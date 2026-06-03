/**
 * GET /api/bayi-dealer-orders/[id]
 *
 * Sipariş detay — kalem listesi + status history. Bayi sadece kendi
 * siparişini, admin/satis tüm tenant siparişini görür.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde." }, { status: 400 });
  }

  const { id } = await params;
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ role: string | null; capabilities: string[] | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role, capabilities",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: order } = await sb
    .from("bayi_dealer_orders")
    .select("id, tenant_id, dealer_user_id, status, total_amount, currency, notes, rejection_reason, created_at, confirmed_at, shipped_at, delivered_at, cancelled_at, shipment_status, tracking_number, driver_name, vehicle_plate, delivered_photo_url")
    .eq("id", id)
    .eq("tenant_id", lookup.tenantId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });

  const isAdminOrSales = ["admin", "satis"].includes(lookup.profile.role || "");
  const isOwner = order.dealer_user_id === lookup.profile.id;
  if (!isAdminOrSales && !isOwner) {
    return NextResponse.json({ error: "Bu siparişe erişim yetkiniz yok." }, { status: 403 });
  }

  const [{ data: items }, { data: history }, { data: dealer }] = await Promise.all([
    sb.from("bayi_dealer_order_items")
      .select("id, product_id, product_name, unit_price, quantity, line_total")
      .eq("order_id", id)
      .order("id"),
    sb.from("bayi_dealer_order_status_history")
      .select("id, old_status, new_status, reason, changed_at, changed_by_user_id")
      .eq("order_id", id)
      .order("changed_at"),
    sb.from("profiles")
      .select("display_name, metadata, whatsapp_phone")
      .eq("id", order.dealer_user_id)
      .maybeSingle(),
  ]);

  const dMeta = (dealer?.metadata as Record<string, unknown>) || {};
  const dFirma = (dMeta.firma_profili as { ticari_unvan?: string } | null) || null;
  const dealerName = dFirma?.ticari_unvan || dealer?.display_name || "Bayi";

  return NextResponse.json({
    ok: true,
    order: {
      ...order,
      total_amount: Number(order.total_amount),
      dealer_name: dealerName,
      dealer_phone: dealer?.whatsapp_phone || null,
    },
    items: (items || []).map((it) => ({
      ...it,
      unit_price: Number(it.unit_price),
      line_total: Number(it.line_total),
    })),
    history: history || [],
    permissions: {
      canConfirm: isAdminOrSales && order.status === "pending",
      canReject: isAdminOrSales && order.status === "pending",
      canAdvance: isAdminOrSales,
      canCancel: order.status === "pending" && (isOwner || isAdminOrSales),
      canUpdateShipment: (() => {
        const caps = lookup.profile.capabilities || [];
        const role = lookup.profile.role || "";
        const ok = ["admin", "satis", "depocu"].includes(role)
          || caps.includes("*") || caps.includes("dealer-shipment:update");
        return ok && !["pending", "cancelled", "rejected"].includes(order.status);
      })(),
    },
  });
}
