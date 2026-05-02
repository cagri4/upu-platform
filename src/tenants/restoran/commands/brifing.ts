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

    const todayMD = today.slice(5);
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const [salesYday, openOrders, todayReservations, criticalStock, tableStatus, birthdays, dormant] = await Promise.all([
      supabase
        .from("rst_orders")
        .select("total_amount, order_type")
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
        .select("id, party_size, guest_name, reserved_at, notes")
        .eq("tenant_id", ctx.tenantId)
        .gte("reserved_at", `${today}T00:00:00`)
        .lte("reserved_at", `${today}T23:59:59`)
        .not("status", "in", "(cancelled,no_show)")
        .order("reserved_at"),
      supabase
        .from("rst_inventory")
        .select("name, quantity, low_threshold, unit")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true)
        .not("low_threshold", "is", null),
      supabase
        .from("rst_tables")
        .select("status")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true),
      supabase
        .from("rst_loyalty_members")
        .select("guest_name")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true)
        .eq("birthday", todayMD)
        .limit(5),
      supabase
        .from("rst_loyalty_members")
        .select("guest_name, last_visit_at, visit_count")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true)
        .gte("visit_count", 10)
        .lt("last_visit_at", twoWeeksAgo)
        .order("visit_count", { ascending: false })
        .limit(3),
    ]);

    const yesterdayTotal = (salesYday.data || []).reduce((s, r) => s + (r.total_amount || 0), 0);
    const yesterdayCount = salesYday.data?.length || 0;
    const dineIn = (salesYday.data || []).filter(o => o.order_type === "dine_in").length;
    const takeaway = (salesYday.data || []).filter(o => o.order_type === "takeaway").length;
    const delivery = (salesYday.data || []).filter(o => o.order_type === "delivery").length;
    const openCount = openOrders.count || 0;
    const openTotal = (openOrders.data || []).reduce((s, r) => s + (r.total_amount || 0), 0);
    const reservations = todayReservations.data || [];
    const reservationCount = reservations.length;
    const reservationGuests = reservations.reduce((s, r) => s + (r.party_size || 0), 0);
    const critical = (criticalStock.data || []).filter(
      i => i.low_threshold != null && i.quantity <= i.low_threshold,
    );
    const tables = tableStatus.data || [];
    const occupied = tables.filter(t => t.status === "occupied").length;
    const totalTables = tables.length;
    const birthdayMembers = birthdays.data || [];
    const dormantMembers = dormant.data || [];

    const lines: string[] = [];
    lines.push(`☀️ *Günlük Brifing*`);
    lines.push(`${new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}`);
    lines.push("");

    lines.push(`💰 *Dün:* ${yesterdayCount} sipariş — ${formatCurrency(yesterdayTotal)}`);
    if (yesterdayCount > 0) {
      const parts: string[] = [];
      if (dineIn) parts.push(`${dineIn} salon`);
      if (takeaway) parts.push(`${takeaway} paket`);
      if (delivery) parts.push(`${delivery} teslimat`);
      if (parts.length) lines.push(`   ${parts.join(" · ")}`);
    }
    lines.push("");

    lines.push(`📋 Açık sipariş: *${openCount}*${openCount > 0 ? ` (${formatCurrency(openTotal)})` : ""}`);
    lines.push(`🍽 Masa doluluk: *${occupied}/${totalTables}*`);
    lines.push("");

    if (reservationCount > 0) {
      lines.push(`📅 *Bugün ${reservationCount} rezervasyon* (${reservationGuests} kişi)`);
      for (const r of reservations.slice(0, 4)) {
        const t = new Date(r.reserved_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        const note = r.notes ? ` — ${r.notes.length > 30 ? r.notes.slice(0, 30) + "..." : r.notes}` : "";
        lines.push(`   • ${t} ${r.guest_name} (${r.party_size}p)${note}`);
      }
      lines.push("");
    } else {
      lines.push(`📅 Bugün rezervasyon yok`);
      lines.push("");
    }

    if (birthdayMembers.length > 0) {
      lines.push(`🎂 *Bugün doğum günü* (${birthdayMembers.length})`);
      for (const m of birthdayMembers.slice(0, 3)) lines.push(`   • ${m.guest_name}`);
      lines.push("");
    }

    if (dormantMembers.length > 0) {
      lines.push(`💤 *Geri çağırma adayları*`);
      for (const m of dormantMembers) {
        const days = Math.floor((Date.now() - new Date(m.last_visit_at).getTime()) / 86400000);
        lines.push(`   • ${m.guest_name} — ${days} gün, ${m.visit_count} ziyaret`);
      }
      lines.push("");
    }

    if (critical.length) {
      lines.push(`🔴 *Kritik stok* (${critical.length})`);
      for (const i of critical.slice(0, 4)) {
        lines.push(`   • ${i.name}: ${i.quantity} ${i.unit || ""}`);
      }
    } else {
      lines.push(`🟢 *Stok:* Tüm kalemler yeterli`);
    }

    await sendButtons(ctx.phone, lines.join("\n"), [
      { id: "cmd:rezervasyonekle", title: "➕ Rezervasyon" },
      { id: "cmd:sadakat", title: "💝 Müdavim" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    console.error("[restoran:brifing] error:", err);
    await sendText(ctx.phone, "Brifing oluşturulurken bir hata oluştu.");
  }
}
