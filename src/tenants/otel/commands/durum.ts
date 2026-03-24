/**
 * /durum — Real-time hotel status overview
 *
 * Queries reservations, rooms, guest messages in parallel.
 * All queries individually wrapped so missing/empty tables default to 0.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, today, todayISO, tomorrowISO, NO_HOTEL_MSG } from "./helpers";

async function safeCountQuery(queryFn: () => Promise<{ count: number | null }>): Promise<number> {
  try {
    const res = await queryFn();
    return (res as any).count ?? 0;
  } catch {
    return 0;
  }
}

export async function handleDurum(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const todayStr = todayISO();
    const tomorrowStr = tomorrowISO();

    const [checkIns, checkOuts, active, dirty, clean, unread] = await Promise.all([
      safeCountQuery(() =>
        supabase.from("otel_reservations").select("*", { count: "exact", head: true })
          .eq("hotel_id", hotelId).eq("status", "confirmed")
          .gte("check_in", todayStr).lt("check_in", tomorrowStr) as any,
      ),
      safeCountQuery(() =>
        supabase.from("otel_reservations").select("*", { count: "exact", head: true })
          .eq("hotel_id", hotelId).in("status", ["confirmed", "checked_in"])
          .gte("check_out", todayStr).lt("check_out", tomorrowStr) as any,
      ),
      safeCountQuery(() =>
        supabase.from("otel_reservations").select("*", { count: "exact", head: true })
          .eq("hotel_id", hotelId).in("status", ["confirmed", "checked_in"]) as any,
      ),
      safeCountQuery(() =>
        supabase.from("otel_rooms").select("*", { count: "exact", head: true })
          .eq("hotel_id", hotelId).eq("status", "dirty") as any,
      ),
      safeCountQuery(() =>
        supabase.from("otel_rooms").select("*", { count: "exact", head: true })
          .eq("hotel_id", hotelId).eq("status", "clean") as any,
      ),
      safeCountQuery(() =>
        supabase.from("otel_guest_messages").select("*", { count: "exact", head: true })
          .eq("hotel_id", hotelId).eq("is_read", false).eq("direction", "inbound") as any,
      ),
    ]);

    const text = prefix("genel", `Otel Durumu — ${today()}

Rezervasyon: Bugun ${checkIns} check-in, ${checkOuts} check-out | Toplam ${active} aktif
Resepsiyon: ${unread} okunmamis mesaj
Kat Hizmetleri: ${dirty} oda temizlik bekliyor | ${clean} temiz`);

    await sendButtons(ctx.phone, text, [
      { id: "cmd:rezervasyonlar", title: "Rezervasyonlar" },
      { id: "cmd:odalar", title: "Odalar" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[otel:durum] error:", err);
    await sendButtons(ctx.phone, "Durum yuklenirken bir hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
