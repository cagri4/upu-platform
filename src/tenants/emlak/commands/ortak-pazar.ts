/**
 * /ortakpazar — Shared property marketplace between agents
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("tr-TR").format(price) + " TL";
}

export async function handleOrtakPazar(ctx: WaContext): Promise<void> {
  await sendButtons(ctx.phone,
    "🤝 ORTAK PAZAR\n━━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "Diğer emlakçılarla mülk paylaşım ağı.\n\n" +
    "📤 Kendi mülklerinizi paylaşarak diğer emlakçıların müşterilerine ulaşın\n" +
    "📥 Diğer emlakçıların paylaştığı mülkleri görün",
    [
      { id: "op:myprops", title: "Mülklerimi Paylaş" },
      { id: "op:incoming", title: "Gelen İlanlar" },
      { id: "cmd:menu", title: "Ana Menü" },
    ],
  );
}

export async function handleOrtakPazarCallback(ctx: WaContext, data: string): Promise<void> {
  const supabase = getServiceClient();

  if (data === "op:cancel") {
    await sendButtons(ctx.phone, "❌ Ortak pazar kapatıldı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  // My properties
  if (data === "op:myprops") {
    const { data: props } = await supabase
      .from("emlak_properties")
      .select("id, title, price, shared_in_network")
      .eq("user_id", ctx.userId)
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "aktif")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!props || props.length === 0) {
      await sendButtons(ctx.phone, "📭 Portfoyunuzde paylaşacak mülk yok.", [
        { id: "cmd:mulkekle", title: "Mülk Ekle" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    const rows = props.map(p => {
      const shared = p.shared_in_network as boolean;
      const icon = shared ? "🟢" : "⚪";
      return {
        id: `op:share:${p.id}`,
        title: `${icon} ${((p.title || "İsimsiz") as string).substring(0, 20)}`,
        description: shared ? "Paylaşılıyor" : "Paylaşılmıyor",
      };
    });

    await sendList(ctx.phone,
      "📤 MULKLERIM — Ortak Pazar\n\n🟢 = Paylaşılıyor | ⚪ = Paylaşılmıyor\n\nDurumu değiştirmek için tıklayın:",
      "Mülk Seç",
      [{ title: "Mülkler", rows }],
    );
    return;
  }

  // Toggle share
  if (data.startsWith("op:share:")) {
    const propId = data.substring(9);

    const { data: prop } = await supabase
      .from("emlak_properties")
      .select("id, title, shared_in_network")
      .eq("id", propId)
      .eq("user_id", ctx.userId)
      .single();

    if (!prop) {
      await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const newState = !(prop.shared_in_network as boolean);
    await supabase
      .from("emlak_properties")
      .update({ shared_in_network: newState })
      .eq("id", propId);

    const msg = newState
      ? `✅ "${prop.title}" ortak pazara eklendi!`
      : `🔒 "${prop.title}" ortak pazardan kaldırıldı.`;

    await sendButtons(ctx.phone, msg, [
      { id: "op:myprops", title: "Mülklerime Dön" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  // Incoming listings
  if (data === "op:incoming") {
    const { data: props } = await supabase
      .from("emlak_properties")
      .select("id, title, price, type, rooms, area, location_district, source_url")
      .eq("shared_in_network", true)
      .neq("user_id", ctx.userId)
      .eq("status", "aktif")
      .gt("price", 0)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (!props || props.length === 0) {
      await sendButtons(ctx.phone, "📥 Henüz diğer emlakçılardan paylaşılan ilan yok.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    let text = "📥 GELEN İLANLAR\n━━━━━━━━━━━━━━━━━━━━━━\n\n";
    for (const p of props) {
      text += `🏠 ${p.title || "İlan"}\n`;
      text += `   💰 ${p.price ? formatPrice(p.price) : "—"}`;
      if (p.rooms) text += ` | ${p.rooms}`;
      if (p.area) text += ` | ${p.area}m²`;
      if (p.location_district) text += ` | 📍 ${p.location_district}`;
      text += "\n";
      if (p.source_url) text += `   🔗 ${p.source_url}\n`;
      text += "\n";
    }

    await sendText(ctx.phone, text);
    return;
  }
}
