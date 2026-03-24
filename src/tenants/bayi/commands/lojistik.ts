/**
 * /teslimatlar — Günün teslimat planı
 * /rota — Web panel yönlendirme
 * /kargotakip — Teslimat durumu takibi
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { today, formatCurrency, webPanelRedirect } from "./helpers";

export async function handleTeslimatlar(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: orders } = await supabase
      .from("bayi_orders")
      .select("order_number, total_amount, created_at, bayi_dealers!inner(company_name), bayi_order_statuses!inner(name, code)")
      .eq("tenant_id", ctx.tenantId)
      .in("bayi_order_statuses.code", ["preparing", "shipped", "in_transit", "delivering", "delivered"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (!orders?.length) {
      await sendButtons(ctx.phone, "🚛 *Teslimatlar*\n\nAktif teslimat bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const statusIcon: Record<string, string> = {
      preparing: "⏳", shipped: "📦", in_transit: "🚛",
      delivering: "🔄", delivered: "✅",
    };

    const lines = orders.map((o: any, i: number) => {
      const dealer = o.bayi_dealers?.company_name || "Bilinmeyen";
      const status = o.bayi_order_statuses?.name || o.bayi_order_statuses?.code || "";
      const icon = statusIcon[o.bayi_order_statuses?.code] || "📋";
      return `${i + 1}. ${icon} ${dealer}\n   #${o.order_number} — ${formatCurrency(o.total_amount || 0)} — ${status}`;
    });

    await sendButtons(
      ctx.phone,
      `🚛 *Teslimat Plani — ${today()}*\n\n${lines.join("\n\n")}`,
      [{ id: "cmd:kargotakip", title: "Kargo Takip" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:teslimatlar] error:", err);
    await sendText(ctx.phone, "Teslimat verisi yuklenirken bir hata olustu.");
  }
}

export async function handleRota(ctx: WaContext): Promise<void> {
  await webPanelRedirect(ctx.phone, "🗺️ *Rota Planlamasi*\nRota planlamasi icin web panelini kullanin.");
}

export async function handleKargoTakip(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const args = ctx.text.replace(/^\/?\s*kargotakip\s*/i, "").trim();

    let query = supabase
      .from("bayi_orders")
      .select("order_number, total_amount, vehicle_plate, driver_name, created_at, bayi_dealers!inner(company_name), bayi_order_statuses!inner(name, code)")
      .eq("tenant_id", ctx.tenantId);

    if (args) {
      const orderNum = args.replace("#", "");
      query = query.eq("order_number", orderNum);
    } else {
      query = query.in("bayi_order_statuses.code", ["shipped", "in_transit", "delivering"]);
    }

    const { data: orders } = await query.order("created_at", { ascending: false }).limit(5);

    if (!orders?.length) {
      await sendButtons(ctx.phone, "📦 *Kargo Takip*\n\nSonuc bulunamadi.\n\nKullanim: /kargotakip [siparis no]", [
        { id: "cmd:teslimatlar", title: "Teslimatlar" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = orders.map((o: any) => {
      const dealer = o.bayi_dealers?.company_name || "Bilinmeyen";
      const status = o.bayi_order_statuses?.name || "";
      const plate = o.vehicle_plate ? `\n   Plaka: ${o.vehicle_plate}` : "";
      const driver = o.driver_name ? ` | Surucu: ${o.driver_name}` : "";
      return `📦 #${o.order_number} — ${dealer}\n   ${status} — ${formatCurrency(o.total_amount || 0)}${plate}${driver}`;
    });

    await sendButtons(
      ctx.phone,
      `📦 *Kargo Takip*\n\n${lines.join("\n\n")}`,
      [{ id: "cmd:teslimatlar", title: "Teslimatlar" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:kargotakip] error:", err);
    await sendText(ctx.phone, "Kargo takip verisi yuklenirken bir hata olustu.");
  }
}
