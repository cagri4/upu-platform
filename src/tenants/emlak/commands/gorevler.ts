import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export async function handleGorevler(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: reminders } = await supabase
    .from("reminders")
    .select("id, topic, message, due_at")
    .eq("user_id", ctx.userId)
    .eq("sent", false)
    .order("due_at", { ascending: true })
    .limit(5);

  if (!reminders || reminders.length === 0) {
    await sendButtons(ctx.phone, "📋 Bekleyen göreviniz yok.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  let text = "📋 *Görevleriniz*\n\n";
  for (const r of reminders) {
    const date = new Date(r.due_at).toLocaleDateString("tr-TR");
    text += `⏰ *${r.topic || "Görev"}*\n   ${r.message || "-"}\n   📅 ${date}\n\n`;
  }

  await sendButtons(ctx.phone, text, [
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}
