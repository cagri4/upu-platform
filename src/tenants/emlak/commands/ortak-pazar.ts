/**
 * /ortakpazar — Shared property marketplace between agents
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("tr-TR").format(price) + " TL";
}

export async function handleOrtakPazar(ctx: WaContext): Promise<void> {
  await sendButtons(ctx.phone,
    "🤝 ORTAK PAZAR\n━━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "Diger emlakclarla mulk paylasim agi.\n\n" +
    "📤 Kendi mulklerinizi paylasarak diger emlakcilarin musterilerine ulasin\n" +
    "📥 Diger emlakcilarin paylastigi mulkleri gorun",
    [
      { id: "op:myprops", title: "Mulklerimi Paylas" },
      { id: "op:incoming", title: "Gelen Ilanlar" },
      { id: "cmd:menu", title: "Ana Menu" },
    ],
  );
}

export async function handleOrtakPazarCallback(ctx: WaContext, data: string): Promise<void> {
  const supabase = getServiceClient();

  if (data === "op:cancel") {
    await sendButtons(ctx.phone, "❌ Ortak pazar kapatildi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
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
      await sendButtons(ctx.phone, "📭 Portfoyunuzde paylasacak mulk yok.", [
        { id: "cmd:mulkekle", title: "Mulk Ekle" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const rows = props.map(p => {
      const shared = p.shared_in_network as boolean;
      const icon = shared ? "🟢" : "⚪";
      return {
        id: `op:share:${p.id}`,
        title: `${icon} ${((p.title || "Isimsiz") as string).substring(0, 20)}`,
        description: shared ? "Paylasiliyor" : "Paylasilmiyor",
      };
    });

    await sendList(ctx.phone,
      "📤 MULKLERIM — Ortak Pazar\n\n🟢 = Paylasiliyor | ⚪ = Paylasilmiyor\n\nDurumu degistirmek icin tiklayin:",
      "Mulk Sec",
      [{ title: "Mulkler", rows }],
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
      await sendButtons(ctx.phone, "Mulk bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    const newState = !(prop.shared_in_network as boolean);
    await supabase
      .from("emlak_properties")
      .update({ shared_in_network: newState })
      .eq("id", propId);

    const msg = newState
      ? `✅ "${prop.title}" ortak pazara eklendi!`
      : `🔒 "${prop.title}" ortak pazardan kaldirildi.`;

    await sendButtons(ctx.phone, msg, [
      { id: "op:myprops", title: "Mulklerime Don" },
      { id: "cmd:menu", title: "Ana Menu" },
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
      await sendButtons(ctx.phone, "📥 Henuz diger emlakcilerdan paylasilan ilan yok.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    let text = "📥 GELEN ILANLAR\n━━━━━━━━━━━━━━━━━━━━━━\n\n";
    for (const p of props) {
      text += `🏠 ${p.title || "Ilan"}\n`;
      text += `   💰 ${p.price ? formatPrice(p.price) : "—"}`;
      if (p.rooms) text += ` | ${p.rooms}`;
      if (p.area) text += ` | ${p.area}m²`;
      if (p.location_district) text += ` | 📍 ${p.location_district}`;
      text += "\n";
      if (p.source_url) text += `   🔗 ${p.source_url}\n`;
      text += "\n";
    }

    await sendButtons(ctx.phone, text, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }
}
