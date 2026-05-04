import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

export async function handleMusteriler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: customers, count } = await supabase
      .from("emlak_customers")
      .select("id, name, phone, looking_for, listing_type, location, status", { count: "exact" })
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
      // looking_for array'i öncelikli; yoksa eski listing_type'a düş
      const lf = Array.isArray(c.looking_for) ? (c.looking_for as string[]) : [];
      const wantsSatilik = lf.includes("satilik") || c.listing_type === "satilik" || c.listing_type === "hepsi";
      const wantsKiralik = lf.includes("kiralik") || c.listing_type === "kiralik" || c.listing_type === "hepsi";
      const ltIcon = wantsSatilik && wantsKiralik ? "🏷🔑" : wantsSatilik ? "🏷" : wantsKiralik ? "🔑" : "•";
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
