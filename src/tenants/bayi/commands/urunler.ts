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
  await webPanelRedirect(ctx.phone, "📋 *Yeni Urun Ekleme*\nUrun eklemek icin web panelini kullanin.");
}

export async function handleFiyatGuncelle(ctx: WaContext): Promise<void> {
  await webPanelRedirect(ctx.phone, "📋 *Fiyat Guncelleme*\nFiyat guncellemek icin web panelini kullanin.");
}
