import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const supabase = getServiceClient();

    // Get user's tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const tenantId = profile.tenant_id;

    // Parallel queries
    const [
      dealersRes,
      ordersRes,
      criticalStockRes,
      recentOrdersRes,
      collectionsRes,
      suppliersRes,
      activityRes,
    ] = await Promise.all([
      // Dealers
      supabase.from("bayi_dealers")
        .select("id, name, city, district, phone, status, balance, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20),

      // Order stats
      supabase.from("bayi_orders")
        .select("id, status, total_amount, created_at")
        .eq("tenant_id", tenantId),

      // Critical stock (products with low stock)
      supabase.from("bayi_products")
        .select("id, name, sku, stock_quantity, min_stock, unit_price, category")
        .eq("tenant_id", tenantId)
        .lt("stock_quantity", 10)
        .order("stock_quantity", { ascending: true })
        .limit(10),

      // Recent orders with dealer name
      supabase.from("bayi_orders")
        .select("id, dealer_id, status, total_amount, created_at, notes")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10),

      // Collections (dealer balances)
      supabase.from("bayi_dealers")
        .select("id, name, balance")
        .eq("tenant_id", tenantId)
        .gt("balance", 0)
        .order("balance", { ascending: false })
        .limit(10),

      // Suppliers
      supabase.from("bayi_suppliers")
        .select("id, name, phone, category")
        .eq("tenant_id", tenantId)
        .limit(10),

      // Recent activity
      supabase.from("bot_activity")
        .select("action, detail, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Process order stats
    const allOrders = ordersRes.data || [];
    const pendingOrders = allOrders.filter(o => o.status === "pending" || o.status === "beklemede");
    const completedOrders = allOrders.filter(o => o.status === "completed" || o.status === "tamamlandi");
    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Get dealer names for orders
    const dealerIds = [...new Set((recentOrdersRes.data || []).map(o => o.dealer_id).filter(Boolean))];
    let dealerNameMap: Record<string, string> = {};
    if (dealerIds.length > 0) {
      const { data: dealerNames } = await supabase
        .from("bayi_dealers")
        .select("id, name")
        .in("id", dealerIds);
      for (const d of dealerNames || []) dealerNameMap[d.id] = d.name;
    }

    const recentOrders = (recentOrdersRes.data || []).map(o => ({
      ...o,
      dealer_name: dealerNameMap[o.dealer_id] || "—",
    }));

    return NextResponse.json({
      summary: {
        totalDealers: (dealersRes.data || []).length,
        totalOrders: allOrders.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        totalRevenue,
        criticalStockCount: (criticalStockRes.data || []).length,
        totalDebt: (collectionsRes.data || []).reduce((sum, d) => sum + (d.balance || 0), 0),
      },
      dealers: dealersRes.data || [],
      recentOrders,
      criticalStock: criticalStockRes.data || [],
      collections: collectionsRes.data || [],
      suppliers: suppliersRes.data || [],
      recentActivity: activityRes.data || [],
    });
  } catch (err) {
    console.error("[dashboard/bayi]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
