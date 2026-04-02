/**
 * /gelir — Daily/weekly revenue summary
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, today, formatCurrency, todayISO, NO_HOTEL_MSG } from "./helpers";

export async function handleGelir(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const todayStr = todayISO();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    // Today's check-outs (realized revenue)
    const { data: todayCheckouts } = await supabase
      .from("otel_reservations")
      .select("total_price, guest_name")
      .eq("hotel_id", hotelId)
      .eq("status", "checked_out")
      .gte("check_out", todayStr)
      .lt("check_out", new Date(Date.now() + 86400000).toISOString().split("T")[0]);

    const todayRevenue = (todayCheckouts || []).reduce((sum: number, r: any) => sum + (r.total_price || 0), 0);

    // Weekly revenue
    const { data: weekReservations } = await supabase
      .from("otel_reservations")
      .select("total_price")
      .eq("hotel_id", hotelId)
      .in("status", ["checked_out", "checked_in", "confirmed"])
      .gte("check_in", weekAgo);

    const weekRevenue = (weekReservations || []).reduce((sum: number, r: any) => sum + (r.total_price || 0), 0);

    // Monthly revenue
    const { data: monthReservations } = await supabase
      .from("otel_reservations")
      .select("total_price")
      .eq("hotel_id", hotelId)
      .in("status", ["checked_out", "checked_in", "confirmed"])
      .gte("check_in", monthAgo);

    const monthRevenue = (monthReservations || []).reduce((sum: number, r: any) => sum + (r.total_price || 0), 0);

    // Upcoming confirmed revenue
    const { data: upcoming } = await supabase
      .from("otel_reservations")
      .select("total_price")
      .eq("hotel_id", hotelId)
      .eq("status", "confirmed")
      .gte("check_in", todayStr);

    const upcomingRevenue = (upcoming || []).reduce((sum: number, r: any) => sum + (r.total_price || 0), 0);

    let text = `*Gelir Ozeti* — ${today()}\n\n`;
    text += `📅 Bugun: ${formatCurrency(todayRevenue)}`;
    if (todayCheckouts?.length) {
      text += ` (${todayCheckouts.length} check-out)`;
    }
    text += `\n📆 Bu hafta: ${formatCurrency(weekRevenue)}`;
    text += ` (${weekReservations?.length || 0} rez)`;
    text += `\n📅 Bu ay: ${formatCurrency(monthRevenue)}`;
    text += ` (${monthReservations?.length || 0} rez)`;
    text += `\n\n💰 *Beklenen gelir:* ${formatCurrency(upcomingRevenue)}`;
    text += ` (${upcoming?.length || 0} onaylanmis rez)`;

    await sendButtons(ctx.phone, prefix("genel", text), [
      { id: "cmd:rapor", title: "Detayli Rapor" },
      { id: "cmd:doluluk", title: "Doluluk" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[otel:gelir] error:", err);
    await sendButtons(ctx.phone, "Gelir bilgisi yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
