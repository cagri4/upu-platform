/**
 * /doluluk — Occupancy rate analysis
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, today, todayISO, NO_HOTEL_MSG } from "./helpers";

export async function handleDoluluk(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const todayStr = todayISO();

    // Total rooms
    const { data: allRooms } = await supabase
      .from("otel_rooms")
      .select("id, name, status, room_type")
      .eq("hotel_id", hotelId)
      .order("sort_order", { ascending: true });

    const rooms = allRooms || [];
    const totalRooms = rooms.length;
    const outOfOrder = rooms.filter(r => r.status === "out_of_order").length;
    const availableRooms = totalRooms - outOfOrder;

    // Currently occupied (checked_in with overlapping dates)
    const { data: activeReservations } = await supabase
      .from("otel_reservations")
      .select("room_id, guest_name, check_out")
      .eq("hotel_id", hotelId)
      .eq("status", "checked_in");

    const occupiedCount = activeReservations?.length || 0;
    const occupancyRate = availableRooms > 0 ? Math.round((occupiedCount / availableRooms) * 100) : 0;

    // 7-day forecast
    const forecasts: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() + i * 86400000);
      const dateStr = date.toISOString().split("T")[0];
      const nextDateStr = new Date(Date.now() + (i + 1) * 86400000).toISOString().split("T")[0];

      const { count } = await supabase
        .from("otel_reservations")
        .select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .in("status", ["confirmed", "checked_in"])
        .lte("check_in", dateStr)
        .gt("check_out", dateStr);

      const dayOccupied = count || 0;
      const dayRate = availableRooms > 0 ? Math.round((dayOccupied / availableRooms) * 100) : 0;
      const dayName = date.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" });
      const bar = "█".repeat(Math.round(dayRate / 10)) + "░".repeat(10 - Math.round(dayRate / 10));
      forecasts.push(`${dayName}: ${bar} %${dayRate} (${dayOccupied}/${availableRooms})`);
    }

    // Room type breakdown
    const typeCount: Record<string, { total: number; occupied: number }> = {};
    const occupiedRoomIds = new Set((activeReservations || []).map((r: any) => r.room_id));
    for (const room of rooms) {
      if (!typeCount[room.room_type]) typeCount[room.room_type] = { total: 0, occupied: 0 };
      typeCount[room.room_type].total++;
      if (occupiedRoomIds.has(room.id)) typeCount[room.room_type].occupied++;
    }

    const typeLines = Object.entries(typeCount).map(([type, counts]) => {
      const rate = counts.total > 0 ? Math.round((counts.occupied / counts.total) * 100) : 0;
      return `  ${type}: ${counts.occupied}/${counts.total} (%${rate})`;
    });

    let text = `*Doluluk Analizi* — ${today()}\n\n`;
    text += `🏨 *Anlik Durum*\n`;
    text += `  Toplam oda: ${totalRooms}\n`;
    text += `  Musait: ${availableRooms - occupiedCount}\n`;
    text += `  Dolu: ${occupiedCount}\n`;
    text += `  Ariza: ${outOfOrder}\n`;
    text += `  *Doluluk: %${occupancyRate}*\n\n`;
    text += `📊 *Oda Tipi Dagilimi*\n${typeLines.join("\n")}\n\n`;
    text += `📅 *7 Gunluk Tahmin*\n${forecasts.join("\n")}`;

    await sendButtons(ctx.phone, prefix("genel", text), [
      { id: "cmd:musaitlik", title: "Musaitlik" },
      { id: "cmd:rapor", title: "Rapor" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[otel:doluluk] error:", err);
    await sendButtons(ctx.phone, "Doluluk bilgisi yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
