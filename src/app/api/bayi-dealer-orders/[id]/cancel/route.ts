/**
 * POST /api/bayi-dealer-orders/[id]/cancel
 *
 * Pending iken sipariş iptal:
 *   - Bayi: kendi siparişini iptal eder
 *   - Admin/satis: tenant'taki herhangi bir bekleyen siparişi iptal eder
 *
 * Diğer durumlarda (confirmed+) iptal istemek başka iş akışı (refund) —
 * bu sprint scope'unda değil.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { transitionOrderStatus } from "@/platform/bayi-orders/notify";

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

  let body: { reason?: string } = {};
  try { body = await req.json(); } catch { /* opt */ }
  const reason = (body.reason || "").trim().slice(0, 500) || null;

  const { data: order } = await sb
    .from("bayi_dealer_orders")
    .select("id, status, dealer_user_id")
    .eq("id", id)
    .eq("tenant_id", lookup.tenantId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });

  const isAdminOrSales = ["admin", "satis"].includes(lookup.profile.role || "");
  const isOwner = order.dealer_user_id === lookup.profile.id;
  if (!isAdminOrSales && !isOwner) {
    return NextResponse.json({ error: "Bu siparişi iptal yetkiniz yok." }, { status: 403 });
  }

  if (order.status !== "pending") {
    return NextResponse.json({ error: `Sadece bekleyen sipariş iptal edilebilir (mevcut: ${order.status}).` }, { status: 409 });
  }

  const ok = await transitionOrderStatus(sb, {
    orderId: id,
    fromStatus: "pending",
    toStatus: "cancelled",
    changedByUserId: lookup.profile.id,
    reason,
  });
  if (!ok) return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });

  return NextResponse.json({ ok: true, status: "cancelled" });
}
