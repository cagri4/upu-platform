/**
 * /siparisler — Son siparişleri listele
 * /siparisolustur — Web panele yönlendir
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, webPanelRedirect } from "./helpers";

export async function handleSiparisler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: orders } = await supabase
      .from("bayi_orders")
      .select("order_number, total_amount, created_at, bayi_dealers!inner(company_name), bayi_order_statuses!inner(name)")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!orders?.length) {
      await sendButtons(ctx.phone, "📋 *Siparisler*\n\nHenuz siparis bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const statusIcon: Record<string, string> = {
      Tamamlandi: "✅", Onaylandi: "🟢", Hazirlaniyor: "🔄",
      Yolda: "🚛", Beklemede: "⏳", Iptal: "❌",
    };

    const lines = orders.map((o: any, i: number) => {
      const dealer = o.bayi_dealers?.company_name || "Bilinmeyen";
      const status = o.bayi_order_statuses?.name || "Bilinmeyen";
      const icon = statusIcon[status] || "📋";
      return `${i + 1}. ${dealer} — #${o.order_number} — ${formatCurrency(o.total_amount || 0)} — ${icon} ${status}`;
    });

    const total = orders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

    await sendButtons(
      ctx.phone,
      `📋 *Son Siparisler*\n\n${lines.join("\n")}\n\nToplam: ${orders.length} siparis | ${formatCurrency(total)}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:siparisler] error:", err);
    await sendText(ctx.phone, "Siparisler yuklenirken bir hata olustu.");
  }
}

export async function handleSiparisOlustur(ctx: WaContext): Promise<void> {
  await webPanelRedirect(ctx.phone, "🛒 *Siparis Olusturma*\nSiparis olusturmak icin web panelini kullanin.");
}
