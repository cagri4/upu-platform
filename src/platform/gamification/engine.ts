/**
 * Gamification Engine — misyon takibi, streak, performans
 *
 * Platform seviyesi — tüm SaaS'lar için ortak motor.
 * Tenant-specific içerik ayrı dosyalarda tanımlanır.
 */

import { getServiceClient } from "@/platform/auth/supabase";

// ── Types ──────────────────────────────────────────────────────────

export interface Mission {
  id: string;
  tenant_key: string;
  role: string;
  category: string;
  mission_key: string;
  title: string;
  description: string;
  emoji: string;
  points: number;
  sort_order: number;
  is_repeatable: boolean;
  next_mission: string | null;
  notification_template: string | null;
}

export interface MissionProgress {
  id: string;
  user_id: string;
  mission_id: string;
  status: "locked" | "active" | "completed";
  completed_at: string | null;
  points_earned: number;
}

export interface DailyTask {
  id: string;
  user_id: string;
  task_type: string;
  title: string;
  description: string;
  emoji: string;
  command: string;
  entity_id: string | null;
  points: number;
  status: "pending" | "completed" | "skipped";
  due_date: string;
}

// ── Streak ──────────────────────────────────────────────────────────

export async function updateStreak(userId: string): Promise<{ current: number; longest: number }> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: streak } = await supabase
    .from("user_streaks")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!streak) {
    await supabase.from("user_streaks").insert({
      user_id: userId, current_streak: 1, longest_streak: 1, last_active_date: today,
    });
    return { current: 1, longest: 1 };
  }

  const lastDate = streak.last_active_date;
  if (lastDate === today) return { current: streak.current_streak, longest: streak.longest_streak };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newStreak: number;
  if (lastDate === yesterdayStr) {
    newStreak = streak.current_streak + 1;
  } else {
    newStreak = 1; // streak broken
  }

  const newLongest = Math.max(newStreak, streak.longest_streak);

  await supabase.from("user_streaks").update({
    current_streak: newStreak,
    longest_streak: newLongest,
    last_active_date: today,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return { current: newStreak, longest: newLongest };
}

export async function getStreak(userId: string): Promise<{ current: number; longest: number }> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("user_streaks").select("current_streak, longest_streak").eq("user_id", userId).maybeSingle();
  return { current: data?.current_streak || 0, longest: data?.longest_streak || 0 };
}

// ── Mission Progress ────────────────────────────────────────────────

export async function getUserMissions(userId: string, tenantKey: string): Promise<Array<Mission & { progress: MissionProgress | null }>> {
  const supabase = getServiceClient();

  const { data: missions } = await supabase
    .from("platform_missions")
    .select("*")
    .eq("tenant_key", tenantKey)
    .order("sort_order");

  const { data: progress } = await supabase
    .from("user_mission_progress")
    .select("*")
    .eq("user_id", userId);

  const progressMap: Record<string, MissionProgress> = {};
  for (const p of progress || []) progressMap[p.mission_id] = p as MissionProgress;

  return (missions || []).map(m => ({
    ...m as Mission,
    progress: progressMap[m.id] || null,
  }));
}

export async function completeMission(userId: string, missionKey: string): Promise<{ completed: boolean; points: number; nextMission: string | null; message: string; title: string; emoji: string; xpResult?: unknown }> {
  const supabase = getServiceClient();

  const { data: mission } = await supabase
    .from("platform_missions")
    .select("*")
    .eq("mission_key", missionKey)
    .single();

  if (!mission) return { completed: false, points: 0, nextMission: null, message: "", title: "", emoji: "" };

  // Find any existing progress row for this mission (could be active from onboarding)
  const { data: existing } = await supabase
    .from("user_mission_progress")
    .select("id, status")
    .eq("user_id", userId)
    .eq("mission_id", mission.id)
    .maybeSingle();

  // Already completed (non-repeatable) — no-op
  if (!mission.is_repeatable && existing?.status === "completed") {
    return { completed: false, points: 0, nextMission: null, message: "", title: mission.title, emoji: mission.emoji };
  }

  // Complete mission: UPDATE existing row if present, INSERT otherwise.
  // Explicit branch — not upsert — so we never leave an orphan active row
  // next to a new completed row (which would poison HUD/active queries).
  if (existing) {
    await supabase
      .from("user_mission_progress")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        points_earned: mission.points,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("user_mission_progress").insert({
      user_id: userId,
      mission_id: mission.id,
      status: "completed",
      completed_at: new Date().toISOString(),
      points_earned: mission.points,
    });
  }

  // Activate next mission if exists
  if (mission.next_mission) {
    const { data: nextMission } = await supabase
      .from("platform_missions")
      .select("id")
      .eq("mission_key", mission.next_mission)
      .single();

    if (nextMission) {
      const { data: nextProgress } = await supabase
        .from("user_mission_progress")
        .select("id")
        .eq("user_id", userId)
        .eq("mission_id", nextMission.id)
        .maybeSingle();

      if (!nextProgress) {
        await supabase.from("user_mission_progress").insert({
          user_id: userId, mission_id: nextMission.id, status: "active",
        });
      }
    }
  }

  const message = mission.notification_template || `${mission.emoji || "✅"} ${mission.title} tamamlandı!`;

  // ── Award XP to the employee tagged on this mission ──────────────
  let xpResult = null;
  if (mission.employee_key && mission.xp_reward) {
    try {
      // Resolve tenant_id from user profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", userId)
        .maybeSingle();

      if (prof?.tenant_id) {
        const { addXp } = await import("./progression");
        // Determine tenant_key from mission row
        const tenantKey = mission.tenant_key || "emlak";
        xpResult = await addXp(
          userId, prof.tenant_id, tenantKey,
          mission.employee_key,
          mission.xp_reward,
          "mission",
          mission.mission_key,
        );
      }
    } catch (err) {
      console.error("[engine:completeMission:xp]", err);
    }
  }

  return {
    completed: true,
    points: mission.points,
    nextMission: mission.next_mission,
    message,
    title: mission.title,
    emoji: mission.emoji || "✅",
    xpResult,
  };
}

