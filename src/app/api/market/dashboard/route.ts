/**
 * /api/market/dashboard — Dashboard KPI count'ları.
 * Token doğrula + 6 paralel sayım:
 *   1. daily_revenue       — bugünkü mkt_sales sum(total_amount)
 *   2. low_stock_count     — mkt_products quantity<=COALESCE(min_stock,10)
 *   3. pending_orders      — mkt_orders status IN ('pending','confirmed')
 *   4. monthly_suppliers   — bu ay distinct supplier_id (mkt_orders)
 *   5. active_promotions   — mkt_promotions count (tablo yoksa error → 0)
 *   6. loyalty_members     — mkt_loyalty_customers count (tablo yoksa 0 — Faz 2)
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

  if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
  }

  const userId = pt.user_id;

  // Profile → tenant_id (mkt_* tabloları tenant scope'lu)
  const { data: profile } = await sb
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({
      success: true,
      kpis: {
        daily_revenue: 0,
        low_stock_count: 0,
        pending_orders: 0,
        monthly_suppliers: 0,
        active_promotions: 0,
        loyalty_members: 0,
      },
    });
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Paralel 6 sorgu. Tablo yoksa Supabase error döner (exception değil),
  // count/data null olur ve frontend 0 gösterir.
  const [salesRes, productsRes, ordersRes, monthOrdersRes, promotionsRes, loyaltyRes] = await Promise.all([
    sb.from("mkt_sales")
      .select("total_amount")
      .eq("tenant_id", tenantId)
      .gte("sold_at", todayStart.toISOString())
      .lt("sold_at", tomorrowStart.toISOString()),

    sb.from("mkt_products")
      .select("quantity, min_stock")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),

    sb.from("mkt_orders")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "confirmed"]),

    sb.from("mkt_orders")
      .select("supplier_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart.toISOString()),

    // mkt_promotions — tablo Faz 2'de eklenir, şimdi yoksa error → 0
    sb.from("mkt_promotions")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),

    // mkt_loyalty_customers — Faz 2 MVP A "Sadık Müşterim", şimdi yoksa 0
    sb.from("mkt_loyalty_customers")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  const dailyRevenue = (salesRes.data || []).reduce((s, r) => s + (r.total_amount || 0), 0);
  const lowStockCount = (productsRes.data || []).filter(
    (p) => (p.quantity || 0) <= (p.min_stock || 10)
  ).length;
  const pendingOrders = ordersRes.count || 0;
  const monthlySuppliers = new Set(
    (monthOrdersRes.data || []).map((o) => o.supplier_id).filter(Boolean)
  ).size;
  const activePromotions = promotionsRes.count || 0;
  const loyaltyMembers = loyaltyRes.count || 0;

  return NextResponse.json({
    success: true,
    kpis: {
      daily_revenue: Math.round(dailyRevenue),
      low_stock_count: lowStockCount,
      pending_orders: pendingOrders,
      monthly_suppliers: monthlySuppliers,
      active_promotions: activePromotions,
      loyalty_members: loyaltyMembers,
    },
  });
}
