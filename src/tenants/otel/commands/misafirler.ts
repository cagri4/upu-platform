/**
 * /misafirler — Current guests (checked-in reservations)
 * /mesajlar — Unread guest messages
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, shortDate, NO_HOTEL_MSG } from "./helpers";

export async function handleMisafirler(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: guests } = await supabase
      .from("otel_reservations")
      .select("guest_name, guest_phone, check_in, check_out, otel_rooms(name)")
      .eq("hotel_id", hotelId)
      .eq("status", "checked_in")
      .order("check_in", { ascending: true })
      .limit(20);

    if (!guests?.length) {
      await sendButtons(ctx.phone,
        prefix("misafir", "Su anda otelde misafir bulunmuyor."),
        [{ id: "cmd:rezervasyonlar", title: "Rezervasyonlar" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    const lines = guests.map((g: any, i: number) => {
      const room = g.otel_rooms?.name ?? "-";
      return `${i + 1}. ${g.guest_name} | ${room} | ${shortDate(g.check_in)}-${shortDate(g.check_out)}`;
    });

    await sendButtons(ctx.phone,
      prefix("misafir", `*Oteldeki Misafirler* (${guests.length})\n\n${lines.join("\n")}`),
      [
        { id: "cmd:mesajlar", title: "Mesajlar" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[otel:misafirler] error:", err);
    await sendButtons(ctx.phone, "Misafir listesi yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}

export async function handleMesajlar(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: messages } = await supabase
      .from("otel_guest_messages")
      .select("guest_name, guest_phone, content, is_escalation, created_at")
      .eq("hotel_id", hotelId)
      .eq("direction", "inbound")
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!messages?.length) {
      await sendButtons(ctx.phone,
        prefix("misafir", "Okunmamis mesaj bulunmuyor."),
        [{ id: "cmd:misafirler", title: "Misafirler" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    const lines = messages.map((m: any, i: number) => {
      const name = m.guest_name || m.guest_phone || "Bilinmeyen";
      const esc = m.is_escalation ? " [ACIL]" : "";
      const preview = m.content.length > 50 ? m.content.substring(0, 50) + "..." : m.content;
      return `${i + 1}. ${name}${esc}: ${preview}`;
    });

    await sendButtons(ctx.phone,
      prefix("misafir", `*Okunmamis Mesajlar* (${messages.length})\n\n${lines.join("\n")}`),
      [
        { id: "cmd:misafirler", title: "Misafirler" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[otel:mesajlar] error:", err);
    await sendButtons(ctx.phone, "Mesajlar yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
