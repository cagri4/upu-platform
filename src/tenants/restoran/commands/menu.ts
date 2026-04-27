/**
 * /menu — Menü kalemleri (kategori bazında, fiyat, kullanılabilirlik)
 *
 * NOTE: WhatsApp komut adı "menu" platform-level reserved word
 * (router.ts içinde help/menu olarak yakalanıyor). Bu yüzden tenant'a
 * `menukalemleri` olarak kaydediyoruz; alias üzerinden "yemekler",
 * "menukart" gibi tetikleyiciler veriyoruz.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency } from "./helpers";

export async function handleMenuKalemleri(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: items } = await supabase
      .from("rst_menu_items")
      .select("name, category, price, is_available")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("category")
      .order("name")
      .limit(40);

    if (!items?.length) {
      await sendButtons(ctx.phone, "📖 *Menü*\n\nHenüz menü kalemi tanımlanmamış. Web panelden ekleyin.", [
        { id: "cmd:webpanel", title: "🖥 Web Panel" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    const grouped: Record<string, typeof items> = {};
    for (const i of items) {
      const cat = i.category || "Diğer";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(i);
    }

    const sections = Object.entries(grouped).map(([cat, list]) => {
      const lines = list.map(i => {
        const avail = i.is_available ? "" : " ⚠️ tükendi";
        return `• ${i.name} — ${formatCurrency(i.price || 0)}${avail}`;
      });
      return `*${cat}*\n${lines.join("\n")}`;
    });

    const unavailable = items.filter(i => !i.is_available).length;

    await sendButtons(
      ctx.phone,
      `📖 *Menü*\n\n${sections.join("\n\n")}\n\n${items.length} kalem${unavailable ? ` • ${unavailable} tükendi` : ""}`,
      [
        { id: "cmd:webpanel", title: "🖥 Web Panel" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  } catch (err) {
    console.error("[restoran:menu] error:", err);
    await sendText(ctx.phone, "Menü verisi yüklenirken bir hata oluştu.");
  }
}
