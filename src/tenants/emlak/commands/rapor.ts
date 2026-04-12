import type { WaContext } from "@/platform/whatsapp/types";
import { sendText } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

export async function handleRapor(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    // Last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [propTotal, propWeek, custTotal, custWeek, prezWeek, contractTotal] = await Promise.all([
      supabase.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("status", "aktif"),
      supabase.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).gte("created_at", weekAgo),
      supabase.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId),
      supabase.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).gte("created_at", weekAgo),
      supabase.from("emlak_presentations").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).gte("created_at", weekAgo),
      supabase.from("contracts").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId),
    ]);

    // Streak + gamification
    const { getStreak, getWeeklyPerformance } = await import("@/platform/gamification/engine");
    const streak = await getStreak(ctx.userId);
    const perf = await getWeeklyPerformance(ctx.userId, ctx.tenantKey);

    const starStr = "⭐".repeat(perf.stars) + "☆".repeat(5 - perf.stars);

    let text = `📊 *Haftalık Rapor*\n\n`;

    text += `🏠 Mülk: ${propTotal.count || 0} toplam`;
    if (propWeek.count) text += ` (+${propWeek.count} bu hafta)`;
    text += `\n`;

    text += `👥 Müşteri: ${custTotal.count || 0} toplam`;
    if (custWeek.count) text += ` (+${custWeek.count} bu hafta)`;
    text += `\n`;

    if (prezWeek.count) text += `🎯 Sunum: ${prezWeek.count} bu hafta\n`;
    text += `📄 Sözleşme: ${contractTotal.count || 0} toplam\n`;

    text += `\n━━━━━━━━━━━━━\n`;
    text += `🔥 Seri: ${streak.current} gün\n`;
    text += `${starStr} Görev: ${perf.tasksCompleted}/${perf.tasksTotal}\n`;

    if ((propTotal.count || 0) === 0 && (custTotal.count || 0) === 0) {
      text += `\n_Henüz yeterli veri yok. Bir hafta sonra detaylı rapor burada olacak._`;
    }

    await sendText(ctx.phone, text);
    await logEvent(ctx.tenantId, ctx.userId, "rapor", `${propTotal.count || 0} mülk, ${custTotal.count || 0} müşteri`);
  } catch (err) {
    await handleError(ctx, "emlak:rapor", err, "db");
  }
}