// ── Daily Tasks ─────────────────────────────────────────────────────

export async function getDailyTasks(userId: string, tenantKey: string): Promise<DailyTask[]> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("user_daily_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_key", tenantKey)
    .eq("due_date", today)
    .order("created_at");

  return (data || []) as DailyTask[];
}

export async function completeDailyTask(userId: string, taskId: string): Promise<{ points: number }> {
  const supabase = getServiceClient();

  const { data: task } = await supabase
    .from("user_daily_tasks")
    .select("points, status")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (!task || task.status === "completed") return { points: 0 };

  await supabase.from("user_daily_tasks").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", taskId);

  return { points: task.points || 5 };
}

// ── Performance ─────────────────────────────────────────────────────

export async function getWeeklyPerformance(userId: string, tenantKey: string): Promise<{
  tasksCompleted: number; tasksTotal: number; stars: number; points: number; streak: number;
}> {
  const supabase = getServiceClient();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const { data: tasks } = await supabase
    .from("user_daily_tasks")
    .select("status")
    .eq("user_id", userId)
    .eq("tenant_key", tenantKey)
    .gte("due_date", weekStartStr);

  const total = tasks?.length || 0;
  const completed = tasks?.filter(t => t.status === "completed").length || 0;
  const ratio = total > 0 ? completed / total : 0;
  const stars = ratio >= 0.9 ? 5 : ratio >= 0.7 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.3 ? 2 : ratio > 0 ? 1 : 0;

  const streak = await getStreak(userId);

  // Calculate total points this week
  const { data: completedTasks } = await supabase
    .from("user_daily_tasks")
    .select("points")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("due_date", weekStartStr);

  const points = (completedTasks || []).reduce((sum, t) => sum + (t.points || 0), 0);

  return { tasksCompleted: completed, tasksTotal: total, stars, points, streak: streak.current };
}

// ── HUD Footer (active mission reminder) ────────────────────────────

/**
 * Returns a 1-line "active mission" reminder for appending to nav/menu
 * responses. Mimics the heads-up display in games — keeps the user's
 * current goal visible at all times so they don't get lost in menus.
 *
 * Returns empty string if no active mission (don't render anything).
 */
/**
 * Returns the user's current active mission row (lowest sort_order among
 * their active missions scoped to the tenant), or null if none.
 * Used by HUD footer, menu row, and other Quest Director surfaces.
 */
export async function getActiveMission(userId: string, tenantKey: string): Promise<{ mission_key: string; title: string; emoji: string } | null> {
  const supabase = getServiceClient();

  const { data: progresses } = await supabase
    .from("user_mission_progress")
    .select("mission_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!progresses || progresses.length === 0) return null;

  const ids = progresses.map(p => p.mission_id);
  const { data: missions } = await supabase
    .from("platform_missions")
    .select("mission_key, title, emoji, sort_order")
    .in("id", ids)
    .eq("tenant_key", tenantKey)
    .order("sort_order")
    .limit(1);

  const mission = missions?.[0];
  if (!mission) return null;

  return {
    mission_key: mission.mission_key,
    title: mission.title,
    emoji: mission.emoji || "○",
  };
}

export async function getActiveMissionFooter(userId: string, tenantKey: string): Promise<string> {
  const mission = await getActiveMission(userId, tenantKey);
  if (!mission) return "";
  return `\n\n━━━━━━━━━━━━━\n🎯 *Aktif Görev:* ${mission.emoji} ${mission.title}`;
}

// ── Progress Summary (for brifing) ──────────────────────────────────

export async function getProgressSummary(userId: string, tenantKey: string): Promise<string> {
  const streak = await getStreak(userId);
  const perf = await getWeeklyPerformance(userId, tenantKey);
  const tasks = await getDailyTasks(userId, tenantKey);
  const pendingTasks = tasks.filter(t => t.status === "pending");

  let text = "";

  // Streak
  if (streak.current > 0) {
    text += `🔥 Seri: ${streak.current} gün`;
    if (streak.current >= 7) text += " — harika!";
    text += "\n";
  }

  // Weekly stars
  const starStr = "⭐".repeat(perf.stars) + "☆".repeat(5 - perf.stars);
  text += `${starStr} Bu hafta: ${perf.tasksCompleted}/${perf.tasksTotal} görev\n`;

  // Today's tasks
  if (pendingTasks.length > 0) {
    text += `\n📋 *Bugünkü Görevler (${pendingTasks.length})*\n`;
    for (const task of pendingTasks.slice(0, 5)) {
      text += `${task.emoji || "○"} ${task.title}\n`;
    }
  } else if (tasks.length > 0) {
    text += `\n✅ Bugünkü tüm görevler tamamlandı!`;
  }

  return text;
}
