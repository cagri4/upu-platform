/**
 * Bayi Insight — Kullanıcı bazlı performans ve iş analizi
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError } from "@/platform/whatsapp/error-handler";

export async function handleBayiInsight(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      activityRes,
      recentActivityRes,
      dealersRes,
      ordersRes,
      recentOrdersRes,
      criticalStockRes,
      collectionsRes,
      feedbackRes,
    ] = await Promise.all([
      // Command usage last 30 days
      supabase.from("bot_activity")
        .select("action")
        .eq("user_id", ctx.userId)
        .gte("created_at", thirtyDaysAgo),

      // Activity last 14 days (for trend)
      supabase.from("bot_activity")
        .select("created_at")
        .eq("user_id", ctx.userId)
        .gte("created_at", new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()),

      // Total dealers
      supabase.from("bayi_dealers")
        .select("id, status")
        .eq("tenant_id", ctx.tenantId),

      // All orders
      supabase.from("bayi_orders")
        .select("id, status, total_amount, created_at")
        .eq("tenant_id", ctx.tenantId),

      // Recent orders (last 30 days)
      supabase.from("bayi_orders")
        .select("id, total_amount, status")
        .eq("tenant_id", ctx.tenantId)
        .gte("created_at", thirtyDaysAgo),

      // Critical stock
      supabase.from("bayi_products")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .lt("stock_quantity", 10),

      // Outstanding balances
      supabase.from("bayi_dealers")
        .select("id, name, balance")
        .eq("tenant_id", ctx.tenantId)
        .gt("balance", 0)
        .order("balance", { ascending: false })
        .limit(5),

      // System feedback
      supabase.from("platform_events")
        .select("metadata")
        .eq("user_id", ctx.userId)
        .eq("event_type", "sale_feedback")
        .gte("created_at", thirtyDaysAgo),
    ]);

    // ── Compute ──────────────────────────────────────────

    // Command usage
    const actionCounts: Record<string, number> = {};
    for (const row of activityRes.data || []) {
      const a = row.action || "?";
      actionCounts[a] = (actionCounts[a] || 0) + 1;
    }
    const topCommands = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const totalCommands = activityRes.data?.length || 0;

    // Activity trend
    const recentRows = recentActivityRes.data || [];
    const thisWeek = recentRows.filter(r => r.created_at >= sevenDaysAgo).length;
    const lastWeek = recentRows.filter(r => r.created_at < sevenDaysAgo).length;
    const trendPct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;
    const trendEmoji = trendPct > 0 ? "📈" : trendPct < 0 ? "📉" : "➡️";

    // Dealers
    const allDealers = dealersRes.data || [];
    const activeDealers = allDealers.filter(d => d.status === "active" || d.status === "aktif").length;

    // Orders
    const allOrders = ordersRes.data || [];
    const recentOrders = recentOrdersRes.data || [];
    const pendingOrders = recentOrders.filter(o => o.status === "pending" || o.status === "beklemede").length;
    const completedOrders = recentOrders.filter(o => o.status === "completed" || o.status === "tamamlandi").length;
    const monthlyRevenue = recentOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Stock
    const criticalCount = criticalStockRes.data?.length || 0;

    // Collections
    const debts = collectionsRes.data || [];
    const totalDebt = debts.reduce((sum, d) => sum + (d.balance || 0), 0);

    // Feedback
    const ratings = (feedbackRes.data || [])
      .map(f => (f.metadata as Record<string, unknown>)?.system_rating as number)
      .filter(r => typeof r === "number");
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;

    // ── Build message ────────────────────────────────────

    const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(n);

    let text = `📊 *Bayi Performans Raporu* (Son 30 gün)\n\n`;

    // Activity
    text += `*Aktivite*\n`;
    text += `  Toplam komut: ${totalCommands}\n`;
    text += `  Bu hafta: ${thisWeek} | Geçen hafta: ${lastWeek} ${trendEmoji} ${trendPct > 0 ? "+" : ""}${trendPct}%\n\n`;

    // Dealers
    text += `*Bayi Ağı*\n`;
    text += `  Toplam bayi: ${allDealers.length}\n`;
    text += `  Aktif: ${activeDealers}\n\n`;

    // Orders
    text += `*Siparişler (30 gün)*\n`;
    text += `  Toplam: ${recentOrders.length}\n`;
    if (pendingOrders > 0) text += `  ⏳ Bekleyen: ${pendingOrders}\n`;
    if (completedOrders > 0) text += `  ✅ Tamamlanan: ${completedOrders}\n`;
    text += `  💰 Aylık ciro: ${fmt(monthlyRevenue)} TL\n`;
    text += `  💰 Toplam ciro: ${fmt(totalRevenue)} TL\n\n`;

    // Stock
    if (criticalCount > 0) {
      text += `*⚠️ Kritik Stok*\n`;
      text += `  ${criticalCount} üründe stok kritik seviyede\n\n`;
    }

    // Collections
    if (totalDebt > 0) {
      text += `*Tahsilat*\n`;
      text += `  Toplam alacak: ${fmt(totalDebt)} TL\n`;
      for (const d of debts.slice(0, 3)) {
        text += `  • ${d.name}: ${fmt(d.balance)} TL\n`;
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

    // Suggestions
    const suggestions: string[] = [];
    if (criticalCount > 0) suggestions.push(`${criticalCount} üründe stok kritik — tedarik siparişi oluşturun`);
    if (totalDebt > 0) suggestions.push(`${fmt(totalDebt)} TL alacak var — tahsilat hatırlatması gönderin`);
    if (pendingOrders > 3) suggestions.push(`${pendingOrders} bekleyen sipariş var — onaylayın veya kargolayın`);
    if (totalCommands < 10) suggestions.push("Sistemi daha aktif kullanarak verimliliğinizi artırın");

    if (suggestions.length > 0) {
      text += `\n💡 *Öneriler*\n`;
      for (const s of suggestions) {
        text += `  • ${s}\n`;
      }
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:ozet", title: "📋 Günlük Özet" },
      { id: "cmd:siparisler", title: "📦 Siparişler" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "bayi:insight", err, "db");
  }
}
