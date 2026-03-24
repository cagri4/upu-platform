/**
 * /ozet — Günlük özet: bugünün siparişleri, ciro, kritik stok, aktif teslimat
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { today, formatCurrency } from "./helpers";

export async function handleOzet(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [ordersRes, criticalStockRes, deliveryRes] = await Promise.all([
      supabase
        .from("bayi_orders")
        .select("id, total_amount, status_id")
        .eq("tenant_id", ctx.tenantId)
        .gte("created_at", todayStart.toISOString()),
      supabase
        .from("bayi_products")
        .select("id, stock_quantity, low_stock_threshold")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true),
      supabase
        .from("bayi_orders")
        .select("id, status_id, bayi_order_statuses!inner(code)")
        .eq("tenant_id", ctx.tenantId)
        .in("bayi_order_statuses.code", ["shipped", "in_transit", "delivering"]),
    ]);

    const orders = ordersRes.data || [];
    const todayRevenue = orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);

    const allProducts = criticalStockRes.data || [];
    const critProducts = allProducts.filter(
      (p: any) => p.stock_quantity <= (p.low_stock_threshold || 0),
    );

    const deliveries = deliveryRes.data || [];

    const text = `📊 *Gunluk Ozet — ${today()}*

📦 Bugunun Siparisleri: ${orders.length} adet
💰 Bugunun Cirosu: ${formatCurrency(todayRevenue)}
📦 Kritik Stok: ${critProducts.length} urun
🚛 Aktif Teslimat: ${deliveries.length}

_Detay icin /rapor yazin._`;

    await sendButtons(ctx.phone, text, [
      { id: "cmd:rapor", title: "Detayli Rapor" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[bayi:ozet] error:", err);
    await sendButtons(ctx.phone, "Ozet yuklenirken bir hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
