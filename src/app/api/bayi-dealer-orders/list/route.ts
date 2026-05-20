/**
 * GET /api/bayi-dealer-orders/list?status=<status>&scope=mine|tenant
 *
 * Bayi tarafı: scope=mine → kendi siparişleri (default).
 * Admin/satis: scope=tenant → tüm tenant siparişleri.
 * status query opsiyonel filter.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

const ALL_STATUSES = new Set([
  "pending", "confirmed", "preparing", "shipped", "delivered", "cancelled", "rejected",
]);

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostTenant = getTenantByDomain(host);
  if (hostTenant?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde." }, { status: 400 });
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ role: string | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const scope = req.nextUrl.searchParams.get("scope") || "mine";
  const status = req.nextUrl.searchParams.get("status");
  const isAdminScope = scope === "tenant";

  if (isAdminScope && !["admin", "satis"].includes(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Bu listeye erişim yetkiniz yok." }, { status: 403 });
  }

  let query = sb
    .from("bayi_dealer_orders")
    .select("id, status, total_amount, currency, notes, rejection_reason, created_at, confirmed_at, shipped_at, delivered_at, cancelled_at, dealer_user_id")
    .eq("tenant_id", lookup.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isAdminScope) {
    query = query.eq("dealer_user_id", lookup.profile.id);
  }
  if (status && ALL_STATUSES.has(status)) {
    query = query.eq("status", status);
  }

  const { data: orders, error } = await query;
  if (error) {
    console.error("[bayi-dealer-orders/list]", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  // Admin scope: dealer bilgilerini birlikte getir
  let dealerMap: Record<string, { name: string; phone: string | null }> = {};
  if (isAdminScope && orders && orders.length > 0) {
    const dealerIds = Array.from(new Set(orders.map((o) => o.dealer_user_id)));
    const { data: dealers } = await sb
      .from("profiles")
      .select("id, display_name, whatsapp_phone, metadata")
      .in("id", dealerIds);
    dealerMap = Object.fromEntries(
      (dealers || []).map((d) => {
        const meta = (d.metadata as Record<string, unknown>) || {};
        const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
        return [
          d.id,
          {
            name: firma?.ticari_unvan || d.display_name || "Bayi",
            phone: d.whatsapp_phone || null,
          },
        ];
      }),
    );
  }

  const rows = (orders || []).map((o) => ({
    id: o.id,
    status: o.status,
    total_amount: Number(o.total_amount),
    currency: o.currency,
    notes: o.notes,
    rejection_reason: o.rejection_reason,
    created_at: o.created_at,
    confirmed_at: o.confirmed_at,
    shipped_at: o.shipped_at,
    delivered_at: o.delivered_at,
    cancelled_at: o.cancelled_at,
    dealer_user_id: o.dealer_user_id,
    dealer_name: dealerMap[o.dealer_user_id]?.name || null,
    dealer_phone: dealerMap[o.dealer_user_id]?.phone || null,
  }));

  return NextResponse.json({ ok: true, total: rows.length, rows });
}
