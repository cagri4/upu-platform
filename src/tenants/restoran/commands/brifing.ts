/**
 * /brifing — Günlük özet (dünkü satış, bugünkü rezervasyon, açık masa, kritik stok)
 * /gunsonu — alias
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, todayISO } from "./helpers";

export async function handleBrifing(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = todayISO();
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

    const [salesYday, openOrders, todayReservations, criticalStock, tableStatus] = await Promise.all([
      supabase
        .from("rst_orders")
        .select("total_amount")
        .eq("tenant_id", ctx.tenantId)
        .eq("status", "paid")
        .gte("created_at", `${yesterday}T00:00:00`)
        .lte("created_at", `${yesterday}T23:59:59`),
      supabase
        .from("rst_orders")
        .select("id, total_amount", { count: "exact" })
        .eq("tenant_id", ctx.tenantId)
        .in("status", ["new", "preparing", "ready", "served"]),
      supabase
        .from("rst_reservations")
        .select("id, party_size", { count: "exact" })
        .eq("tenant_id", ctx.tenantId)
        .gte("reserved_at", `${today}T00:00:00`)
        .lte("reserved_at", `${today}T23:59:59`)
        .not("status", "in", "(cancelled,no_show)"),
      supabase
        .from("rst_inventory")
        .select("name, quantity, low_threshold")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true)
        .not("low_threshold", "is", null),
      supabase
        .from("rst_tables")
        .select("status")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true),
    ]);

    const yesterdayTotal = (salesYday.data || []).reduce((s, r) => s + (r.total_amount || 0), 0);
    const yesterdayCount = salesYday.data?.length || 0;
    const openCount = openOrders.count || 0;
    const openTotal = (openOrders.data || []).reduce((s, r) => s + (r.total_amount || 0), 0);
    const reservationCount = todayReservations.count || 0;
    const reservationGuests = (todayReservations.data || []).reduce((s, r) => s + (r.party_size || 0), 0);
    const critical = (criticalStock.data || []).filter(
      i => i.low_threshold != null && i.quantity <= i.low_threshold,
    );
    const tables = tableStatus.data || [];
    const occupied = tables.filter(t => t.status === "occupied").length;
    const totalTables = tables.length;

    let msg = `☀️ *Günlük Brifing*\n${new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}\n\n`;

    msg += `💰 *Dün:* ${yesterdayCount} sipariş — ${formatCurrency(yesterdayTotal)}\n\n`;

    msg += `📋 *Açık siparişler:* ${openCount}`;
    if (openCount > 0) msg += ` (${formatCurrency(openTotal)})`;
    msg += `\n`;

    msg += `🍽 *Masa doluluk:* ${occupied}/${totalTables}\n`;

    msg += `📅 *Bugün rezervasyon:* ${reservationCount}`;
    if (reservationGuests > 0) msg += ` (${reservationGuests} kişi)`;
    msg += `\n`;

    if (critical.length) {
      msg += `\n🔴 *Kritik stok* (${critical.length}):\n`;
      msg += critical.slice(0, 5).map(i => `   • ${i.name}: ${i.quantity}`).join("\n");
      if (critical.length > 5) msg += `\n   …ve ${critical.length - 5} kalem daha`;
    } else {
      msg += `\n🟢 *Stok:* Tüm kalemler yeterli`;
    }

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:siparis", title: "📋 Siparişler" },
      { id: "cmd:masa", title: "🍽 Masalar" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    console.error("[restoran:brifing] error:", err);
    await sendText(ctx.phone, "Brifing oluşturulurken bir hata oluştu.");
  }
}
