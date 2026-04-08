/**
 * Cron: Weekly Performance Summary
 *
 * Her pazartesi sabahı kullanıcıya haftalık performans özeti gönderir.
 * Vercel Cron: 0 6 * * 1 (Pazartesi 09:00 TR)
 */
import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import { getStreak } from "@/platform/gamification/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceClient();

    // Get active users
    const { data: users } = await supabase
      .from("profiles")
      .select("id, display_name, whatsapp_phone, tenant_id, role")
      .not("whatsapp_phone", "is", null)
      .in("role", ["admin", "user"]);

    if (!users?.length) return NextResponse.json({ sent: 0 });

    const tenantIds = [...new Set(users.map(u => u.tenant_id).filter(Boolean))];
    const { data: tenants } = await supabase.from("tenants").select("id, saas_type").in("id", tenantIds);
    const tenantMap: Record<string, string> = {};
    for (const t of tenants || []) tenantMap[t.id] = t.saas_type;

    // Last week date range
    const now = new Date();
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const prevWeekStart = new Date(now);
    prevWeekStart.setDate(prevWeekStart.getDate() - 14);

    let sent = 0;

    for (const user of users) {
      try {
        const tenantKey = tenantMap[user.tenant_id] || "";
        const streak = await getStreak(user.id);

        // This week tasks
        const { data: thisWeekTasks } = await supabase
          .from("user_daily_tasks")
          .select("status, points")
          .eq("user_id", user.id)
          .gte("due_date", lastWeekStart.toISOString().split("T")[0]);

        // Previous week tasks
        const { data: prevWeekTasks } = await supabase
          .from("user_daily_tasks")
          .select("status")
          .eq("user_id", user.id)
          .gte("due_date", prevWeekStart.toISOString().split("T")[0])
          .lt("due_date", lastWeekStart.toISOString().split("T")[0]);

        const thisCompleted = (thisWeekTasks || []).filter(t => t.status === "completed").length;
        const thisTotal = (thisWeekTasks || []).length;
        const prevCompleted = (prevWeekTasks || []).filter(t => t.status === "completed").length;
        const prevTotal = (prevWeekTasks || []).length;
        const thisPoints = (thisWeekTasks || []).filter(t => t.status === "completed").reduce((s, t) => s + (t.points || 0), 0);

        const ratio = thisTotal > 0 ? thisCompleted / thisTotal : 0;
        const stars = ratio >= 0.9 ? 5 : ratio >= 0.7 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.3 ? 2 : ratio > 0 ? 1 : 0;
        const starStr = "⭐".repeat(stars) + "☆".repeat(5 - stars);

        // Trend vs last week
        const prevRatio = prevTotal > 0 ? prevCompleted / prevTotal : 0;
        let trendMsg = "";
        if (ratio > prevRatio + 0.1) trendMsg = "📈 Geçen haftadan daha iyi!";
        else if (ratio < prevRatio - 0.1) trendMsg = "📉 Geçen haftaya göre düşüş var.";
        else trendMsg = "➡️ Geçen haftayla aynı seviyede.";

        // Missions completed this week
        const { data: completedMissions } = await supabase
          .from("user_mission_progress")
          .select("mission_id")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .gte("completed_at", lastWeekStart.toISOString());

        let msg = `📊 *Haftalık Performans Raporu*\n\n`;
        msg += `${starStr} (${stars}/5)\n\n`;
        msg += `✅ Tamamlanan görev: ${thisCompleted}/${thisTotal}\n`;
        msg += `🏆 Kazanılan puan: ${thisPoints}\n`;
        msg += `🔥 Seri: ${streak.current} gün (en uzun: ${streak.longest})\n`;

        if ((completedMissions || []).length > 0) {
          msg += `🎯 Tamamlanan misyon: ${completedMissions!.length}\n`;
        }

        msg += `\n${trendMsg}\n`;

        // Motivational message based on performance
        if (stars === 5) msg += `\n🌟 Mükemmel bir hafta geçirdiniz! Bu performansı sürdürün!`;
        else if (stars >= 3) msg += `\n💪 İyi gidiyorsunuz! Biraz daha efor ile tam puan alabilirsiniz.`;
        else if (stars >= 1) msg += `\n💡 Bu hafta daha aktif olabilirsiniz. Sistemi düzenli kullanmak sonuç getirir.`;
        else msg += `\n⏰ Bu hafta sistemi kullanmadınız. 5 dakikanızı ayırarak başlayabilirsiniz.`;

        // Tenant-specific highlights
        if (tenantKey === "emlak") {
          const { count: propCount } = await supabase
            .from("emlak_properties").select("*", { count: "exact", head: true })
            .eq("user_id", user.id).eq("status", "aktif");
          const { count: custCount } = await supabase
            .from("emlak_customers").select("*", { count: "exact", head: true })
            .eq("user_id", user.id).eq("status", "active");

          msg += `\n\n📋 *Portföy Durumu*\n`;
          msg += `🏠 ${propCount || 0} aktif mülk | 👥 ${custCount || 0} aktif müşteri`;
        }

        await sendButtons(user.whatsapp_phone!, msg, [
          { id: "cmd:brifing", title: "📋 Brifing" },
          { id: "cmd:menu", title: "Ana Menü" },
        ]);

        // Save performance record
        await supabase.from("user_performance").insert({
          user_id: user.id,
          tenant_key: tenantKey,
          week_start: lastWeekStart.toISOString().split("T")[0],
          tasks_completed: thisCompleted,
          tasks_total: thisTotal,
          stars,
          points_earned: thisPoints,
          highlights: {
            missions_completed: (completedMissions || []).length,
            streak: streak.current,
            trend: trendMsg,
          },
        });

        sent++;
      } catch (err) {
        console.error(`[weekly-perf] Error for ${user.id}:`, err);
      }
    }

    return NextResponse.json({ sent, total: users.length });
  } catch (err) {
    console.error("[weekly-perf]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
