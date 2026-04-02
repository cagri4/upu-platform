/**
 * Market — Teslimat komutlari
 *
 * /teslimal      — Siparisi teslim alindi olarak isaretle
 * /teslimatlar   — Teslim alinan siparisler listesi
 */

import type { WaContext, StepHandler } from "@/platform/whatsapp/types";
import { startSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { shortDate } from "./helpers";

// ── /teslimal — multi-step: ask order ID ────────────────────────────────

export async function handleTeslimAl(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "teslimal", "orderId");
  await sendText(ctx.phone, "Teslim alinan siparis ID girin (ilk 8 karakter):");
}

export const stepTeslimAl: StepHandler = async (ctx, session) => {
  const orderId = ctx.text.trim();
  if (!orderId) {
    await sendText(ctx.phone, "Siparis ID bos olamaz. Tekrar girin:");
    return;
  }

  await endSession(ctx.userId);

  try {
    const supabase = getServiceClient();

    const { data: order } = await supabase
      .from("mkt_orders")
      .select("id, status, mkt_suppliers(name)")
      .eq("tenant_id", ctx.tenantId)
      .like("id", `${orderId}%`)
      .single();

    if (!order) {
      await sendButtons(ctx.phone, `Siparis bulunamadi: ${orderId}`, [
        { id: "cmd:siparisler", title: "Siparis Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    if (order.status === "delivered") {
      await sendButtons(ctx.phone, "Bu siparis zaten teslim alindi.", [
        { id: "cmd:siparisler", title: "Siparis Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    if (order.status === "cancelled") {
      await sendButtons(ctx.phone, "Bu siparis iptal edilmis.", [
        { id: "cmd:siparisler", title: "Siparis Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    // Mark as delivered
    await supabase
      .from("mkt_orders")
      .update({ status: "delivered", updated_at: new Date().toISOString() })
      .eq("id", order.id);

    // Update product stock from order items
    const { data: items } = await supabase
      .from("mkt_order_items")
      .select("product_name, quantity")
      .eq("order_id", order.id);

    let stockUpdated = 0;
    if (items?.length) {
      for (const item of items) {
        const { data: product } = await supabase
          .from("mkt_products")
          .select("id, quantity")
          .eq("tenant_id", ctx.tenantId)
          .ilike("name", item.product_name)
          .eq("is_active", true)
          .single();

        if (product) {
          const newQty = Number(product.quantity) + item.quantity;
          await supabase
            .from("mkt_products")
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq("id", product.id);
          stockUpdated++;
        }
      }
    }

    const id8 = order.id.substring(0, 8);
    const supplier = Array.isArray(order.mkt_suppliers) ? order.mkt_suppliers[0] : order.mkt_suppliers;
    const supplierName = (supplier as any)?.name || "-";

    let msg = `Siparis ${id8} teslim alindi.\nTedarikci: ${supplierName}`;
    if (stockUpdated > 0) {
      msg += `\n${stockUpdated} urun stoga eklendi.`;
    }

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:stoksorgula", title: "Stok Listesi" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[market:teslimal] error:", err);
    await sendText(ctx.phone, "Teslimat islerken bir hata olustu.");
  }
};

// ── /teslimatlar — list delivered orders (no multi-step) ────────────────

export async function handleTeslimatlar(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: orders } = await supabase
      .from("mkt_orders")
      .select("id, status, updated_at, mkt_suppliers(name)")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "delivered")
      .order("updated_at", { ascending: false })
      .limit(20);

    if (!orders?.length) {
      await sendButtons(ctx.phone, "Teslim alinan siparis bulunamadi.", [
        { id: "cmd:siparisler", title: "Siparis Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = orders.map((o: any) => {
      const id8 = o.id.substring(0, 8);
      const date = shortDate(o.updated_at);
      const supplier = Array.isArray(o.mkt_suppliers) ? o.mkt_suppliers[0] : o.mkt_suppliers;
      return `*${id8}* | ${supplier?.name || "-"} | ${date}`;
    });

    await sendButtons(ctx.phone,
      `*Teslim Alinan Siparisler*\n\n${lines.join("\n")}`,
      [{ id: "cmd:siparisler", title: "Aktif Siparisler" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[market:teslimatlar] error:", err);
    await sendText(ctx.phone, "Teslimat verisi yuklenirken bir hata olustu.");
  }
}
