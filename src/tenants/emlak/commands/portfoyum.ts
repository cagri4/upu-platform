import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

export async function handlePortfoyum(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: properties, count } = await supabase
      .from("emlak_properties")
      .select("id, title, price, area, rooms, type, listing_type, status", { count: "exact" })
      .eq("user_id", ctx.userId)
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!properties || properties.length === 0) {
      await sendButtons(ctx.phone, "📋 Portföyünüz henüz boş.\n\nHemen ilk mülkünüzü ekleyin!", [
        { id: "cmd:mulkekle", title: "Mülk Ekle" },
        { id: "cmd:tara", title: "Sahibinden'den Tara" },
      ]);
      return;
    }

    const aktif = properties.filter(p => p.status === "aktif").length;
    let text = `📋 *Portföyünüz* (${count} mülk, ${aktif} aktif)\n\n`;

    for (const p of properties) {
      const price = p.price ? new Intl.NumberFormat("tr-TR").format(p.price) + " TL" : "-";
      const statusIcon = p.status === "aktif" ? "🟢" : "⚪";
      text += `${statusIcon} *${p.title || "İsimsiz"}*\n`;
      text += `   💰 ${price} | 📐 ${p.area || "-"} m² | 🛏 ${p.rooms || "-"}\n\n`;
    }

    if ((count || 0) > 5) {
      text += `...ve ${(count || 0) - 5} mülk daha`;
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:mulkyonet", title: "⚙️ Mülk Yönet" },
      { id: "cmd:mulkekle", title: "➕ Mülk Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    await logEvent(ctx.tenantId, ctx.userId, "portfoyum", `${count} mülk listelendi`);
  } catch (err) {
    await handleError(ctx, "emlak:portfoyum", err, "db");
  }
}
