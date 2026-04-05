/**
 * /insight — Kullanıcı bazlı performans ve kullanım analizi
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError } from "@/platform/whatsapp/error-handler";

export async function handleInsight(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Parallel queries
    const [
      activityRes,
      recentActivityRes,
      propsRes,
      soldRes,
      presentationsRes,
      feedbackRes,
      staleRes,
    ] = await Promise.all([
      // Total command usage last 30 days
      supabase
        .from("bot_activity")
        .select("action", { count: "exact", head: false })
        .eq("user_id", ctx.userId)
        .gte("created_at", thirtyDaysAgo),

      // Activity last 7 days vs previous 7 days
      supabase
        .from("bot_activity")
        .select("created_at")
        .eq("user_id", ctx.userId)
        .gte("created_at", new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()),

      // Property stats
      supabase
        .from("emlak_properties")
        .select("id, status, created_at, updated_at")
        .eq("user_id", ctx.userId)
        .eq("tenant_id", ctx.tenantId),

      // Sold/rented in last 30 days
      supabase
        .from("emlak_properties")
        .select("id, title, status, updated_at")
        .eq("user_id", ctx.userId)
        .eq("tenant_id", ctx.tenantId)
        .in("status", ["satildi", "kiralandi"])
        .gte("updated_at", thirtyDaysAgo),

      // Presentations
      supabase
        .from("emlak_presentations")
        .select("id, created_at")
        .eq("user_id", ctx.userId)
        .gte("created_at", thirtyDaysAgo),

      // Sale feedback ratings
      supabase
        .from("platform_events")
        .select("metadata")
        .eq("user_id", ctx.userId)
        .eq("event_type", "sale_feedback")
        .gte("created_at", thirtyDaysAgo),

      // Stale properties (30+ days no update)
      supabase
        .from("emlak_properties")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("tenant_id", ctx.tenantId)
        .eq("status", "aktif")
        .lt("updated_at", thirtyDaysAgo),
    ]);

    // ── Compute insights ─────────────────────────────────

    // 1. Command usage top 5
    const actionCounts: Record<string, number> = {};
    for (const row of activityRes.data || []) {
      const a = row.action || "bilinmiyor";
      actionCounts[a] = (actionCounts[a] || 0) + 1;
    }
    const topCommands = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const totalCommands30d = activityRes.data?.length || 0;

    // 2. Activity trend (this week vs last week)
    const recentRows = recentActivityRes.data || [];
    const thisWeekCount = recentRows.filter(r => r.created_at >= sevenDaysAgo).length;
    const lastWeekCount = recentRows.filter(r => r.created_at < sevenDaysAgo).length;
    const trendPct = lastWeekCount > 0
      ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
      : thisWeekCount > 0 ? 100 : 0;
    const trendEmoji = trendPct > 0 ? "📈" : trendPct < 0 ? "📉" : "➡️";

    // 3. Property stats
    const allProps = propsRes.data || [];
    const activeCount = allProps.filter(p => p.status === "aktif").length;
    const soldCount = (soldRes.data || []).filter(p => p.status === "satildi").length;
    const rentedCount = (soldRes.data || []).filter(p => p.status === "kiralandi").length;
    const staleCount = staleRes.data?.length || 0;

    // 4. Presentation stats
    const presCount = presentationsRes.data?.length || 0;

    // 5. Feedback average
    const feedbacks = feedbackRes.data || [];
    const ratings = feedbacks
      .map(f => (f.metadata as Record<string, unknown>)?.system_rating as number)
      .filter(r => typeof r === "number");
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;

    // ── Build message ────────────────────────────────────

    let text = `📊 *Performans Raporu* (Son 30 gün)\n\n`;

    // Activity overview
    text += `*Aktivite*\n`;
    text += `  Toplam komut: ${totalCommands30d}\n`;
    text += `  Bu hafta: ${thisWeekCount} | Geçen hafta: ${lastWeekCount} ${trendEmoji} ${trendPct > 0 ? "+" : ""}${trendPct}%\n\n`;

    // Property overview
    text += `*Portföy*\n`;
    text += `  Aktif mülk: ${activeCount}\n`;
    if (soldCount > 0) text += `  Satılan: ${soldCount} 🎉\n`;
    if (rentedCount > 0) text += `  Kiralanan: ${rentedCount} 🏠\n`;
    if (staleCount > 0) text += `  ⚠️ Hareketsiz (30+ gün): ${staleCount}\n`;
    text += `\n`;

    // Presentations
    if (presCount > 0) {
      text += `*Sunumlar*\n`;
      text += `  Gönderilen: ${presCount}\n`;
      if (soldCount + rentedCount > 0 && presCount > 0) {
        const convRate = Math.round(((soldCount + rentedCount) / presCount) * 100);
        text += `  Dönüşüm oranı: ~%${convRate}\n`;
      }
      text += `\n`;
    }

    // System rating
    if (avgRating) {
      text += `*Sistem Değerlendirmesi*\n`;
      text += `  Ortalama puan: ${avgRating}/10 (${ratings.length} değerlendirme)\n\n`;
    }

    // Top commands
    if (topCommands.length > 0) {
      text += `*En Çok Kullanılan*\n`;
      for (const [cmd, count] of topCommands) {
        text += `  ${cmd}: ${count}\n`;
      }
    }

    // Smart suggestions
    const suggestions: string[] = [];
    if (staleCount > 0) {
      suggestions.push(`${staleCount} mülkünüz 30+ gündür güncellenmemiş — fiyat revizyonu düşünün`);
    }
    if (presCount === 0 && activeCount > 0) {
      suggestions.push("Henüz sunum göndermemişsiniz — /sunum ile müşterilerinize sunum hazırlayın");
    }
    if (totalCommands30d < 10) {
      suggestions.push("Sistemi daha aktif kullanarak potansiyelinden faydalanın");
    }
    if (trendPct < -30) {
      suggestions.push("Kullanım azalmış — düzenli kullanım daha iyi sonuç getirir");
    }

    if (suggestions.length > 0) {
      text += `\n💡 *Öneriler*\n`;
      for (const s of suggestions) {
        text += `  • ${s}\n`;
      }
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:brifing", title: "📋 Brifing" },
      { id: "cmd:mulkyonet", title: "🏠 Mülk Yönet" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "emlak:insight", err, "db");
  }
}
