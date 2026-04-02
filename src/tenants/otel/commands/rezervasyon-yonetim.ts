/**
 * /rezervasyondetay — View reservation details with action buttons
 * /rezervasyonduzenle — Edit reservation status
 * /rezervasyoniptal — Cancel a reservation
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, formatDate, formatCurrency, NO_HOTEL_MSG } from "./helpers";

const STATUS_LABEL: Record<string, string> = {
  pending: "Beklemede",
  confirmed: "Onaylandi",
  checked_in: "Giris yapti",
  checked_out: "Cikis yapti",
  cancelled: "Iptal",
  no_show: "Gelmedi",
};

// ── /rezervasyondetay — Shows list, then detail on callback ─────────────

export async function handleRezervasyonDetay(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  const supabase = getServiceClient();
  const { data: reservations } = await supabase
    .from("otel_reservations")
    .select("id, guest_name, check_in, status, otel_rooms(name)")
    .eq("hotel_id", hotelId)
    .in("status", ["confirmed", "checked_in", "pending"])
    .order("check_in", { ascending: true })
    .limit(10);

  if (!reservations?.length) {
    await sendButtons(ctx.phone,
      prefix("rezervasyon", "Aktif rezervasyon bulunmuyor."),
      [{ id: "cmd:rezervasyonekle", title: "Yeni Ekle" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
    return;
  }

  await sendList(ctx.phone,
    prefix("rezervasyon", "Detay gormek istediginiz rezervasyonu secin:"),
    "Rezervasyonlar",
    [{
      title: "Aktif Rezervasyonlar",
      rows: reservations.map((r: any) => ({
        id: `rezdetay:${r.id}`,
        title: `${r.guest_name}`,
        description: `${(r.otel_rooms as any)?.name || "-"} | ${formatDate(r.check_in)}`,
      })),
    }],
  );
}

// ── Callback: show detail + action buttons ──────────────────────────────

export async function handleRezervasyonYonetimCallback(ctx: WaContext, data: string): Promise<void> {
  const supabase = getServiceClient();

  // rezdetay:<id> — Show detail
  if (data.startsWith("rezdetay:")) {
    const rezId = data.replace("rezdetay:", "");
    const { data: rez } = await supabase
      .from("otel_reservations")
      .select("*, otel_rooms(name, room_type)")
      .eq("id", rezId)
      .maybeSingle();

    if (!rez) {
      await sendButtons(ctx.phone, "Rezervasyon bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    const room = (rez as any).otel_rooms;
    const statusLabel = STATUS_LABEL[rez.status] || rez.status;
    const nights = Math.ceil((new Date(rez.check_out).getTime() - new Date(rez.check_in).getTime()) / 86400000);

    let detail = `*Rezervasyon Detayi*\n\n`;
    detail += `👤 Misafir: ${rez.guest_name}\n`;
    if (rez.guest_phone) detail += `📱 Telefon: ${rez.guest_phone}\n`;
    detail += `🚪 Oda: ${room?.name || "-"} (${room?.room_type || "-"})\n`;
    detail += `📅 Giris: ${formatDate(rez.check_in)}\n`;
    detail += `📅 Cikis: ${formatDate(rez.check_out)}\n`;
    detail += `🌙 ${nights} gece\n`;
    if (rez.total_price) detail += `💰 Toplam: ${formatCurrency(rez.total_price)}\n`;
    detail += `📋 Durum: ${statusLabel}`;

    const buttons: Array<{ id: string; title: string }> = [];
    if (rez.status === "confirmed") {
      buttons.push({ id: `rezaction:checkin:${rezId}`, title: "Check-in Yap" });
      buttons.push({ id: `rezaction:cancel:${rezId}`, title: "Iptal Et" });
    } else if (rez.status === "checked_in") {
      buttons.push({ id: `rezaction:checkout:${rezId}`, title: "Check-out Yap" });
    } else if (rez.status === "pending") {
      buttons.push({ id: `rezaction:confirm:${rezId}`, title: "Onayla" });
      buttons.push({ id: `rezaction:cancel:${rezId}`, title: "Iptal Et" });
    }
    buttons.push({ id: "cmd:rezervasyonlar", title: "Listeye Don" });

    await sendButtons(ctx.phone, prefix("rezervasyon", detail), buttons.slice(0, 3));
    return;
  }

  // rezaction:<action>:<id> — Perform action
  if (data.startsWith("rezaction:")) {
    const parts = data.replace("rezaction:", "").split(":");
    if (parts.length < 2) return;
    const [action, rezId] = parts;

    const statusMap: Record<string, string> = {
      checkin: "checked_in",
      checkout: "checked_out",
      confirm: "confirmed",
      cancel: "cancelled",
    };

    const newStatus = statusMap[action];
    if (!newStatus) return;

    const { data: rez, error } = await supabase
      .from("otel_reservations")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", rezId)
      .select("guest_name, room_id, otel_rooms(name)")
      .single();

    if (error || !rez) {
      await sendButtons(ctx.phone, "Islem sirasinda hata olustu.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    const actionLabels: Record<string, string> = {
      checkin: "Check-in yapildi",
      checkout: "Check-out yapildi",
      confirm: "Onaylandi",
      cancel: "Iptal edildi",
    };

    // If checkout, mark room as dirty
    if (action === "checkout" && rez.room_id) {
      await supabase
        .from("otel_rooms")
        .update({ status: "dirty", updated_at: new Date().toISOString() })
        .eq("id", rez.room_id);
    }

    await sendButtons(ctx.phone,
      prefix("rezervasyon", `✅ *${(rez as any).guest_name}* — ${actionLabels[action]}${action === "checkout" ? "\n🧹 Oda temizlik icin isaretlendi." : ""}`),
      [
        { id: "cmd:rezervasyonlar", title: "Rezervasyonlar" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
    return;
  }
}
