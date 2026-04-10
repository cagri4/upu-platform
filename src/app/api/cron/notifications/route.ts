/**
 * Cron: Proactive Notification Engine
 *
 * Zamanlanmış WhatsApp bildirimleri — kullanıcıyı sisteme çeker.
 * Vercel Cron schedule:
 *   - Sabah:  0 6 * * *  (09:00 TR)
 *   - Öğle:   0 9 * * *  (12:00 TR)
 *   - Akşam:  0 15 * * * (18:00 TR)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getDailyTasks, getStreak, getWeeklyPerformance } from "@/platform/gamification/engine";
import { getActiveSeason } from "@/platform/gamification/progression";

export const dynamic = "force-dynamic";

// ── Notification templates ──────────────────────────────────────────

interface NotificationContext {
  userId: string;
  phone: string;
  userName: string;
  tenantKey: string;
  tenantId: string;
}

async function sendMorningNotification(ctx: NotificationContext): Promise<boolean> {
  const streak = await getStreak(ctx.userId);
  const tasks = await getDailyTasks(ctx.userId, ctx.tenantKey);
  const pendingTasks = tasks.filter(t => t.status === "pending");

  if (pendingTasks.length === 0 && streak.current === 0) return false;

  let msg = "";

  // Active seasonal event banner
  try {
    const season = await getActiveSeason(ctx.tenantKey);
    if (season) {
      msg += `${season.title} — x${season.bonus_xp_multiplier} XP aktif!\n\n`;
    }
  } catch { /* ignore */ }

  // Streak message
  if (streak.current > 0) {
    if (streak.current >= 30) msg += `🔥 ${streak.current} gün seri! İnanılmaz!\n\n`;
    else if (streak.current >= 7) msg += `🔥 ${streak.current} gün seri! Harika gidiyorsunuz!\n\n`;
    else if (streak.current >= 3) msg += `🔥 ${streak.current} gün seri! Devam edin!\n\n`;
    else msg += `🔥 Seri: ${streak.current} gün\n\n`;
  }

  // Tasks
  if (pendingTasks.length > 0) {
    msg += `📋 Bugün ${pendingTasks.length} göreviniz var:\n\n`;
    for (const task of pendingTasks.slice(0, 4)) {
      msg += `${task.emoji || "○"} ${task.title}\n`;
      if (task.description) msg += `   ${task.description.substring(0, 60)}\n`;
    }
    if (pendingTasks.length > 4) msg += `   +${pendingTasks.length - 4} görev daha\n`;
  } else {
    msg += `✅ Bugün için henüz görev üretilmedi. "brifing" yazarak günlük özetinizi alın.\n`;
  }

  const buttons = [];
  if (pendingTasks.length > 0 && pendingTasks[0].command) {
    buttons.push({ id: `cmd:${pendingTasks[0].command}`, title: `${pendingTasks[0].emoji || "▶"} ${pendingTasks[0].title.substring(0, 18)}` });
  }
  buttons.push({ id: "cmd:brifing", title: "📋 Brifing" });
  if (buttons.length < 3) buttons.push({ id: "cmd:menu", title: "Ana Menü" });

  await sendButtons(ctx.phone, msg, buttons);
  return true;
}

