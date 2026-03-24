/**
 * /rezervasyonlar — List active reservations (confirmed + checked_in)
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, shortDate, formatCurrency, NO_HOTEL_MSG } from "./helpers";

const STATUS_ICON: Record<string, string> = {
  pending: "...",
  confirmed: "OK",
  checked_in: ">>",
  checked_out: "<<",
  cancelled: "XX",
};

export async function handleRezervasyonlar(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: reservations } = await supabase
      .from("otel_reservations")
      .select("id, guest_name, guest_phone, check_in, check_out, status, total_price, otel_rooms(name)")
      .eq("hotel_id", hotelId)
      .in("status", ["confirmed", "checked_in"])
      .order("check_in", { ascending: true })
      .limit(15);

    if (!reservations?.length) {
      await sendButtons(ctx.phone,
        prefix("rezervasyon", "Aktif rezervasyon bulunmuyor."),
        [{ id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    const lines = reservations.map((r: any, i: number) => {
      const room = r.otel_rooms?.name ?? "-";
      const icon = STATUS_ICON[r.status] || "?";
      const price = r.total_price ? ` | ${formatCurrency(r.total_price)}` : "";
      return `${i + 1}. ${r.guest_name} | ${room} | ${shortDate(r.check_in)}-${shortDate(r.check_out)} | [${icon}]${price}`;
    });

    await sendButtons(ctx.phone,
      prefix("rezervasyon", `*Aktif Rezervasyonlar* (${reservations.length})\n\n${lines.join("\n")}`),
      [
        { id: "cmd:musaitlik", title: "Musaitlik" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[otel:rezervasyonlar] error:", err);
    await sendButtons(ctx.phone, "Rezervasyonlar yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
