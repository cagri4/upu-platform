/**
 * /rezervasyonekle — Multi-step reservation creation
 *
 * Steps: guest_name → room → check_in → check_out → price → confirm
 */

import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, formatDate, formatCurrency, NO_HOTEL_MSG } from "./helpers";

// ── Command entry ───────────────────────────────────────────────────────

export async function handleRezervasyonEkle(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  await startSession(ctx.userId, ctx.tenantId, "rezekle", "guest_name");
  await sendText(ctx.phone, prefix("rezervasyon", "*Yeni Rezervasyon*\n\nMisafir adini yazin:\n\nOrnek: Ahmet Yilmaz"));
}

// ── Step handler ────────────────────────────────────────────────────────

export async function handleRezervasyonEkleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const step = session.current_step;
  const text = ctx.text;

  if (!text && !ctx.interactiveId) {
    await sendText(ctx.phone, "Lutfen bir deger yazin veya secim yapin.");
    return;
  }

  switch (step) {
    case "guest_name": {
      if (!text || text.length < 2) {
        await sendText(ctx.phone, "Misafir adi en az 2 karakter olmali. Tekrar yazin:");
        return;
      }
      // Show room list for selection
      const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
      if (!hotelId) { await endSession(ctx.userId); return; }

      const supabase = getServiceClient();
      const { data: rooms } = await supabase
        .from("otel_rooms")
        .select("id, name, room_type, base_price")
        .eq("hotel_id", hotelId)
        .not("status", "eq", "out_of_order")
        .order("sort_order", { ascending: true })
        .limit(10);

      if (!rooms?.length) {
        await endSession(ctx.userId);
        await sendButtons(ctx.phone, prefix("rezervasyon", "Musait oda bulunamadi."), [
          { id: "cmd:menu", title: "Ana Menu" },
        ]);
        return;
      }

      await updateSession(ctx.userId, "room", { guest_name: text });
      await sendList(ctx.phone,
        prefix("rezervasyon", `Misafir: *${text}*\n\nOda secin:`),
        "Oda Listesi",
        [{
          title: "Musait Odalar",
          rows: rooms.map((r: any) => ({
            id: `rezekle_room:${r.id}`,
            title: `${r.name} (${r.room_type})`,
            description: r.base_price ? `${r.base_price} TL/gece` : undefined,
          })),
        }],
      );
      return;
    }

    case "check_in": {
      const dateMatch = text?.match(/^(\d{1,2})[./-](\d{1,2})[./-]?(\d{2,4})?$/);
      if (!dateMatch) {
        await sendText(ctx.phone, "Gecerli bir tarih yazin.\nFormat: GG.AA.YYYY veya GG.AA\nOrnek: 15.04.2026");
        return;
      }
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3])) : new Date().getFullYear();
      const checkIn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const checkInDate = new Date(checkIn);
      if (isNaN(checkInDate.getTime())) {
        await sendText(ctx.phone, "Gecersiz tarih. Tekrar deneyin:");
        return;
      }

      await updateSession(ctx.userId, "check_out", { check_in: checkIn });
      await sendText(ctx.phone, prefix("rezervasyon", `Giris: *${formatDate(checkIn)}*\n\nCikis tarihini yazin:\nFormat: GG.AA.YYYY\nOrnek: 18.04.2026`));
      return;
    }

    case "check_out": {
      const dateMatch = text?.match(/^(\d{1,2})[./-](\d{1,2})[./-]?(\d{2,4})?$/);
      if (!dateMatch) {
        await sendText(ctx.phone, "Gecerli bir tarih yazin.\nFormat: GG.AA.YYYY\nOrnek: 18.04.2026");
        return;
      }
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3])) : new Date().getFullYear();
      const checkOut = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const checkOutDate = new Date(checkOut);
      const checkInDate = new Date(session.data.check_in as string);
      if (isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
        await sendText(ctx.phone, "Cikis tarihi giris tarihinden sonra olmali. Tekrar yazin:");
        return;
      }

      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / 86400000);
      await updateSession(ctx.userId, "price", { check_out: checkOut, nights });
      await sendText(ctx.phone, prefix("rezervasyon", `Konaklama: *${nights} gece*\n\nToplam fiyati yazin (TL):\nOrnek: 5000`));
      return;
    }

    case "price": {
      const price = parseInt((text || "").replace(/[^\d]/g, ""), 10);
      if (!price || price < 0) {
        await sendText(ctx.phone, "Gecerli bir fiyat yazin. Ornek: 5000");
        return;
      }
      await updateSession(ctx.userId, "phone", { total_price: price });
      await sendText(ctx.phone, prefix("rezervasyon", `Fiyat: *${formatCurrency(price)}*\n\nMisafir telefon numarasini yazin (opsiyonel):\nOrnek: 5321234567\n\nAtlamak icin "atla" yazin.`));
      return;
    }

    case "phone": {
      const phone = text?.toLowerCase() === "atla" ? null : text?.replace(/[^\d+]/g, "") || null;
      await updateSession(ctx.userId, "confirm", { guest_phone: phone });

      // Show summary for confirmation
      const d = { ...(session.data as Record<string, unknown>), guest_phone: phone } as Record<string, unknown>;
      const nights = d.nights as number;
      const roomName = d.room_name as string || "-";

      await sendButtons(ctx.phone,
        prefix("rezervasyon", `*Rezervasyon Ozeti*\n\n👤 Misafir: ${d.guest_name}\n🚪 Oda: ${roomName}\n📅 Giris: ${formatDate(d.check_in as string)}\n📅 Cikis: ${formatDate(d.check_out as string)}\n🌙 ${nights} gece\n💰 ${formatCurrency(d.total_price as number)}${phone ? `\n📱 ${phone}` : ""}`),
        [
          { id: "rezekle_confirm:evet", title: "Onayla" },
          { id: "rezekle_confirm:hayir", title: "Iptal" },
        ],
      );
      return;
    }

    default:
      await sendText(ctx.phone, "Lutfen butonlardan birini secin.");
      return;
  }
}

