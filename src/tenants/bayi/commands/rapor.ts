/**
 * /rapor — Detaylı dönemsel rapor: sipariş durumu, bayi bazlı ciro, stok özeti
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { today, formatCurrency } from "./helpers";

export async function handleRapor(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const [ordersRes, productsRes, statusRes] = await Promise.all([
      supabase
        .from("bayi_orders")
        .select("id, total_amount, dealer_id, status_id, bayi_dealers!inner(company_name)")
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("bayi_products")
        .select("id, name, stock_quantity, low_stock_threshold")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true),
      supabase.from("bayi_order_statuses").select("id, name"),
    ]);

    const orders = ordersRes.data || [];
    const products = productsRes.data || [];
    const statuses = statusRes.data || [];
    const statusMap: Record<string, string> = {};
    statuses.forEach((s: any) => { statusMap[s.id] = s.name; });

    // Orders by status
    const byStatus: Record<string, number> = {};
    orders.forEach((o: any) => {
      const name = statusMap[o.status_id] || "Bilinmeyen";
      byStatus[name] = (byStatus[name] || 0) + 1;
    });
    const statusLines = Object.entries(byStatus).map(([name, count]) => `${name}: ${count}`).join("\n");

    // Revenue by dealer (top 5)
    const byDealer: Record<string, number> = {};
    orders.forEach((o: any) => {
      const name = (o as any).bayi_dealers?.company_name || "Bilinmeyen";
      byDealer[name] = (byDealer[name] || 0) + (o.total_amount || 0);
    });
    const topDealers = Object.entries(byDealer)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, revenue], i) => `${i + 1}. ${name} — ${formatCurrency(revenue)}`)
      .join("\n");

    const totalProducts = products.length;
    const criticalCount = products.filter((p: any) => p.stock_quantity <= (p.low_stock_threshold || 0)).length;
    const totalRevenue = orders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

    const text = `📈 *Detayli Rapor — ${today()}*

*Siparis Durumu*
${statusLines || "Veri yok"}
Toplam: ${orders.length} siparis | ${formatCurrency(totalRevenue)}

*Bayi Bazli Ciro (Top 5)*
${topDealers || "Veri yok"}

*Stok Ozeti*
Toplam urun: ${totalProducts}
Kritik stok: ${criticalCount} urun

_Performans icin /performans yazin._`;

    await sendButtons(ctx.phone, text, [
      { id: "cmd:performans", title: "Performans" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[bayi:rapor] error:", err);
    await sendButtons(ctx.phone, "Rapor yuklenirken bir hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
