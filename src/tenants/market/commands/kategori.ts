/**
 * Market — Kategori komutlari
 *
 * /kategoriler   — Kategori bazli stok ozeti
 * /kategoriekle  — Urune kategori atama
 */

import type { WaContext, StepHandler } from "@/platform/whatsapp/types";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency } from "./helpers";

// ── /kategoriler — category breakdown (no multi-step) ───────────────────

export async function handleKategoriler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: products } = await supabase
      .from("mkt_products")
      .select("name, quantity, unit, price, category")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);

    if (!products?.length) {
      await sendButtons(ctx.phone, "Kayitli urun bulunamadi.", [
        { id: "cmd:stokekle", title: "Stok Ekle" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    // Group by category
    const categories = new Map<string, { count: number; totalValue: number }>();
    for (const p of products) {
      const cat = p.category || "Kategori yok";
      const existing = categories.get(cat) || { count: 0, totalValue: 0 };
      existing.count++;
      existing.totalValue += (p.price || 0) * (p.quantity || 0);
      categories.set(cat, existing);
    }

    const lines = Array.from(categories.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([cat, data]) =>
        `*${cat}*: ${data.count} urun — ${formatCurrency(data.totalValue)}`,
      );

    await sendButtons(ctx.phone,
      `*Kategori Bazli Stok*\n\n${lines.join("\n")}\n\nToplam: ${products.length} urun`,
      [{ id: "cmd:stoksorgula", title: "Stok Listesi" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[market:kategoriler] error:", err);
    await sendText(ctx.phone, "Kategori verisi yuklenirken bir hata olustu.");
  }
}

// ── /kategoriekle — multi-step: product name → category ─────────────────

export async function handleKategoriEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "kategoriekle", "name");
  await sendText(ctx.phone, "Kategori atanacak urun adini girin:");
}

export const stepKategoriEkle: StepHandler = async (ctx, session) => {
  const step = session.current_step;

  if (step === "name") {
    const name = ctx.text.trim();
    if (!name) {
      await sendText(ctx.phone, "Urun adi bos olamaz. Tekrar girin:");
      return;
    }
    await updateSession(ctx.userId, "category", { name });
    await sendButtons(ctx.phone, `Urun: *${name}*\nKategori secin veya yazin:`, [
      { id: "mkt_cat:gida", title: "Gida" },
      { id: "mkt_cat:icecek", title: "Icecek" },
      { id: "mkt_cat:temizlik", title: "Temizlik" },
    ]);
    return;
  }

  if (step === "category") {
    const category = ctx.text.trim();
    if (!category) {
      await sendText(ctx.phone, "Kategori bos olamaz. Tekrar girin:");
      return;
    }

    const name = session.data.name as string;
    await endSession(ctx.userId);

    try {
      const supabase = getServiceClient();

      const { data: product } = await supabase
        .from("mkt_products")
        .select("id, name")
        .eq("tenant_id", ctx.tenantId)
        .ilike("name", name)
        .eq("is_active", true)
        .single();

      if (!product) {
        await sendButtons(ctx.phone, `Urun bulunamadi: ${name}`, [
          { id: "cmd:stoksorgula", title: "Stok Listesi" },
          { id: "cmd:menu", title: "Ana Menu" },
        ]);
        return;
      }

      await supabase
        .from("mkt_products")
        .update({ category, updated_at: new Date().toISOString() })
        .eq("id", product.id);

      await sendButtons(ctx.phone,
        `*${product.name}* kategorisi: ${category}`,
        [{ id: "cmd:kategoriler", title: "Kategoriler" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
    } catch (err) {
      console.error("[market:kategoriekle] error:", err);
      await sendText(ctx.phone, "Kategori atanirken bir hata olustu.");
    }
  }
};

// ── Category callback ───────────────────────────────────────────────────

export async function handleCategoryCallback(ctx: WaContext, callbackData: string): Promise<void> {
  const category = callbackData.replace("mkt_cat:", "");
  const session = await (await import("@/platform/whatsapp/session")).getSession(ctx.userId);
  if (!session || session.command !== "kategoriekle" || session.current_step !== "category") return;
  await stepKategoriEkle({ ...ctx, text: category } as WaContext, session);
}
