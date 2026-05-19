/**
 * GET /api/bayi-siparis/list?t=<token>&q=<arama>
 *
 * Bayi sipariş listesi — son 200 kayıt, status + dealer ile join'li.
 * Liste sayfasında (bayi-siparislerim) kullanılır.
 *
 * q (arama): bayi adı, sipariş no üzerinde JS-side filter.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ tenant_id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const tenantId = lookup.tenantId;

  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  const { data: orders, error } = await sb
    .from("bayi_orders")
    .select("id, order_number, total_amount, created_at, status_id, dealer_id, bayi_dealers(company_name), bayi_order_statuses(name, code)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[bayi-siparis:list]", error);
    return NextResponse.json({ error: "Liste alınamadı.", details: error.message }, { status: 500 });
  }

  const rows = (orders || []).map((o: Record<string, unknown>) => {
    const dealer = o.bayi_dealers as { company_name?: string } | null;
    const status = o.bayi_order_statuses as { name?: string; code?: string } | null;
    return {
      id: o.id as string,
      orderNumber: (o.order_number as string) || "—",
      dealerName: dealer?.company_name || null,
      total: Number(o.total_amount) || 0,
      statusName: status?.name || null,
      statusCode: status?.code || null,
      createdAt: o.created_at as string,
    };
  });

  // q varsa JS-side filter (orderNumber, dealerName)
  let filtered = rows;
  if (q) {
    const ql = q.toLocaleLowerCase("tr");
    filtered = rows.filter(r => {
      return (r.orderNumber && r.orderNumber.toLocaleLowerCase("tr").includes(ql)) ||
             (r.dealerName && r.dealerName.toLocaleLowerCase("tr").includes(ql));
    });
  }

  return NextResponse.json({ success: true, total: filtered.length, rows: filtered });
}
