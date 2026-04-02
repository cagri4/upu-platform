/**
 * /odaguncelle — Update room status (clean/dirty/maintenance) with callbacks
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, NO_HOTEL_MSG } from "./helpers";

const STATUS_LABEL: Record<string, string> = {
  clean: "Temiz",
  dirty: "Kirli",
  inspected: "Kontrol edildi",
  out_of_order: "Ariza",
  occupied: "Dolu",
};

// ── Command entry: show room list ───────────────────────────────────────

export async function handleOdaGuncelle(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  const supabase = getServiceClient();
  const { data: rooms } = await supabase
    .from("otel_rooms")
    .select("id, name, room_type, status")
    .eq("hotel_id", hotelId)
    .order("sort_order", { ascending: true })
    .limit(10);

  if (!rooms?.length) {
    await sendButtons(ctx.phone,
      prefix("oda", "Henuz oda tanimlanmamis."),
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
    return;
  }

  await sendList(ctx.phone,
    prefix("oda", "Durumunu guncellemek istediginiz odayi secin:"),
    "Odalar",
    [{
      title: "Oda Listesi",
      rows: rooms.map((r: any) => ({
        id: `odagunc_select:${r.id}`,
        title: r.name,
        description: `${r.room_type} | ${STATUS_LABEL[r.status] || r.status}`,
      })),
    }],
  );
}

// ── Callback handler ────────────────────────────────────────────────────

export async function handleOdaGuncelleCallback(ctx: WaContext, data: string): Promise<void> {
  const supabase = getServiceClient();

  // odagunc_select:<room_id> — Show status options
  if (data.startsWith("odagunc_select:")) {
    const roomId = data.replace("odagunc_select:", "");
    const { data: room } = await supabase
      .from("otel_rooms")
      .select("id, name, status")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) {
      await sendButtons(ctx.phone, "Oda bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    await sendButtons(ctx.phone,
      prefix("oda", `*${room.name}*\nMevcut durum: ${STATUS_LABEL[room.status] || room.status}\n\nYeni durumu secin:`),
      [
        { id: `odagunc_status:${roomId}:clean`, title: "Temiz" },
        { id: `odagunc_status:${roomId}:dirty`, title: "Kirli" },
        { id: `odagunc_status:${roomId}:out_of_order`, title: "Ariza" },
      ],
    );
    return;
  }

  // odagunc_status:<room_id>:<status> — Apply status change
  if (data.startsWith("odagunc_status:")) {
    const parts = data.replace("odagunc_status:", "").split(":");
    if (parts.length < 2) return;
    const [roomId, newStatus] = parts;

    const { data: room, error } = await supabase
      .from("otel_rooms")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", roomId)
      .select("name")
      .single();

    if (error || !room) {
      await sendButtons(ctx.phone, "Guncelleme sirasinda hata olustu.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    await sendButtons(ctx.phone,
      prefix("oda", `✅ *${room.name}* durumu → *${STATUS_LABEL[newStatus] || newStatus}* olarak guncellendi.`),
      [
        { id: "cmd:odalar", title: "Odalar" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
    return;
  }
}
