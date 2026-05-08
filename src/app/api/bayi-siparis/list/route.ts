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

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("tenant_id")
    .eq("id", pt.user_id)
    .single();
  const tenantId = profile?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "Tenant bulunamadı." }, { status: 500 });

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
