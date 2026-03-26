/**
 * Market — Rapor komutlari
 *
 * /satiskaydet   — Satis kaydi ekle
 * /raporgunluk   — Gunluk satis ozeti
 * /raporhaftalik — Haftalik satis ozeti
 * /topsatan      — En cok satan urunler (son 7 gun)
 */

import type { WaContext, StepHandler } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency } from "./helpers";

// ── Helpers ─────────────────────────────────────────────────────────────

function aggregateSales(
  sales: Array<{ product_name: string; quantity: number; unit_price: number; total_amount: number }>,
): Array<{ productName: string; totalQuantity: number; totalAmount: number }> {
  const map = new Map<string, { totalQuantity: number; totalAmount: number }>();

  for (const sale of sales) {
    const existing = map.get(sale.product_name);
    if (existing) {
      existing.totalQuantity += sale.quantity;
      existing.totalAmount += sale.total_amount;
    } else {
      map.set(sale.product_name, {
        totalQuantity: sale.quantity,
        totalAmount: sale.total_amount,
      });
    }
  }

  return Array.from(map.entries()).map(([productName, data]) => ({
    productName,
    ...data,
  }));
}

// ── /satiskaydet — multi-step: product → quantity → price ───────────────

export async function handleSatisKaydet(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "satiskaydet", "product");
  await sendText(ctx.phone, "Satilan urun adini girin:");
}

export const stepSatisKaydet: StepHandler = async (ctx, session) => {
  const step = session.current_step;
  const data = session.data as Record<string, unknown>;

  if (step === "product") {
    const productName = ctx.text.trim();
    if (!productName) {
      await sendText(ctx.phone, "Urun adi bos olamaz. Tekrar girin:");
      return;
    }
    await updateSession(ctx.userId, "quantity", { productName });
    await sendText(ctx.phone, `Urun: *${productName}*\nSatilan miktar girin:`);
    return;
  }

  if (step === "quantity") {
    const quantity = Number(ctx.text.trim());
    if (isNaN(quantity) || quantity <= 0) {
      await sendText(ctx.phone, "Gecerli bir sayi girin:");
      return;
    }
    await updateSession(ctx.userId, "price", { quantity });
    await sendText(ctx.phone, "Birim fiyat girin (TL):");
    return;
  }

  if (step === "price") {
    const unitPrice = Number(ctx.text.trim());
    if (isNaN(unitPrice) || unitPrice <= 0) {
      await sendText(ctx.phone, "Gecerli bir fiyat girin:");
      return;
    }

    const productName = data.productName as string;
    const quantity = data.quantity as number;

    await endSession(ctx.userId);

    try {
      const supabase = getServiceClient();

      // Note: total_amount is GENERATED ALWAYS — do NOT send it
      await supabase
        .from("mkt_sales")
        .insert({
          tenant_id: ctx.tenantId,
          product_name: productName,
          quantity,
          unit_price: unitPrice,
        });

      const total = quantity * unitPrice;
      await sendButtons(ctx.phone,
        `✅ Satis kaydedildi:\n*${productName}* ${quantity} adet x ${formatCurrency(unitPrice)} = ${formatCurrency(total)}`,
        [{ id: "cmd:raporgunluk", title: "Gunluk Rapor" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
    } catch (err) {
      console.error("[market:satiskaydet] error:", err);
      await sendText(ctx.phone, "Satis kaydederken bir hata olustu.");
    }
  }
};

// ── /raporgunluk — today's sales summary (no multi-step) ───────────────

export async function handleRaporGunluk(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const { data } = await supabase
      .from("mkt_sales")
      .select("product_name, quantity, unit_price, total_amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("sold_at", today.toISOString())
      .lt("sold_at", tomorrow.toISOString())
      .limit(50);

    if (!data?.length) {
      await sendButtons(ctx.phone, "📊 Bugun satis kaydi yok.", [
        { id: "cmd:satiskaydet", title: "Satis Kaydet" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const aggregated = aggregateSales(data);
    const grandTotal = aggregated.reduce((sum, item) => sum + item.totalAmount, 0);

    const dateStr = new Date().toLocaleDateString("tr-TR");
    const lines = aggregated.map(
      (item) => `*${item.productName}*: ${item.totalQuantity} adet — ${formatCurrency(item.totalAmount)}`,
    );

    await sendButtons(ctx.phone,
      `📊 *Gunluk Satis Ozeti* (${dateStr})\n\n${lines.join("\n")}\n\n*Toplam: ${formatCurrency(grandTotal)}*`,
      [{ id: "cmd:raporhaftalik", title: "Haftalik Rapor" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[market:raporgunluk] error:", err);
    await sendText(ctx.phone, "Gunluk rapor yuklenirken bir hata olustu.");
  }
}

// ── /raporhaftalik — last 7 days sales summary (no multi-step) ─────────

export async function handleRaporHaftalik(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    weekAgo.setUTCHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("mkt_sales")
      .select("product_name, quantity, unit_price, total_amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("sold_at", weekAgo.toISOString())
      .limit(100);

    if (!data?.length) {
      await sendButtons(ctx.phone, "📊 Son 7 gunde satis kaydi bulunamadi.", [
        { id: "cmd:satiskaydet", title: "Satis Kaydet" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const aggregated = aggregateSales(data);
    const grandTotal = aggregated.reduce((sum, item) => sum + item.totalAmount, 0);

    const startStr = weekAgo.toLocaleDateString("tr-TR");
    const endStr = now.toLocaleDateString("tr-TR");
    const lines = aggregated.map(
      (item) => `*${item.productName}*: ${item.totalQuantity} adet — ${formatCurrency(item.totalAmount)}`,
    );

    await sendButtons(ctx.phone,
      `📊 *Haftalik Satis Ozeti* (${startStr} - ${endStr})\n\n${lines.join("\n")}\n\n*Toplam: ${formatCurrency(grandTotal)}*`,
      [{ id: "cmd:raporgunluk", title: "Gunluk Rapor" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[market:raporhaftalik] error:", err);
    await sendText(ctx.phone, "Haftalik rapor yuklenirken bir hata olustu.");
  }
}

// ── /topsatan — top selling products (no multi-step) ────────────────────

export async function handleTopSatan(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase.rpc("mkt_top_selling_products", {
      p_tenant_id: ctx.tenantId,
      p_days: 7,
      p_limit: 10,
    });

    if (error || !data?.length) {
      await sendButtons(ctx.phone, "📊 Son 7 gunde satis kaydi bulunamadi.", [
        { id: "cmd:satiskaydet", title: "Satis Kaydet" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = data.map(
      (item: any, index: number) =>
        `${index + 1}. *${item.product_name}*: ${item.total_quantity} adet — ${formatCurrency(item.total_revenue)}`,
    );

    await sendButtons(ctx.phone,
      `🏆 *En Cok Satan Urunler* (Son 7 Gun)\n\n${lines.join("\n")}`,
      [{ id: "cmd:raporgunluk", title: "Gunluk Rapor" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[market:topsatan] error:", err);
    await sendText(ctx.phone, "En cok satan urunler yuklenirken bir hata olustu.");
  }
}
