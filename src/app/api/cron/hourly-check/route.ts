import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  let triggered = 0;

  try {
    // Get due reminders
    const { data: reminders } = await supabase
      .from("reminders")
      .select("id, user_id, topic, note")
      .eq("triggered", false)
      .lte("remind_at", new Date().toISOString())
      .limit(100);

    if (!reminders?.length) {
      return NextResponse.json({ ok: true, triggered: 0 });
    }

    // Get user phones in bulk
    const userIds = [...new Set(reminders.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, whatsapp_phone")
      .in("id", userIds)
      .not("whatsapp_phone", "is", null);

    const phoneMap = new Map((profiles || []).map((p) => [p.id, p.whatsapp_phone]));

    for (const reminder of reminders) {
      const phone = phoneMap.get(reminder.user_id);
      if (!phone) continue;

      try {
        const message =
          `\u23F0 Hatirlatma: ${reminder.topic || ""}` +
          (reminder.note ? `\n\n${reminder.note}` : "");

        await sendText(phone, message);

        // Mark as triggered
        await supabase
          .from("reminders")
          .update({ triggered: true })
          .eq("id", reminder.id);

        triggered++;
      } catch (err) {
        console.error(`[cron:hourly-check] Error for reminder ${reminder.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[cron:hourly-check] Fatal error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, triggered });
}
