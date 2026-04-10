/**
 * /ekibim — Employee career overview (character sheet)
 *
 * Shows the user's 5 virtual employees with their current tier, XP
 * progress bar, and the user's own meta-rank as Emlak Danışmanı.
 * Platform-level command, available across all tenants.
 */
import type { WaContext } from "./types";
import { sendButtons } from "./send";
import { getUserEmployeeState, getActiveSeason } from "@/platform/gamification/progression";
import { getStreak } from "@/platform/gamification/engine";

function progressBar(pct: number): string {
  const filled = Math.round(pct / 12.5); // 8 blocks total
  return "▓".repeat(filled) + "░".repeat(8 - filled);
}

export async function handleEkibim(ctx: WaContext): Promise<void> {
  try {
    const [state, streak, season] = await Promise.all([
      getUserEmployeeState(ctx.userId, ctx.tenantKey),
      getStreak(ctx.userId),
      getActiveSeason(ctx.tenantKey),
    ]);

    // Header
    let msg = `🏢 *Ekibim*\n`;
    msg += `👤 ${ctx.userName || "Sen"} — ${state.rank_name}\n`;
    msg += `\n━━━━━━━━━━━━━━━━━━━\n`;

    // Each employee
    for (const emp of state.employees) {
      msg += `\n${emp.icon} *${emp.name}* — ${emp.tier_name} ${emp.stars}\n`;
      msg += `   XP: ${emp.xp}/${emp.xp_next} (${progressBar(emp.xp_progress)} ${emp.xp_progress}%)\n`;
      if (emp.tier < 5) {
        const remaining = emp.xp_next - emp.xp;
        msg += `   → ${remaining} XP daha\n`;
      } else {
        msg += `   → ✅ MAX\n`;
      }
    }

    msg += `\n━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 Toplam XP: ${state.total_xp}\n`;
    msg += `🔥 Seri: ${streak.current} gün\n`;

    if (season) {
      msg += `${season.title} aktif (x${season.bonus_xp_multiplier} XP)\n`;
    }

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:menu", title: "📋 Ana Menü" },
    ]);
  } catch (err) {
    console.error("[ekibim]", err);
    await sendButtons(ctx.phone, "Ekip bilgileri yüklenemedi.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  }
}
