/**
 * /siparis — Açık siparişler (bugün, masa bazında)
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, shortTime, ORDER_STATUS_ICON, ORDER_STATUS_LABEL } from "./helpers";

export async function handleSiparis(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: orders } = await supabase
      .from("rst_orders")
      .select("id, order_number, table_label, status, total_amount, created_at")
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["new", "preparing", "ready", "served"])
      .order("created_at", { ascending: false })
      .limit(15);

    if (!orders?.length) {
      await sendButtons(ctx.phone, "📋 *Siparişler*\n\nŞu an açık sipariş yok.", [
        { id: "cmd:masa", title: "🍽 Masa Durumu" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    const lines = orders.map((o) => {
      const icon = ORDER_STATUS_ICON[o.status] || "📋";
      const status = ORDER_STATUS_LABEL[o.status] || o.status;
      const time = shortTime(o.created_at);
      const masa = o.table_label ? `Masa ${o.table_label}` : "Paket";
      return `${icon} *${masa}* — #${o.order_number}\n   ${formatCurrency(o.total_amount || 0)} • ${status} • ${time}`;
    });

    const totalOpen = orders.reduce((s, o) => s + (o.total_amount || 0), 0);

    await sendButtons(
      ctx.phone,
      `📋 *Açık Siparişler*\n\n${lines.join("\n\n")}\n\nToplam: ${orders.length} sipariş • ${formatCurrency(totalOpen)}`,
      [
        { id: "cmd:masa", title: "🍽 Masa Durumu" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  } catch (err) {
    console.error("[restoran:siparis] error:", err);
    await sendText(ctx.phone, "Sipariş verisi yüklenirken bir hata oluştu.");
  }
}
