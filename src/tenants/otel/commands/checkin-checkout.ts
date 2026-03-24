/**
 * /checkin — List today's expected check-ins
 * /checkout — List today's expected check-outs
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, today, todayISO, tomorrowISO, NO_HOTEL_MSG } from "./helpers";

export async function handleCheckin(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: reservations } = await supabase
      .from("otel_reservations")
      .select("guest_name, guest_phone, check_in, check_out, status, otel_rooms(name)")
      .eq("hotel_id", hotelId)
      .eq("status", "confirmed")
      .gte("check_in", todayISO())
      .lt("check_in", tomorrowISO())
      .order("check_in", { ascending: true });

    if (!reservations?.length) {
      await sendButtons(ctx.phone,
        prefix("rezervasyon", `*Check-in* — ${today()}\n\nBugun beklenen giris yok.`),
        [{ id: "cmd:durum", title: "Durum" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    const lines = reservations.map((r: any, i: number) => {
      const room = r.otel_rooms?.name ?? "-";
      return `${i + 1}. ${r.guest_name} | ${room} | Cikis: ${r.check_out}`;
    });

    await sendButtons(ctx.phone,
      prefix("rezervasyon", `*Check-in* — ${today()} (${reservations.length} misafir)\n\n${lines.join("\n")}`),
      [{ id: "cmd:durum", title: "Durum" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[otel:checkin] error:", err);
    await sendButtons(ctx.phone, "Check-in listesi yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}

export async function handleCheckout(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: reservations } = await supabase
      .from("otel_reservations")
      .select("guest_name, guest_phone, check_in, check_out, status, otel_rooms(name)")
      .eq("hotel_id", hotelId)
      .in("status", ["confirmed", "checked_in"])
      .gte("check_out", todayISO())
      .lt("check_out", tomorrowISO())
      .order("check_out", { ascending: true });

    if (!reservations?.length) {
      await sendButtons(ctx.phone,
        prefix("rezervasyon", `*Check-out* — ${today()}\n\nBugun beklenen cikis yok.`),
        [{ id: "cmd:durum", title: "Durum" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    const lines = reservations.map((r: any, i: number) => {
      const room = r.otel_rooms?.name ?? "-";
      return `${i + 1}. ${r.guest_name} | ${room} | Giris: ${r.check_in}`;
    });

    await sendButtons(ctx.phone,
      prefix("rezervasyon", `*Check-out* — ${today()} (${reservations.length} misafir)\n\n${lines.join("\n")}`),
      [{ id: "cmd:durum", title: "Durum" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[otel:checkout] error:", err);
    await sendButtons(ctx.phone, "Check-out listesi yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
