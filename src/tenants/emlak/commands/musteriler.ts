import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

export async function handleMusteriler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: customers, count } = await supabase
      .from("emlak_customers")
      .select("id, name, phone, listing_type, location, status", { count: "exact" })
      .eq("user_id", ctx.userId)
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!customers || customers.length === 0) {
      await sendButtons(ctx.phone, "👥 Henüz müşteri eklenmemiş.\n\nİlk müşterinizi ekleyin!", [
        { id: "cmd:musteriEkle", title: "Müşteri Ekle" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    let text = `👥 *Müşterileriniz* (${count} toplam)\n\n`;
    for (const c of customers) {
      const ltIcon = c.listing_type === "satilik" ? "🏷" : "🔑";
      text += `${ltIcon} *${c.name}*\n`;
      text += `   📱 ${c.phone || "-"} | 📍 ${c.location || "-"}\n\n`;
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:musteriEkle", title: "Müşteri Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    await logEvent(ctx.tenantId, ctx.userId, "musteriler", `${count} müşteri listelendi`);
  } catch (err) {
    await handleError(ctx, "emlak:musteriler", err, "db");
  }
}
