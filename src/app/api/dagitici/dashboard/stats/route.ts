/**
 * GET /api/dagitici/dashboard/stats — KPI sayıları + son siparişler + geciken bayiler.
 *
 * Tek endpoint, üç parça: KPI (4 sayı), son 10 sipariş, geciken 3 bayi.
 * Tek roundtrip için bunu birleştiriyoruz.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  // Bugünün başlangıcı (Europe/Istanbul ≈ UTC+3 yaklaşık — DB UTC tutuyor;
  // basitlik için server-side UTC midnight kabul, dashboard "bugün" göstergesi
  // saatlik tolerans kabul edilebilir).
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startIso = startOfToday.toISOString();

  // Pending status id'leri (code='pending')
  const { data: pendingStatus } = await sb
    .from("bayi_order_statuses")
    .select("id")
    .eq("code", "pending")
    .maybeSingle();
  const pendingStatusId = pendingStatus?.id ?? null;

  // Today orders + revenue (tek query, sum aggregate)
  const { data: todayOrders } = await sb
    .from("bayi_orders")
    .select("total_amount")
    .eq("tenant_id", tenantId)
    .gte("created_at", startIso);
  const todayCount = (todayOrders ?? []).length;
  const todayRevenue = (todayOrders ?? []).reduce(
    (s, o) => s + Number(o.total_amount ?? 0),
    0,
  );

  // Pending approval count
  let pendingCount = 0;
  if (pendingStatusId) {
    const { count } = await sb
      .from("bayi_orders")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status_id", pendingStatusId);
    pendingCount = count ?? 0;
  }

  // Overdue dealer count — risk_status başlığında "overdue" veya "risk"
  const { count: overdueCount } = await sb
    .from("bayi_dealers")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("risk_status", ["overdue", "risk"]);

  // Son 10 sipariş (tarih DESC) — dealer adıyla join
  const { data: recentOrders } = await sb
    .from("bayi_orders")
    .select(
      "id, order_number, dealer_id, total_amount, status_id, created_at, bayi_dealers(name, company_name), bayi_order_statuses(code, name)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(10);

  const recent =
    (recentOrders ?? []).map((o) => {
      const dealer = (o as { bayi_dealers?: { name?: string; company_name?: string } | null }).bayi_dealers;
      const status = (o as { bayi_order_statuses?: { code?: string; name?: string } | null }).bayi_order_statuses;
      return {
        id: o.id as string,
        orderNumber: o.order_number as string,
        dealerName: dealer?.company_name || dealer?.name || "Bilinmeyen",
        totalAmount: Number(o.total_amount ?? 0),
        statusCode: status?.code || "unknown",
        statusName: status?.name || "—",
        createdAt: o.created_at as string,
      };
    }) ?? [];

  // Geciken 3 bayi (risk_status overdue/risk)
  const { data: overdueDealers } = await sb
    .from("bayi_dealers")
    .select("id, name, company_name, city, contact_name, balance, updated_at")
    .eq("tenant_id", tenantId)
    .in("risk_status", ["overdue", "risk"])
    .order("balance", { ascending: false })
    .limit(3);

  const overdueList = (overdueDealers ?? []).map((d) => ({
    id: d.id as string,
    name: (d.company_name as string) || (d.name as string) || "Bilinmeyen",
    city: (d.city as string) || null,
    contact: (d.contact_name as string) || null,
    balance: Number(d.balance ?? 0),
    updatedAt: d.updated_at as string,
  }));

  return NextResponse.json({
    success: true,
    kpi: {
      todayOrders: todayCount,
      todayRevenue,
      pendingApproval: pendingCount,
      overdueDealers: overdueCount ?? 0,
    },
    recentOrders: recent,
    overdueDealers: overdueList,
  });
}
