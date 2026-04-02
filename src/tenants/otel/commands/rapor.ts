/**
 * /rapor — Revenue and occupancy reports with period selection
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, formatCurrency, NO_HOTEL_MSG } from "./helpers";

// ── Command entry ───────────────────────────────────────────────────────

export async function handleRapor(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  await sendButtons(ctx.phone,
    prefix("genel", "*Raporlar*\n\nHangi raporu gormek istersiniz?"),
    [
      { id: "rapor_period:7", title: "Son 7 Gun" },
      { id: "rapor_period:30", title: "Son 30 Gun" },
      { id: "rapor_period:90", title: "Son 90 Gun" },
    ],
  );
}

// ── Callback handler ────────────────────────────────────────────────────

export async function handleRaporCallback(ctx: WaContext, data: string): Promise<void> {
  if (!data.startsWith("rapor_period:")) return;

  const days = parseInt(data.replace("rapor_period:", ""));
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) return;

  try {
    const supabase = getServiceClient();
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

    // Revenue from reservations
    const { data: reservations } = await supabase
      .from("otel_reservations")
      .select("total_price, status, check_in, check_out")
      .eq("hotel_id", hotelId)
      .gte("check_in", startDate)
      .in("status", ["confirmed", "checked_in", "checked_out"]);

    const totalRevenue = (reservations || []).reduce((sum: number, r: any) => sum + (r.total_price || 0), 0);
    const totalReservations = (reservations || []).length;
    const checkedOut = (reservations || []).filter((r: any) => r.status === "checked_out").length;
    const active = (reservations || []).filter((r: any) => r.status === "checked_in" || r.status === "confirmed").length;

    // Total rooms for occupancy
    const { count: totalRooms } = await supabase
      .from("otel_rooms")
      .select("*", { count: "exact", head: true })
      .eq("hotel_id", hotelId);

    // Current occupancy
    const { count: occupiedNow } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("status", "checked_in");

    const rooms = totalRooms || 1;
    const occupancyRate = Math.round(((occupiedNow || 0) / rooms) * 100);
    const avgRevenue = totalReservations > 0 ? Math.round(totalRevenue / totalReservations) : 0;

    // Cancelled count
    const { count: cancelledCount } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("status", "cancelled")
      .gte("check_in", startDate);

    // Guest messages count
    const { count: messageCount } = await supabase
      .from("otel_guest_messages")
      .select("*", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("direction", "inbound")
      .gte("created_at", new Date(Date.now() - days * 86400000).toISOString());

    let text = `*Rapor — Son ${days} Gun*\n\n`;
    text += `💰 *Gelir*\n`;
    text += `  Toplam: ${formatCurrency(totalRevenue)}\n`;
    text += `  Ortalama/rez: ${formatCurrency(avgRevenue)}\n\n`;
    text += `📊 *Rezervasyonlar*\n`;
    text += `  Toplam: ${totalReservations}\n`;
    text += `  Aktif: ${active}\n`;
    text += `  Tamamlanan: ${checkedOut}\n`;
    text += `  Iptal: ${cancelledCount || 0}\n\n`;
    text += `🏨 *Doluluk*\n`;
    text += `  Toplam oda: ${rooms}\n`;
    text += `  Anlik doluluk: %${occupancyRate}\n\n`;
    text += `💬 *Iletisim*\n`;
    text += `  Gelen mesaj: ${messageCount || 0}`;

    await sendButtons(ctx.phone, prefix("genel", text), [
      { id: "cmd:gelir", title: "Gelir Detay" },
      { id: "cmd:doluluk", title: "Doluluk Detay" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[otel:rapor] error:", err);
    await sendButtons(ctx.phone, "Rapor yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
