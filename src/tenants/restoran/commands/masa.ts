/**
 * /masa — Masa durumu, müsaitlik, açık hesaplar
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, TABLE_STATUS_ICON, TABLE_STATUS_LABEL } from "./helpers";

export async function handleMasa(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: tables } = await supabase
      .from("rst_tables")
      .select("id, label, capacity, status, current_check_amount")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("label");

    if (!tables?.length) {
      await sendButtons(ctx.phone, "🍽 *Masalar*\n\nHenüz masa tanımlanmamış. Web panelden masa tanımlayın.", [
        { id: "cmd:webpanel", title: "🖥 Web Panel" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    const grouped: Record<string, typeof tables> = {
      free: [], occupied: [], reserved: [], cleaning: [],
    };
    for (const t of tables) {
      const key = grouped[t.status] ? t.status : "free";
      grouped[key].push(t);
    }

    const lines: string[] = [];
    for (const status of ["occupied", "reserved", "free", "cleaning"]) {
      const list = grouped[status];
      if (!list?.length) continue;
      const icon = TABLE_STATUS_ICON[status] || "·";
      const label = TABLE_STATUS_LABEL[status] || status;
      const items = list.map(t => {
        const cap = t.capacity ? ` (${t.capacity}p)` : "";
        const check = (status === "occupied" && t.current_check_amount)
          ? ` — ${formatCurrency(t.current_check_amount)}`
          : "";
        return `   ${t.label}${cap}${check}`;
      });
      lines.push(`${icon} *${label}* (${list.length})\n${items.join("\n")}`);
    }

    const occupiedCount = grouped.occupied?.length || 0;
    const total = tables.length;
    const occupancyPct = total > 0 ? Math.round((occupiedCount / total) * 100) : 0;

    await sendButtons(
      ctx.phone,
      `🍽 *Masa Durumu*\n\n${lines.join("\n\n")}\n\nDoluluk: ${occupiedCount}/${total} (%${occupancyPct})`,
      [
        { id: "cmd:siparis", title: "📋 Siparişler" },
        { id: "cmd:rezervasyon", title: "📅 Rezervasyon" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  } catch (err) {
    console.error("[restoran:masa] error:", err);
    await sendText(ctx.phone, "Masa verisi yüklenirken bir hata oluştu.");
  }
}
