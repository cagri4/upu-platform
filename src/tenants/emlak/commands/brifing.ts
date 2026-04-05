import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

export async function handleBrifing(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [propRes, custRes, remRes, staleRes] = await Promise.all([
      supabase.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("status", "aktif"),
      supabase.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("status", "active"),
      supabase.from("reminders").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("sent", false),
      supabase.from("emlak_properties").select("id, title, updated_at").eq("user_id", ctx.userId).eq("status", "aktif").lt("updated_at", thirtyDaysAgo).order("updated_at", { ascending: true }).limit(3),
    ]);

    const now = new Date();
    const greeting = now.getHours() < 12 ? "Günaydın" : now.getHours() < 18 ? "İyi günler" : "İyi akşamlar";

    let text = `📋 *${greeting} ${ctx.userName}!*\n\n`;
    text += `📊 *Günlük Brifing*\n\n`;
    text += `🏠 Aktif Mülk: ${propRes.count || 0}\n`;
    text += `👥 Aktif Müşteri: ${custRes.count || 0}\n`;
    text += `⏰ Bekleyen Hatırlatma: ${remRes.count || 0}\n`;

    // Stale properties warning
    const staleProps = staleRes.data || [];
    if (staleProps.length > 0) {
      text += `\n⚠️ *30+ gündür güncellenmemiş mülkler:*\n`;
      for (const sp of staleProps) {
        const days = Math.floor((Date.now() - new Date(sp.updated_at).getTime()) / (24 * 60 * 60 * 1000));
        text += `  • ${sp.title || "İsimsiz"} (${days} gün)\n`;
      }
      text += `\nFiyat güncellemesi veya statü değişikliği gerekebilir.`;
    }

    text += `\n\n📅 ${now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;

    await sendButtons(ctx.phone, text, [
      { id: "cmd:mulkyonet", title: "Mülk Yönet" },
      { id: "cmd:portfoyum", title: "Portföyüm" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    await logEvent(ctx.tenantId, ctx.userId, "brifing", `${propRes.count || 0} mülk, ${custRes.count || 0} müşteri`);
  } catch (err) {
    await handleError(ctx, "emlak:brifing", err, "db");
  }
}
