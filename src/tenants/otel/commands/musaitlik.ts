/**
 * /musaitlik — Room availability for the next 7 days
 * /fiyat — Room prices
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, todayISO, NO_HOTEL_MSG } from "./helpers";

export async function handleMusaitlik(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const todayStr = todayISO();
    const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    // Get all rooms
    const { data: rooms } = await supabase
      .from("otel_rooms")
      .select("id, name, status")
      .eq("hotel_id", hotelId)
      .order("sort_order", { ascending: true });

    if (!rooms?.length) {
      await sendButtons(ctx.phone,
        prefix("rezervasyon", "Henuz oda tanimlanmamis."),
        [{ id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    // Get reservations overlapping next 7 days
    const { data: reservations } = await supabase
      .from("otel_reservations")
      .select("room_id, check_in, check_out")
      .eq("hotel_id", hotelId)
      .in("status", ["confirmed", "checked_in"])
      .lt("check_in", weekLater)
      .gt("check_out", todayStr);

    const bookedRoomIds = new Set((reservations ?? []).map((r: any) => r.room_id));
    const outOfOrder = rooms.filter((r: any) => r.status === "out_of_order");
    const available = rooms.filter((r: any) => !bookedRoomIds.has(r.id) && r.status !== "out_of_order");
    const booked = rooms.filter((r: any) => bookedRoomIds.has(r.id));

    const lines: string[] = [];
    if (available.length) {
      lines.push(`Musait (${available.length}):`);
      available.forEach((r: any) => lines.push(`  - ${r.name}`));
    }
    if (booked.length) {
      lines.push(`\nDolu (${booked.length}):`);
      booked.forEach((r: any) => lines.push(`  - ${r.name}`));
    }
    if (outOfOrder.length) {
      lines.push(`\nAriza (${outOfOrder.length}):`);
      outOfOrder.forEach((r: any) => lines.push(`  - ${r.name}`));
    }

    await sendButtons(ctx.phone,
      prefix("rezervasyon", `*Musaitlik* (onumuzdeki 7 gun)\nToplam: ${rooms.length} oda | Musait: ${available.length}\n\n${lines.join("\n")}`),
      [
        { id: "cmd:rezervasyonlar", title: "Rezervasyonlar" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[otel:musaitlik] error:", err);
    await sendButtons(ctx.phone, "Musaitlik bilgisi yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}

export async function handleFiyat(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: rooms } = await supabase
      .from("otel_rooms")
      .select("name, room_type, base_price")
      .eq("hotel_id", hotelId)
      .order("sort_order", { ascending: true });

    if (!rooms?.length) {
      await sendButtons(ctx.phone,
        prefix("rezervasyon", "Henuz oda tanimlanmamis."),
        [{ id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    const lines = rooms.map((r: any, i: number) => {
      const price = r.base_price ? `${r.base_price} TL/gece` : "Fiyat girilmemis";
      return `${i + 1}. ${r.name} (${r.room_type}) — ${price}`;
    });

    await sendButtons(ctx.phone,
      prefix("rezervasyon", `*Oda Fiyatlari*\n\n${lines.join("\n")}`),
      [{ id: "cmd:musaitlik", title: "Musaitlik" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[otel:fiyat] error:", err);
    await sendButtons(ctx.phone, "Fiyat bilgisi yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