// ── Callback handler ────────────────────────────────────────────────────

export async function handleRezervasyonEkleCallback(ctx: WaContext, data: string): Promise<void> {
  if (data.startsWith("rezekle_room:")) {
    const roomId = data.replace("rezekle_room:", "");
    const supabase = getServiceClient();
    const { data: room } = await supabase
      .from("otel_rooms")
      .select("id, name, room_type, base_price")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) {
      await sendText(ctx.phone, "Oda bulunamadi. Tekrar deneyin.");
      return;
    }

    await updateSession(ctx.userId, "check_in", { room_id: roomId, room_name: room.name });
    await sendText(ctx.phone, prefix("rezervasyon", `Oda: *${room.name} (${room.room_type})*\n\nGiris tarihini yazin:\nFormat: GG.AA.YYYY\nOrnek: 15.04.2026`));
    return;
  }

  if (data.startsWith("rezekle_confirm:")) {
    const answer = data.replace("rezekle_confirm:", "");

    if (answer === "hayir") {
      await endSession(ctx.userId);
      await sendButtons(ctx.phone, prefix("rezervasyon", "Rezervasyon iptal edildi."), [
        { id: "cmd:rezervasyonlar", title: "Rezervasyonlar" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    // Save reservation
    const supabase = getServiceClient();
    const { data: session } = await supabase
      .from("command_sessions")
      .select("data")
      .eq("user_id", ctx.userId)
      .single();

    if (!session) {
      await endSession(ctx.userId);
      await sendText(ctx.phone, "Bir hata olustu. Tekrar deneyin.");
      return;
    }

    const d = session.data as Record<string, unknown>;
    const hotelId = await getHotelId(ctx.userId, ctx.tenantId);

    const { error } = await supabase.from("otel_reservations").insert({
      hotel_id: hotelId,
      room_id: d.room_id,
      guest_name: d.guest_name,
      guest_phone: d.guest_phone || null,
      check_in: d.check_in,
      check_out: d.check_out,
      total_price: d.total_price,
      status: "confirmed",
    });

    await endSession(ctx.userId);

    if (error) {
      console.error("[otel:rezekle] insert error:", error);
      await sendButtons(ctx.phone, prefix("rezervasyon", "Rezervasyon eklenirken hata olustu."), [
        { id: "cmd:rezervasyonekle", title: "Tekrar Dene" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    await sendButtons(ctx.phone,
      prefix("rezervasyon", `✅ Rezervasyon basariyla eklendi!\n\n👤 ${d.guest_name}\n📅 ${formatDate(d.check_in as string)} - ${formatDate(d.check_out as string)}\n💰 ${formatCurrency(d.total_price as number)}`),
      [
        { id: "cmd:rezervasyonlar", title: "Rezervasyonlar" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  }
}
