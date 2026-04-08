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

export async function completeMission(userId: string, missionKey: string): Promise<{ completed: boolean; points: number; nextMission: string | null; message: string }> {
  const supabase = getServiceClient();

  const { data: mission } = await supabase
    .from("platform_missions")
    .select("*")
    .eq("mission_key", missionKey)
    .single();

  if (!mission) return { completed: false, points: 0, nextMission: null, message: "" };

  // Check if already completed (non-repeatable)
  if (!mission.is_repeatable) {
    const { data: existing } = await supabase
      .from("user_mission_progress")
      .select("id, status")
      .eq("user_id", userId)
      .eq("mission_id", mission.id)
      .maybeSingle();

    if (existing?.status === "completed") {
      return { completed: false, points: 0, nextMission: null, message: "" };
    }
  }

  // Complete mission
  await supabase.from("user_mission_progress").upsert({
    user_id: userId,
    mission_id: mission.id,
    status: "completed",
    completed_at: new Date().toISOString(),
    points_earned: mission.points,
  });

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

  const message = mission.notification_template || `${mission.emoji || "✅"} ${mission.title} tamamlandı! +${mission.points} puan`;

  return {
    completed: true,
    points: mission.points,
    nextMission: mission.next_mission,
    message,
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
