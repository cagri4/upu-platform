/**
 * /stok — Kritik stok uyarıları + tedarikçi bilgisi
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export async function handleStok(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: items } = await supabase
      .from("rst_inventory")
      .select("name, unit, quantity, low_threshold, supplier_name, supplier_phone")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("quantity", { ascending: true })
      .limit(30);

    if (!items?.length) {
      await sendButtons(ctx.phone, "📦 *Stok*\n\nHenüz stok kalemi tanımlanmamış. Web panelden ekleyin.", [
        { id: "cmd:webpanel", title: "🖥 Web Panel" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    const critical = items.filter(i => i.low_threshold != null && i.quantity <= i.low_threshold);
    const warning = items.filter(i =>
      i.low_threshold != null
      && i.quantity > i.low_threshold
      && i.quantity <= i.low_threshold * 2,
    );

    if (!critical.length && !warning.length) {
      await sendButtons(
        ctx.phone,
        `🟢 *Stok Durumu*\n\nTüm kalemler yeterli (${items.length} kalem).`,
        [{ id: "cmd:menu", title: "Ana Menü" }],
      );
      return;
    }

    const sections: string[] = [];
    if (critical.length) {
      const lines = critical.map(i => {
        const supplier = i.supplier_name ? ` — 📞 ${i.supplier_name}${i.supplier_phone ? " " + i.supplier_phone : ""}` : "";
        return `🔴 *${i.name}*: ${i.quantity} ${i.unit || ""} (min: ${i.low_threshold})${supplier}`;
      });
      sections.push(`*Acil — Sipariş ver:*\n${lines.join("\n")}`);
    }
    if (warning.length) {
      const lines = warning.map(i => `🟡 *${i.name}*: ${i.quantity} ${i.unit || ""} (min: ${i.low_threshold})`);
      sections.push(`*Yakında bitecek:*\n${lines.join("\n")}`);
    }

    await sendButtons(
      ctx.phone,
      `📦 *Stok Uyarıları*\n\n${sections.join("\n\n")}\n\n${critical.length} kritik • ${warning.length} yakın`,
      [
        { id: "cmd:webpanel", title: "🖥 Web Panel" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  } catch (err) {
    console.error("[restoran:stok] error:", err);
    await sendText(ctx.phone, "Stok verisi yüklenirken bir hata oluştu.");
  }
}
