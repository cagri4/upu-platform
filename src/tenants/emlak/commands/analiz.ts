import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export async function handleAnaliz(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { count: totalProps } = await supabase
    .from("emlak_properties")
    .select("*", { count: "exact", head: true })
    .eq("status", "aktif");

  const { data: cities } = await supabase
    .from("emlak_properties")
    .select("location_city")
    .eq("status", "aktif")
    .not("location_city", "is", null);

  const cityCount: Record<string, number> = {};
  cities?.forEach(p => {
    const city = p.location_city as string;
    if (city) cityCount[city] = (cityCount[city] || 0) + 1;
  });

  const topCities = Object.entries(cityCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let text = `📊 *Pazar Analizi*\n\n`;
  text += `📋 Toplam aktif ilan: ${totalProps || 0}\n\n`;
  if (topCities.length > 0) {
    text += `🏙 *En çok ilan olan şehirler:*\n`;
    for (const [city, count] of topCities) {
      text += `   ${city}: ${count} ilan\n`;
    }
  }

  await sendButtons(ctx.phone, text, [
    { id: "cmd:fiyatsor", title: "Fiyat Sor" },
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}

export async function handleRapor(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const [propRes, custRes, contractRes] = await Promise.all([
    supabase.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId),
    supabase.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId),
    supabase.from("contracts").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId),
  ]);

  let text = `📊 *Aylık Rapor*\n\n`;
  text += `🏠 Toplam Mülk: ${propRes.count || 0}\n`;
  text += `👥 Toplam Müşteri: ${custRes.count || 0}\n`;
  text += `📄 Toplam Sözleşme: ${contractRes.count || 0}\n`;

  await sendButtons(ctx.phone, text, [
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}
