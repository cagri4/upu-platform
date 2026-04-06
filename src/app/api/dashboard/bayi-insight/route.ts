import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", userId).single();
    if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const tenantId = profile.tenant_id;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [activityRes, weekRes, prevWeekRes, ordersRes, dealersRes, stockRes] = await Promise.all([
      supabase.from("bot_activity").select("action").eq("user_id", userId).gte("created_at", thirtyDaysAgo),
      supabase.from("bot_activity").select("created_at").eq("user_id", userId).gte("created_at", sevenDaysAgo),
      supabase.from("bot_activity").select("created_at").eq("user_id", userId).gte("created_at", prevWeekStart).lt("created_at", sevenDaysAgo),
      supabase.from("bayi_orders").select("id, status, total_amount, created_at").eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo),
      supabase.from("bayi_dealers").select("id, status, balance").eq("tenant_id", tenantId),
      supabase.from("bayi_products").select("id").eq("tenant_id", tenantId).lt("stock_quantity", 10),
    ]);

    // Command usage
    const cmdCounts: Record<string, number> = {};
    for (const r of activityRes.data || []) cmdCounts[r.action] = (cmdCounts[r.action] || 0) + 1;
    const topCommands = Object.entries(cmdCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

    // Trend
    const thisWeek = weekRes.data?.length || 0;
    const lastWeek = prevWeekRes.data?.length || 0;
    const trend = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;

    // Orders
    const orders = ordersRes.data || [];
    const revenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const pending = orders.filter(o => o.status === "pending" || o.status === "beklemede").length;
    const completed = orders.filter(o => o.status === "completed" || o.status === "tamamlandi").length;

    // Dealers
    const dealers = dealersRes.data || [];
    const totalDebt = dealers.reduce((s, d) => s + (d.balance || 0), 0);

    // Daily order chart (14 days)
    const dailyOrders: { date: string; count: number; revenue: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayOrders = orders.filter(o => o.created_at?.startsWith(dateStr));
      dailyOrders.push({
        date: dateStr,
        count: dayOrders.length,
        revenue: dayOrders.reduce((s, o) => s + (o.total_amount || 0), 0),
      });
    }

    return NextResponse.json({
      totalCommands: activityRes.data?.length || 0,
      thisWeek, lastWeek, trend,
      topCommands,
      orders: { total: orders.length, pending, completed, revenue },
      dealers: { total: dealers.length, active: dealers.filter(d => d.status === "active" || d.status === "aktif").length },
      criticalStock: stockRes.data?.length || 0,
      totalDebt,
      dailyOrders,
    });
  } catch (err) {
    console.error("[bayi-insight]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
