/**
 * Market — Kasa komutlari
 *
 * /kasarapor   — Gun sonu kasa raporu (detayli)
 * /raporaylik  — Aylik satis ozeti
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency } from "./helpers";

// ── /kasarapor — end of day register report (no multi-step) ─────────────

export async function handleKasaRapor(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const { data: sales } = await supabase
      .from("mkt_sales")
      .select("product_name, quantity, unit_price, total_amount, sold_at")
      .eq("tenant_id", ctx.tenantId)
      .gte("sold_at", todayStart.toISOString())
      .lt("sold_at", tomorrow.toISOString())
      .order("sold_at", { ascending: false })
      .limit(100);

    if (!sales?.length) {
      await sendButtons(ctx.phone, "Bugun satis kaydi yok.", [
        { id: "cmd:satiskaydet", title: "Satis Kaydet" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const grandTotal = sales.reduce((s, d) => s + d.total_amount, 0);
    const txCount = sales.length;

    // Group by product
    const productMap = new Map<string, { qty: number; total: number }>();
    for (const s of sales) {
      const existing = productMap.get(s.product_name) || { qty: 0, total: 0 };
      existing.qty += s.quantity;
      existing.total += s.total_amount;
      productMap.set(s.product_name, existing);
    }

    const productLines = Array.from(productMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([name, d]) => `${name}: ${d.qty} adet — ${formatCurrency(d.total)}`);

    // Group by hour
    const hourMap = new Map<number, number>();
    for (const s of sales) {
      const hour = new Date(s.sold_at).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + s.total_amount);
    }

    const peakHour = Array.from(hourMap.entries()).sort((a, b) => b[1] - a[1])[0];

    let msg = `*Kasa Raporu* — ${now.toLocaleDateString("tr-TR")}\n\n`;
    msg += `*Toplam Ciro:* ${formatCurrency(grandTotal)}\n`;
    msg += `*Islem Sayisi:* ${txCount}\n`;
    msg += `*Ortalama Sepet:* ${formatCurrency(Math.round(grandTotal / txCount))}\n`;

    if (peakHour) {
      msg += `*En Yogun Saat:* ${peakHour[0]}:00 — ${formatCurrency(peakHour[1])}\n`;
    }

    msg += `\n*Urun Bazli:*\n${productLines.join("\n")}`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:raporhaftalik", title: "Haftalik Rapor" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[market:kasarapor] error:", err);
    await sendText(ctx.phone, "Kasa raporu yuklenirken bir hata olustu.");
  }
}

// ── /raporaylik — monthly sales summary (no multi-step) ─────────────────

export async function handleRaporAylik(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const now = new Date();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const { data: sales } = await supabase
      .from("mkt_sales")
      .select("product_name, quantity, unit_price, total_amount, sold_at")
      .eq("tenant_id", ctx.tenantId)
      .gte("sold_at", monthStart.toISOString())
      .lt("sold_at", monthEnd.toISOString())
      .limit(500);

    if (!sales?.length) {
      await sendButtons(ctx.phone, "Bu ay satis kaydi yok.", [
        { id: "cmd:satiskaydet", title: "Satis Kaydet" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const grandTotal = sales.reduce((s, d) => s + d.total_amount, 0);
    const daysElapsed = Math.max(1, now.getDate());
    const dailyAvg = grandTotal / daysElapsed;

    // Top products
    const productMap = new Map<string, { qty: number; total: number }>();
    for (const s of sales) {
      const existing = productMap.get(s.product_name) || { qty: 0, total: 0 };
      existing.qty += s.quantity;
      existing.total += s.total_amount;
      productMap.set(s.product_name, existing);
    }

    const topProducts = Array.from(productMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, d], i) => `${i + 1}. ${name}: ${d.qty} adet — ${formatCurrency(d.total)}`);

    const monthName = now.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

    let msg = `*Aylik Rapor* — ${monthName}\n\n`;
    msg += `*Toplam Ciro:* ${formatCurrency(grandTotal)}\n`;
    msg += `*Islem Sayisi:* ${sales.length}\n`;
    msg += `*Gunluk Ortalama:* ${formatCurrency(Math.round(dailyAvg))}\n`;
    msg += `*Ortalama Sepet:* ${formatCurrency(Math.round(grandTotal / sales.length))}\n`;
    msg += `\n*En Cok Satan:*\n${topProducts.join("\n")}`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:topsatan", title: "Top Satan" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[market:raporaylik] error:", err);
    await sendText(ctx.phone, "Aylik rapor yuklenirken bir hata olustu.");
  }
}
