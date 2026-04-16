import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = getServiceClient();

  const [
    { data: state },
    { data: allMissions },
    { data: progress },
    { data: streakRow },
  ] = await Promise.all([
    supabase.from("user_quest_state").select("*").eq("user_id", userId).eq("tenant_key", "emlak").maybeSingle(),
    supabase.from("platform_missions").select("id, mission_key, title, description, emoji, chapter, chapter_order, sort_order, xp_reward, employee_key").eq("tenant_key", "emlak").eq("role", "admin").order("sort_order"),
    supabase.from("user_mission_progress").select("mission_id, status, completed_at, points_earned").eq("user_id", userId),
    supabase.from("user_streaks").select("current_streak, longest_streak, last_active_date").eq("user_id", userId).maybeSingle(),
  ]);

  const progressMap = new Map<string, { status: string; points_earned: number | null }>();
  for (const p of progress || []) progressMap.set(p.mission_id, { status: p.status, points_earned: p.points_earned });

  const missionsWithStatus = (allMissions || []).map((m) => ({
    ...m,
    status: progressMap.get(m.id)?.status || "locked",
    is_active: m.mission_key === state?.active_mission_key,
  }));

  const totalXp = (progress || []).filter((p) => p.status === "completed").reduce((s, p) => s + (p.points_earned || 0), 0);
  const completedCount = (progress || []).filter((p) => p.status === "completed").length;

  // Chapter breakdown
  const chapters: Record<number, { total: number; completed: number; active: boolean }> = {};
  for (const m of missionsWithStatus) {
    if (!m.chapter) continue;
    if (!chapters[m.chapter]) chapters[m.chapter] = { total: 0, completed: 0, active: false };
    chapters[m.chapter].total += 1;
    if (m.status === "completed") chapters[m.chapter].completed += 1;
    if (m.is_active) chapters[m.chapter].active = true;
  }

  return NextResponse.json({
    state,
    missions: missionsWithStatus,
    totals: { totalXp, completedCount, total: missionsWithStatus.length },
    chapters,
    streak: streakRow || { current_streak: 0, longest_streak: 0 },
  });
}
