/**
 * /stok — Stok durumu
 * /kritikstok — Düşük stok uyarıları
 * /stokhareketleri — Son 7 günün sipariş hareketleri
 * /tedarikciler — Tedarikçi listesi
 * /satinalma — Satın alma talepleri
 * /ihtiyac — Stok ihtiyaç analizi
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, shortDate, webPanelRedirect } from "./helpers";

export async function handleStok(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: products } = await supabase
      .from("bayi_products")
      .select("name, stock_quantity, low_stock_threshold")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("stock_quantity", { ascending: true })
      .limit(15);

    if (!products?.length) {
      await sendButtons(ctx.phone, "📦 Stok verisi bulunamadi.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = products.map((p: any) => {
      const threshold = p.low_stock_threshold || 0;
      let icon = "🟢";
      if (p.stock_quantity <= threshold) icon = "🔴";
      else if (p.stock_quantity <= threshold * 2) icon = "🟡";
      return `${icon} *${p.name}*: ${p.stock_quantity} adet (min: ${threshold})`;
    });

    const criticalCount = products.filter((p: any) => p.stock_quantity <= (p.low_stock_threshold || 0)).length;

    await sendButtons(
      ctx.phone,
      `📦 *Stok Durumu*\n\n${lines.join("\n")}\n\nToplam: ${products.length} urun | ${criticalCount} kritik`,
      [
        { id: "cmd:kritikstok", title: "Kritik Stok" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[bayi:stok] error:", err);
    await sendText(ctx.phone, "Stok verisi yuklenirken bir hata olustu.");
  }
}

export async function handleKritikStok(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: products } = await supabase
      .from("bayi_products")
      .select("name, code, stock_quantity, low_stock_threshold")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("stock_quantity", { ascending: true });

    if (!products?.length) {
      await sendButtons(ctx.phone, "🔴 *Kritik Stok*\n\nUrun verisi bulunamadi.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const critical = products.filter((p: any) => p.stock_quantity <= (p.low_stock_threshold || 0));

    if (!critical.length) {
      await sendButtons(ctx.phone, "🟢 *Kritik Stok*\n\nTum urunlerin stok seviyesi yeterli!", [
        { id: "cmd:stok", title: "Stok Durumu" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = critical.map((p: any, i: number) =>
      `${i + 1}. *${p.name}* (${p.code || ""})\n   Stok: ${p.stock_quantity} adet | Min: ${p.low_stock_threshold}`,
    );

    await sendButtons(
      ctx.phone,
      `🔴 *Kritik Stok Uyarisi*\n\n${lines.join("\n\n")}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:kritikstok] error:", err);
    await sendText(ctx.phone, "Kritik stok verisi yuklenirken bir hata olustu.");
  }
}

export async function handleStokHareketleri(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: items } = await supabase
      .from("bayi_order_items")
      .select("product_name, quantity, unit_price, bayi_orders!inner(created_at, order_number)")
      .eq("tenant_id", ctx.tenantId)
      .gte("bayi_orders.created_at", weekAgo.toISOString())
      .order("bayi_orders(created_at)", { ascending: false })
      .limit(15);

    if (!items?.length) {
      await sendButtons(ctx.phone, "📊 *Stok Hareketleri*\n\nSon 7 gunde stok hareketi bulunmuyor.", [
        { id: "cmd:stok", title: "Stok Durumu" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = items.map((item: any) => {
      const date = shortDate((item as any).bayi_orders?.created_at || "");
      return `${date} — ${item.product_name} x${item.quantity} — #${(item as any).bayi_orders?.order_number || ""}`;
    });

    await sendButtons(
      ctx.phone,
      `📊 *Stok Hareketleri — Son 7 Gun*\n\n*Cikislar (siparisler):*\n${lines.join("\n")}`,
      [{ id: "cmd:stok", title: "Stok Durumu" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:stokhareketleri] error:", err);
    await sendText(ctx.phone, "Stok hareketleri yuklenirken bir hata olustu.");
  }
}

export async function handleTedarikciler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: suppliers } = await supabase
      .from("bayi_suppliers")
      .select("name, contact_name, phone")
      .eq("tenant_id", ctx.tenantId)
      .order("name")
      .limit(15);

    if (!suppliers?.length) {
      await sendButtons(ctx.phone, "🏭 *Tedarikciler*\n\nTedarikci kaydi bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = suppliers.map((s: any, i: number) =>
      `${i + 1}. *${s.name}*\n   ${s.contact_name ? "Yetkili: " + s.contact_name : ""}\n   📞 ${s.phone || "Yok"}`,
    );

    await sendButtons(ctx.phone, `🏭 *Tedarikci Listesi*\n\n${lines.join("\n\n")}`, [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[bayi:tedarikciler] error:", err);
    await sendText(ctx.phone, "Tedarikci verisi yuklenirken bir hata olustu.");
  }
}

export async function handleSatinAlma(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: purchaseOrders } = await supabase
      .from("bayi_purchase_orders")
      .select("id, status, total_amount, items, bayi_suppliers!inner(name)")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!purchaseOrders?.length) {
      await webPanelRedirect(ctx.phone, "🛒 *Satin Alma*\nSatin alma talebi bulunmuyor.\nYeni talep icin web panelini kullanin.");
      return;
    }

    const statusIcon: Record<string, string> = {
      pending: "⏳", approved: "🟢", ordered: "📦",
      received: "✅", cancelled: "❌",
    };

    const lines = purchaseOrders.map((po: any, i: number) => {
      const supplier = po.bayi_suppliers?.name || "Bilinmeyen";
      const icon = statusIcon[po.status] || "📋";
      return `${i + 1}. ${icon} ${supplier} — ${formatCurrency(po.total_amount || 0)} — ${po.status}`;
    });

    await sendButtons(
      ctx.phone,
      `🛒 *Satin Alma Talepleri*\n\n${lines.join("\n")}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:satinalma] error:", err);
    await sendText(ctx.phone, "Satin alma verisi yuklenirken bir hata olustu.");
  }
}

export async function handleIhtiyac(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: products } = await supabase
      .from("bayi_products")
      .select("name, stock_quantity, low_stock_threshold")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("stock_quantity", { ascending: true });

    if (!products?.length) {
      await sendButtons(ctx.phone, "📊 *Stok Ihtiyac*\n\nUrun verisi bulunamadi.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lowStock = products.filter((p: any) => p.stock_quantity <= (p.low_stock_threshold || 0) * 2);

    if (!lowStock.length) {
      await sendButtons(ctx.phone, "🟢 *Stok Ihtiyac*\n\nTum urunlerin stok seviyesi yeterli, acil ihtiyac yok.", [
        { id: "cmd:stok", title: "Stok Durumu" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = lowStock.map((p: any) => {
      const threshold = p.low_stock_threshold || 0;
      const deficit = Math.max(0, threshold * 3 - p.stock_quantity);
      const urgency = p.stock_quantity <= threshold ? "🔴 Acil" : "🟡 Yakin";
      return `${urgency} *${p.name}*\n   Stok: ${p.stock_quantity} | Min: ${threshold} | Onerilen siparis: ${deficit}`;
    });

    await sendButtons(
      ctx.phone,
      `📊 *Stok Ihtiyac Analizi*\n\n${lines.join("\n\n")}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:ihtiyac] error:", err);
    await sendText(ctx.phone, "Ihtiyac analizi yuklenirken bir hata olustu.");
  }
}
