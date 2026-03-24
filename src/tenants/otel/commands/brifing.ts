/**
 * /brifing — Morning briefing: combines durum + today's check-ins/outs + housekeeping
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, today, todayISO, tomorrowISO, NO_HOTEL_MSG } from "./helpers";

export async function handleBrifing(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const todayStr = todayISO();
    const tomorrowStr = tomorrowISO();

    const [checkInsRes, checkOutsRes, dirtyRes, pendingTasksRes, unreadRes] = await Promise.all([
      // Today's check-ins (with guest names)
      supabase.from("otel_reservations")
        .select("guest_name, otel_rooms(name)")
        .eq("hotel_id", hotelId).eq("status", "confirmed")
        .gte("check_in", todayStr).lt("check_in", tomorrowStr)
        .limit(10),
      // Today's check-outs
      supabase.from("otel_reservations")
        .select("guest_name, otel_rooms(name)")
        .eq("hotel_id", hotelId).in("status", ["confirmed", "checked_in"])
        .gte("check_out", todayStr).lt("check_out", tomorrowStr)
        .limit(10),
      // Dirty rooms count
      supabase.from("otel_rooms").select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId).eq("status", "dirty"),
      // Pending housekeeping tasks
      supabase.from("otel_housekeeping_tasks").select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId).eq("queue_date", todayStr).eq("status", "pending"),
      // Unread messages
      supabase.from("otel_guest_messages").select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId).eq("is_read", false).eq("direction", "inbound"),
    ]);

    const checkIns = checkInsRes.data ?? [];
    const checkOuts = checkOutsRes.data ?? [];
    const dirty = dirtyRes.count ?? 0;
    const pendingTasks = pendingTasksRes.count ?? 0;
    const unread = unreadRes.count ?? 0;

    const sections: string[] = [`*Sabah Brifing* — ${today()}\n`];

    // Check-ins
    if (checkIns.length) {
      sections.push(`*Beklenen Girisler (${checkIns.length}):*`);
      checkIns.forEach((r: any) => {
        const room = (r as any).otel_rooms?.name ?? "";
        sections.push(`  - ${r.guest_name}${room ? ` (${room})` : ""}`);
      });
    } else {
      sections.push("Beklenen giris yok.");
    }

    // Check-outs
    if (checkOuts.length) {
      sections.push(`\n*Beklenen Cikislar (${checkOuts.length}):*`);
      checkOuts.forEach((r: any) => {
        const room = (r as any).otel_rooms?.name ?? "";
        sections.push(`  - ${r.guest_name}${room ? ` (${room})` : ""}`);
      });
    } else {
      sections.push("\nBeklenen cikis yok.");
    }

    // Housekeeping
    sections.push(`\n*Kat Hizmetleri:* ${dirty} kirli oda | ${pendingTasks} bekleyen gorev`);

    // Messages
    if (unread > 0) {
      sections.push(`\n*Resepsiyon:* ${unread} okunmamis mesaj`);
    }

    await sendButtons(ctx.phone,
      prefix("genel", sections.join("\n")),
      [
        { id: "cmd:durum", title: "Detayli Durum" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[otel:brifing] error:", err);
    await sendButtons(ctx.phone, "Brifing yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
