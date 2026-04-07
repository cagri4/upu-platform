/**
 * /urunler — Ürün kataloğu
 * /fiyatliste — Güncel fiyat listesi
 * /yeniurun — Web panel yönlendirme
 * /fiyatguncelle — Web panel yönlendirme
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, webPanelRedirect } from "./helpers";

export async function handleUrunler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: products } = await supabase
      .from("bayi_products")
      .select("name, code, base_price, stock_quantity")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name")
      .limit(15);

    if (!products?.length) {
      await sendButtons(ctx.phone, "📋 *Urunler*\n\nUrun kaydi bulunamadi.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = products.map((p: any, i: number) =>
      `${i + 1}. *${p.name}* ${p.code ? "(" + p.code + ")" : ""}\n   ${formatCurrency(p.base_price || 0)} | Stok: ${p.stock_quantity}`,
    );

    await sendButtons(
      ctx.phone,
      `📋 *Urun Katalogu*\n\n${lines.join("\n")}`,
      [
        { id: "cmd:fiyatliste", title: "Fiyat Listesi" },
        { id: "cmd:stok", title: "Stok Durumu" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[bayi:urunler] error:", err);
    await sendText(ctx.phone, "Urun verisi yuklenirken bir hata olustu.");
  }
}

export async function handleFiyatListe(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: products } = await supabase
      .from("bayi_products")
      .select("name, code, base_price")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name")
      .limit(20);

    if (!products?.length) {
      await sendButtons(ctx.phone, "📋 *Fiyat Listesi*\n\nUrun bulunamadi.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = products.map((p: any) => `*${p.name}* — ${formatCurrency(p.base_price || 0)}`);

    await sendButtons(
      ctx.phone,
      `📋 *Guncel Fiyat Listesi*\n\n${lines.join("\n")}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:fiyatliste] error:", err);
    await sendText(ctx.phone, "Fiyat listesi yuklenirken bir hata olustu.");
  }
}

export async function handleYeniUrun(ctx: WaContext): Promise<void> {
  const { startSession } = await import("@/platform/whatsapp/session");
  await startSession(ctx.userId, ctx.tenantId, "yeniurun", "name");
  await sendText(ctx.phone,
    "📦 *Hızlı Ürün Ekleme*\n\nÜrün adını yazın:\n\nÖrnek: Marshall Boya 10L Beyaz"
  );
}

export async function handleYeniUrunStep(ctx: WaContext, session: import("@/platform/whatsapp/session").CommandSession): Promise<void> {
  const { updateSession, endSession } = await import("@/platform/whatsapp/session");
  const text = ctx.text?.trim();
  if (!text) { await sendText(ctx.phone, "Lütfen bir değer yazın."); return; }
  const skip = text.toLowerCase() === "geç";

  switch (session.current_step) {
    case "name": {
      if (text.length < 2) { await sendText(ctx.phone, "Ürün adı en az 2 karakter:"); return; }
      await updateSession(ctx.userId, "category", { name: text });
      await sendText(ctx.phone, "Kategori yazın:\n\nÖrnek: İç Cephe Boya\n\n(\"geç\" ile atlayın)");
      return;
    }
    case "category": {
      await updateSession(ctx.userId, "price", { category: skip ? null : text });
      await sendText(ctx.phone, "Fiyat yazın (TL):\n\nÖrnek: 450");
      return;
    }
    case "price": {
      const price = parseFloat(text.replace(/[^\d.,]/g, "").replace(",", "."));
      if (isNaN(price) || price <= 0) { await sendText(ctx.phone, "Geçerli fiyat yazın:"); return; }
      await updateSession(ctx.userId, "stock", { price });
      await sendText(ctx.phone, "Stok miktarı:\n\nÖrnek: 100\n\n(\"geç\" ile atlayın)");
      return;
    }
    case "stock": {
      const stock = skip ? 0 : parseInt(text.replace(/[^\d]/g, ""), 10) || 0;
      await updateSession(ctx.userId, "unit", { stock });
      await sendButtons(ctx.phone, "Birim seçin:", [
        { id: "yeniurun_birim:adet", title: "Adet" },
        { id: "yeniurun_birim:kg", title: "Kg" },
        { id: "yeniurun_birim:litre", title: "Litre" },
      ]);
      return;
    }
  }
}

export async function handleYeniUrunCallback(ctx: WaContext, data: string): Promise<void> {
  const unit = data.replace("yeniurun_birim:", "");
  const { endSession } = await import("@/platform/whatsapp/session");

  const supabase = getServiceClient();
  const { data: sess } = await supabase.from("command_sessions").select("data").eq("user_id", ctx.userId).single();
  if (!sess) { await endSession(ctx.userId); return; }

  const d = sess.data as Record<string, unknown>;
  await endSession(ctx.userId);

  const { error } = await supabase.from("bayi_products").insert({
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    code: `P${Date.now().toString(36).toUpperCase()}`,
    name: d.name,
    category: d.category || null,
    base_price: d.price,
    unit_price: d.price,
    stock_quantity: d.stock || 0,
    unit,
    low_stock_threshold: 10,
    min_order: 1,
    is_active: true,
  });

  if (error) {
    await sendButtons(ctx.phone, "❌ Ürün eklenirken hata oluştu.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  await sendButtons(ctx.phone,
    `✅ Ürün eklendi!\n\n📦 ${d.name}\n💰 ${new Intl.NumberFormat("tr-TR").format(d.price as number)} TL\n📊 Stok: ${d.stock || 0} ${unit}` +
    (d.category ? `\n🏷 ${d.category}` : ""),
    [
      { id: "cmd:urunler", title: "📋 Ürünler" },
      { id: "cmd:yeniurun", title: "➕ Bir Daha Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ],
  );
}

export async function handleFiyatGuncelle(ctx: WaContext): Promise<void> {
  await webPanelRedirect(ctx.phone, "📋 *Fiyat Guncelleme*\nFiyat guncellemek icin web panelini kullanin.");
}
