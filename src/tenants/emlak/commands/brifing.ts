import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export async function handleBrifing(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const [propRes, custRes, remRes] = await Promise.all([
    supabase.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("status", "aktif"),
    supabase.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("status", "active"),
    supabase.from("reminders").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("sent", false),
  ]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Günaydın" : now.getHours() < 18 ? "İyi günler" : "İyi akşamlar";

  let text = `📋 *${greeting} ${ctx.userName}!*\n\n`;
  text += `📊 *Günlük Brifing*\n\n`;
  text += `🏠 Aktif Mülk: ${propRes.count || 0}\n`;
  text += `👥 Aktif Müşteri: ${custRes.count || 0}\n`;
  text += `⏰ Bekleyen Hatırlatma: ${remRes.count || 0}\n`;
  text += `\n📅 ${now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;

  await sendButtons(ctx.phone, text, [
    { id: "cmd:portfoyum", title: "Portföyüm" },
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}
