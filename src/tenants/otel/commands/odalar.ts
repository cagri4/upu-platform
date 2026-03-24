/**
 * /odalar — Room status listing
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, NO_HOTEL_MSG } from "./helpers";

const STATUS_LABEL: Record<string, string> = {
  clean: "Temiz",
  dirty: "Kirli",
  inspected: "Kontrol edildi",
  out_of_order: "Ariza",
  occupied: "Dolu",
};

export async function handleOdalar(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: rooms } = await supabase
      .from("otel_rooms")
      .select("name, room_type, status, base_price")
      .eq("hotel_id", hotelId)
      .order("sort_order", { ascending: true })
      .limit(30);

    if (!rooms?.length) {
      await sendButtons(ctx.phone,
        prefix("oda", "Henuz oda tanimlanmamis."),
        [{ id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    // Group by status
    const statusCounts: Record<string, number> = {};
    for (const r of rooms) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }

    const summary = Object.entries(statusCounts)
      .map(([s, c]) => `${STATUS_LABEL[s] || s}: ${c}`)
      .join(" | ");

    const lines = rooms.map((r: any, i: number) => {
      const label = STATUS_LABEL[r.status] || r.status;
      const price = r.base_price ? ` | ${r.base_price} TL` : "";
      return `${i + 1}. ${r.name} (${r.room_type}) — ${label}${price}`;
    });

    await sendButtons(ctx.phone,
      prefix("oda", `*Oda Durumlari* (${rooms.length} oda)\n${summary}\n\n${lines.join("\n")}`),
      [
        { id: "cmd:temizlik", title: "Temizlik" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[otel:odalar] error:", err);
    await sendButtons(ctx.phone, "Odalar yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
