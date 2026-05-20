/**
 * POST /api/bayi-dealer-orders/[id]/update-status
 * Body: { status }
 *
 * Admin/satis durum makinesini ilerlettir:
 *   confirmed → preparing → shipped → delivered
 * Geri dönüş yasak (idempotent transition koruması).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { transitionOrderStatus, type BayiOrderStatus } from "@/platform/bayi-orders/notify";

export const dynamic = "force-dynamic";

const VALID_TRANSITIONS: Record<string, BayiOrderStatus[]> = {
  confirmed: ["preparing"],
  preparing: ["shipped"],
  shipped: ["delivered"],
};

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
    return NextResponse.json({ error: "Bu yetkiniz yok." }, { status: 403 });
  }

  let body: { status?: string } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }
  const toStatus = body.status as BayiOrderStatus | undefined;
  if (!toStatus) return NextResponse.json({ error: "status gerekli." }, { status: 400 });

  const { data: order } = await sb
    .from("bayi_dealer_orders")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", lookup.tenantId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(toStatus)) {
    return NextResponse.json({ error: `Geçersiz geçiş: ${order.status} → ${toStatus}.` }, { status: 409 });
  }

  const ok = await transitionOrderStatus(sb, {
    orderId: id,
    fromStatus: order.status as BayiOrderStatus,
    toStatus,
    changedByUserId: lookup.profile.id,
  });
  if (!ok) return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });

  return NextResponse.json({ ok: true, status: toStatus });
}
