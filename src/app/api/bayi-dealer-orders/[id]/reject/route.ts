/**
 * POST /api/bayi-dealer-orders/[id]/reject
 * Body: { reason? }
 *
 * Admin/satis bekleyen siparişi reddeder: pending → rejected.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { transitionOrderStatus } from "@/platform/bayi-orders/notify";
import { releaseReservationsForOrder } from "@/platform/bayi-orders/stock-side-effects";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde." }, { status: 400 });
  }

  const { id } = await params;
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ role: string | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  if (!["admin", "satis"].includes(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Red yetkiniz yok." }, { status: 403 });
  }

  let body: { reason?: string } = {};
  try { body = await req.json(); } catch { /* opt */ }
  const reason = (body.reason || "").trim().slice(0, 500) || null;

  const { data: order } = await sb
    .from("bayi_dealer_orders")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", lookup.tenantId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  if (order.status !== "pending") {
    return NextResponse.json({ error: `Sadece bekleyen sipariş reddedilebilir (mevcut: ${order.status}).` }, { status: 409 });
  }

  const ok = await transitionOrderStatus(sb, {
    orderId: id,
    fromStatus: "pending",
    toStatus: "rejected",
    changedByUserId: lookup.profile.id,
    reason,
  });
  if (!ok) return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });

  // Reddedilen sipariş → rezervasyonlar serbest bırakılır.
  await releaseReservationsForOrder(sb, id);

  return NextResponse.json({ ok: true, status: "rejected" });
}
