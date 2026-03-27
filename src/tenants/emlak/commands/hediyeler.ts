/**
 * /hediyeler — View and claim active campaigns/gifts
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export async function handleHediyeler(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title, description, is_active, start_date, end_date")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!campaigns || campaigns.length === 0) {
    await sendButtons(ctx.phone,
      "📭 Su anda aktif hediye/kampanya yok.\n\nYeni kampanyalar eklendiginde sekreteriniz size bildirecek.",
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
    return;
  }

  let text = "🎁 *Hediyeler & Kampanyalar*\n\n";
  for (const [i, c] of campaigns.entries()) {
    const expiry = c.end_date
      ? `Son: ${new Date(c.end_date).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}`
      : "";
    text += `${i + 1}. ${c.title}\n   🎁 Aktif${expiry ? ` | ${expiry}` : ""}\n\n`;
  }

  const rows = campaigns.map(c => ({
    id: `hdy:view:${c.id}`,
    title: (c.title as string).substring(0, 24),
    description: (c.description as string || "").substring(0, 72),
  }));

  await sendList(ctx.phone, text + "Detay icin secin:", "Kampanya Sec", [
    { title: "Kampanyalar", rows },
  ]);
}

export async function handleHediyelerCallback(ctx: WaContext, data: string): Promise<void> {
  const parts = data.split(":");

  // View campaign
  if (parts[1] === "view") {
    const campaignId = parts[2];
    const supabase = getServiceClient();

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      await sendButtons(ctx.phone, "Kampanya bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    let detail = `🎁 ${campaign.title}\n\n`;
    if (campaign.description) detail += `${campaign.description}\n\n`;
    if (campaign.end_date) {
      detail += `📅 Son Tarih: ${new Date(campaign.end_date).toLocaleDateString("tr-TR")}\n`;
    }

    await sendButtons(ctx.phone, detail, [
      { id: "cmd:hediyeler", title: "Geri" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }
}
