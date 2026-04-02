/**
 * Market — Brifing komutu
 *
 * /brifing — Gunluk market brifing ozeti
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, today } from "./helpers";

export async function handleBrifing(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const now = new Date();

    // Today's sales
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const { data: todaySales } = await supabase
      .from("mkt_sales")
      .select("product_name, quantity, total_amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("sold_at", todayStart.toISOString())
      .lt("sold_at", tomorrow.toISOString());

    const dailyRevenue = (todaySales || []).reduce((s, d) => s + d.total_amount, 0);
    const txCount = todaySales?.length || 0;

    // Low stock products
    const { data: lowStock } = await supabase
      .from("mkt_products")
      .select("name, quantity, unit, min_stock")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .lte("quantity", 10)
      .order("quantity")
      .limit(5);

    // Expiring soon (7 days)
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiring } = await supabase
      .from("mkt_products")
      .select("name, expiry_date, quantity")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .not("expiry_date", "is", null)
      .lte("expiry_date", weekLater)
      .order("expiry_date")
      .limit(5);

    // Pending orders
    const { data: pendingOrders } = await supabase
      .from("mkt_orders")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "pending");

    // Active campaigns
    const { data: campaigns } = await supabase
      .from("mkt_campaigns")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .gt("ends_at", now.toISOString());

    // Build briefing message
    let msg = `*Gunluk Brifing* — ${today()}\n\n`;

    msg += `*Satis Ozeti*\n`;
    msg += `Ciro: ${formatCurrency(dailyRevenue)}\n`;
    msg += `Islem: ${txCount} adet\n\n`;

    if (lowStock?.length) {
      msg += `*Dusuk Stok (${lowStock.length} urun)*\n`;
      for (const p of lowStock) {
        msg += `- ${p.name}: ${p.quantity} ${p.unit}\n`;
      }
      msg += "\n";
    }

    if (expiring?.length) {
      msg += `*SKT Yaklasan (${expiring.length} urun)*\n`;
      for (const p of expiring) {
        const date = p.expiry_date ? new Date(p.expiry_date).toLocaleDateString("tr-TR") : "-";
        msg += `- ${p.name}: ${date} (${p.quantity} adet)\n`;
      }
      msg += "\n";
    }

    msg += `*Bekleyen Siparis:* ${pendingOrders?.length || 0}\n`;
    msg += `*Aktif Kampanya:* ${campaigns?.length || 0}`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:raporgunluk", title: "Detayli Rapor" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[market:brifing] error:", err);
    await sendText(ctx.phone, "Brifing yuklenirken bir hata olustu.");
  }
}