async function sendMiddayNotification(ctx: NotificationContext): Promise<boolean> {
  const tasks = await getDailyTasks(ctx.userId, ctx.tenantKey);
  const pending = tasks.filter(t => t.status === "pending");
  const completed = tasks.filter(t => t.status === "completed");

  // Only send if there are pending tasks and user hasn't completed any today
  if (pending.length === 0) return false;
  if (completed.length > 0) return false; // Already active today

  const supabase = getServiceClient();

  // Check if user was active today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todayActivity } = await supabase
    .from("bot_activity")
    .select("id")
    .eq("user_id", ctx.userId)
    .gte("created_at", todayStart.toISOString())
    .limit(1);

  if (todayActivity?.length) return false; // Already active

  // Nudge message
  const messages = [
    `⏰ ${ctx.userName}, bugün henüz sisteme girmediniz. ${pending.length} göreviniz bekliyor!`,
    `📢 ${ctx.userName}, ${pending.length} tamamlanmamış göreviniz var. 5 dakikanız var mı?`,
    `💡 ${ctx.userName}, bugün portföyünüze göz attınız mı? ${pending.length} görev sizi bekliyor.`,
  ];
  const msg = messages[Math.floor(Math.random() * messages.length)];

  await sendButtons(ctx.phone, msg, [
    { id: `cmd:${pending[0]?.command || "brifing"}`, title: `▶ ${(pending[0]?.title || "Başla").substring(0, 20)}` },
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
  return true;
}

async function sendEveningNotification(ctx: NotificationContext): Promise<boolean> {
  const perf = await getWeeklyPerformance(ctx.userId, ctx.tenantKey);
  const streak = await getStreak(ctx.userId);
  const tasks = await getDailyTasks(ctx.userId, ctx.tenantKey);
  const completed = tasks.filter(t => t.status === "completed").length;
  const total = tasks.length;

  if (total === 0) return false;

  let msg = `📊 *Günün Özeti*\n\n`;

  if (completed === total && total > 0) {
    msg += `🎉 Tüm görevleri tamamladınız! (${completed}/${total})\n`;
  } else if (completed > 0) {
    msg += `✅ ${completed}/${total} görev tamamlandı\n`;
  } else {
    msg += `○ Bugün görev tamamlanmadı\n`;
  }

  // Streak
  if (streak.current > 0) {
    msg += `🔥 Seri: ${streak.current} gün\n`;
  } else {
    msg += `⚠️ Seriniz kırıldı! Yarın tekrar başlayın.\n`;
  }

  // Weekly stars
  const starStr = "⭐".repeat(perf.stars) + "☆".repeat(5 - perf.stars);
  msg += `${starStr} Bu hafta: ${perf.tasksCompleted}/${perf.tasksTotal}\n`;

  // Motivational closer
  if (completed === total && total > 0) {
    msg += `\n💪 Yarın da böyle devam!`;
  } else {
    msg += `\n💡 Yarın daha iyi olacak. İyi geceler!`;
  }

  await sendText(ctx.phone, msg);
  return true;
}

// ── Main cron handler ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const timeSlot = req.nextUrl.searchParams.get("slot") || detectTimeSlot();
    const supabase = getServiceClient();

    // Get all active users with phones
    const { data: users } = await supabase
      .from("profiles")
      .select("id, display_name, whatsapp_phone, tenant_id, role")
      .not("whatsapp_phone", "is", null)
      .in("role", ["admin", "user"]);

    if (!users?.length) return NextResponse.json({ sent: 0 });

    // Get tenant keys
    const tenantIds = [...new Set(users.map(u => u.tenant_id).filter(Boolean))];
    const { data: tenants } = await supabase.from("tenants").select("id, saas_type").in("id", tenantIds);
    const tenantMap: Record<string, string> = {};
    for (const t of tenants || []) tenantMap[t.id] = t.saas_type;

    let sent = 0;

    for (const user of users) {
      const ctx: NotificationContext = {
        userId: user.id,
        phone: user.whatsapp_phone!,
        userName: user.display_name || "",
        tenantKey: tenantMap[user.tenant_id] || "",
        tenantId: user.tenant_id || "",
      };

      try {
        let didSend = false;
        if (timeSlot === "morning") didSend = await sendMorningNotification(ctx);
        else if (timeSlot === "midday") didSend = await sendMiddayNotification(ctx);
        else if (timeSlot === "evening") didSend = await sendEveningNotification(ctx);

        if (didSend) sent++;
      } catch (err) {
        console.error(`[notifications] Error for ${user.id}:`, err);
      }
    }

    return NextResponse.json({ sent, total: users.length, slot: timeSlot });
  } catch (err) {
    console.error("[notifications]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function detectTimeSlot(): string {
  const hour = new Date().getUTCHours();
  if (hour >= 5 && hour < 8) return "morning"; // 08-11 TR
  if (hour >= 8 && hour < 13) return "midday"; // 11-16 TR
  return "evening"; // 16+ TR
}
