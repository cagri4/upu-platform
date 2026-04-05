import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevSevenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      todayEventsRes,
      weekEventsRes,
      monthEventsRes,
      prevWeekEventsRes,
      feedbackRes,
      presRes,
      propsRes,
      totalUsersRes,
    ] = await Promise.all([
      supabase.from("platform_events").select("user_id, event_type, tenant_key, event_name, created_at")
        .gte("created_at", todayStart.toISOString()),
      supabase.from("platform_events").select("user_id, event_type, tenant_key, event_name, created_at")
        .gte("created_at", sevenDaysAgo.toISOString()),
      supabase.from("platform_events").select("user_id, event_type, tenant_key, event_name, created_at")
        .gte("created_at", thirtyDaysAgo.toISOString()),
      supabase.from("platform_events").select("user_id, event_type")
        .gte("created_at", prevSevenDaysAgo.toISOString())
        .lt("created_at", sevenDaysAgo.toISOString()),
      supabase.from("platform_events").select("metadata, created_at")
        .eq("event_type", "sale_feedback")
        .gte("created_at", thirtyDaysAgo.toISOString()),
      supabase.from("emlak_presentations").select("id, user_id, created_at")
        .gte("created_at", thirtyDaysAgo.toISOString()),
      supabase.from("emlak_properties").select("id, status, updated_at")
        .in("status", ["satildi", "kiralandi"])
        .gte("updated_at", thirtyDaysAgo.toISOString()),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    const todayEvents = todayEventsRes.data || [];
    const weekEvents = weekEventsRes.data || [];
    const monthEvents = monthEventsRes.data || [];
    const prevWeekEvents = prevWeekEventsRes.data || [];

    // Active users
    const todayActiveUsers = new Set(todayEvents.map(e => e.user_id).filter(Boolean)).size;
    const weekActiveUsers = new Set(weekEvents.map(e => e.user_id).filter(Boolean)).size;
    const monthActiveUsers = new Set(monthEvents.map(e => e.user_id).filter(Boolean)).size;

    // Commands & errors
    const todayCommands = todayEvents.filter(e => e.event_type === "command").length;
    const weekCommands = weekEvents.filter(e => e.event_type === "command").length;
    const prevWeekCommands = prevWeekEvents.filter(e => e.event_type === "command").length;
    const weekErrors = weekEvents.filter(e => e.event_type === "error").length;
    const todayErrors = todayEvents.filter(e => e.event_type === "error").length;

    // Trend
    const commandTrend = prevWeekCommands > 0
      ? Math.round(((weekCommands - prevWeekCommands) / prevWeekCommands) * 100)
      : weekCommands > 0 ? 100 : 0;

    // Top commands (30 days)
    const cmdFreq: Record<string, number> = {};
    for (const e of monthEvents.filter(e => e.event_type === "command")) {
      const name = e.event_name || "?";
      cmdFreq[name] = (cmdFreq[name] || 0) + 1;
    }
    const topCommands = Object.entries(cmdFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Tenant breakdown
    const tenantFreq: Record<string, number> = {};
    for (const e of weekEvents) {
      if (e.tenant_key) tenantFreq[e.tenant_key] = (tenantFreq[e.tenant_key] || 0) + 1;
    }
    const tenantBreakdown = Object.entries(tenantFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }));

    // Top users (30 days)
    const userFreq: Record<string, number> = {};
    for (const e of monthEvents) {
      if (e.user_id) userFreq[e.user_id] = (userFreq[e.user_id] || 0) + 1;
    }
    const topUserIds = Object.entries(userFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);

    let topUsers: { id: string; name: string; count: number }[] = [];
    if (topUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", topUserIds.map(u => u[0]));
      const nameMap: Record<string, string> = {};
      for (const p of profiles || []) nameMap[p.id] = p.display_name || "?";
      topUsers = topUserIds.map(([id, count]) => ({ id, name: nameMap[id] || id.substring(0, 8), count }));
    }

    // Sales
    const salesCount = propsRes.data?.length || 0;
    const soldCount = (propsRes.data || []).filter(p => p.status === "satildi").length;
    const rentedCount = (propsRes.data || []).filter(p => p.status === "kiralandi").length;
    const presCount = presRes.data?.length || 0;

    // Feedback
    const feedbacks = feedbackRes.data || [];
    const ratings = feedbacks
      .map(f => (f.metadata as Record<string, unknown>)?.system_rating as number)
      .filter(r => typeof r === "number");
    const avgRating = ratings.length > 0
      ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
      : null;

    // Daily activity chart (last 14 days)
    const dailyActivity: { date: string; commands: number; errors: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayEvents = monthEvents.filter(e => e.created_at?.startsWith(dateStr));
      dailyActivity.push({
        date: dateStr,
        commands: dayEvents.filter(e => e.event_type === "command").length,
        errors: dayEvents.filter(e => e.event_type === "error").length,
      });
    }

    return NextResponse.json({
      activeUsers: { today: todayActiveUsers, week: weekActiveUsers, month: monthActiveUsers },
      commands: { today: todayCommands, week: weekCommands, trend: commandTrend },
      errors: { today: todayErrors, week: weekErrors },
      sales: { total: salesCount, sold: soldCount, rented: rentedCount },
      presentations: presCount,
      feedback: { avgRating, count: ratings.length },
      topCommands,
      tenantBreakdown,
      topUsers,
      totalUsers: totalUsersRes.count || 0,
      dailyActivity,
    });
  } catch (err) {
    console.error("[admin/insight] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
