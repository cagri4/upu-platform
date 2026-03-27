/**
 * /trend — Market trend analysis (enhanced from placeholder)
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("tr-TR").format(price) + " TL";
}

export async function handleTrend(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  // Get overall stats
  const { count: totalProps } = await supabase
    .from("emlak_properties")
    .select("*", { count: "exact", head: true })
    .eq("status", "aktif")
    .gt("price", 0);

  // Get type distribution
  const { data: typeData } = await supabase
    .from("emlak_properties")
    .select("type, price")
    .eq("status", "aktif")
    .gt("price", 0)
    .limit(500);

  const typeStats: Record<string, { count: number; total: number }> = {};
  for (const p of (typeData || [])) {
    const t = (p.type as string) || "diger";
    if (!typeStats[t]) typeStats[t] = { count: 0, total: 0 };
    typeStats[t].count++;
    typeStats[t].total += p.price as number;
  }

  const typeLabels: Record<string, string> = {
    daire: "Daire", villa: "Villa", arsa: "Arsa", mustakil: "Mustakil",
    rezidans: "Rezidans", isyeri: "Isyeri", dukkan: "Dukkan",
  };

  const topTypes = Object.entries(typeStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  let text = `📈 *PIYASA TRENDI*\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `📋 Toplam aktif ilan: ${totalProps || 0}\n\n`;

  if (topTypes.length > 0) {
    text += `🏠 *Tip Dagilimi:*\n`;
    for (const [type, stats] of topTypes) {
      const label = typeLabels[type] || type;
      const avg = Math.round(stats.total / stats.count);
      text += `  ${label}: ${stats.count} ilan | Ort: ${formatPrice(avg)}\n`;
    }
  }

  // Recent activity
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("emlak_properties")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekAgo);

  text += `\n📊 Son 7 gunde eklenen: ${recentCount || 0} ilan`;

  await sendButtons(ctx.phone, text, [
    { id: "cmd:analiz", title: "Pazar Analizi" },
    { id: "cmd:fiyatsor", title: "Fiyat Sor" },
    { id: "cmd:menu", title: "Ana Menu" },
  ]);
}
