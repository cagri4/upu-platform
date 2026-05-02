/**
 * /rezervasyon — Bugünkü + yarınki rezervasyonlar
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { shortTime, todayISO, tomorrowISO, RESERVATION_STATUS_ICON } from "./helpers";

export async function handleRezervasyon(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = todayISO();
    const tomorrow = tomorrowISO();

    const { data: reservations } = await supabase
      .from("rst_reservations")
      .select("id, guest_name, guest_phone, party_size, reserved_at, status, table_label, notes")
      .eq("tenant_id", ctx.tenantId)
      .gte("reserved_at", `${today}T00:00:00`)
      .lte("reserved_at", `${tomorrow}T23:59:59`)
      .not("status", "in", "(cancelled,no_show)")
      .order("reserved_at", { ascending: true })
      .limit(20);

    if (!reservations?.length) {
      await sendButtons(ctx.phone, "📅 *Rezervasyonlar*\n\nBugün ve yarın için rezervasyon yok.", [
        { id: "cmd:rezervasyonekle", title: "➕ Yeni Ekle" },
        { id: "cmd:masa", title: "🍽 Masa Durumu" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    const todays: typeof reservations = [];
    const tomorrows: typeof reservations = [];
    for (const r of reservations) {
      const day = r.reserved_at.slice(0, 10);
      if (day === today) todays.push(r);
      else tomorrows.push(r);
    }

    const fmt = (r: typeof reservations[0]) => {
      const icon = RESERVATION_STATUS_ICON[r.status] || "📅";
      const time = shortTime(r.reserved_at);
      const masa = r.table_label ? ` • Masa ${r.table_label}` : "";
      const notes = r.notes ? `\n   _${r.notes}_` : "";
      return `${icon} ${time} — *${r.guest_name}* (${r.party_size} kişi)${masa}${notes}`;
    };

    const sections: string[] = [];
    if (todays.length) {
      sections.push(`*Bugün* (${todays.length})\n${todays.map(fmt).join("\n")}`);
    }
    if (tomorrows.length) {
      sections.push(`*Yarın* (${tomorrows.length})\n${tomorrows.map(fmt).join("\n")}`);
    }

    await sendButtons(
      ctx.phone,
      `📅 *Rezervasyonlar*\n\n${sections.join("\n\n")}`,
      [
        { id: "cmd:rezervasyonekle", title: "➕ Yeni Ekle" },
        { id: "cmd:masa", title: "🍽 Masa Durumu" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  } catch (err) {
    console.error("[restoran:rezervasyon] error:", err);
    await sendText(ctx.phone, "Rezervasyon verisi yüklenirken bir hata oluştu.");
  }
}
