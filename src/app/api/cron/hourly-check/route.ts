import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendNotification } from "@/platform/notifications/send-notification";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  let triggered = 0;
  let skipped = 0;

  try {
    // Get due reminders
    const { data: reminders } = await supabase
      .from("reminders")
      .select("id, user_id, topic, note")
      .eq("triggered", false)
      .lte("remind_at", new Date().toISOString())
      .limit(100);

    if (!reminders?.length) {
      return NextResponse.json({ ok: true, triggered: 0, skipped: 0 });
    }

    for (const reminder of reminders) {
      try {
        const topic = (reminder.topic as string) || "Hat\u0131rlatma";
        const note = (reminder.note as string) || "";

        // sendNotification handles shouldNotify + DB log + WA interactive
        const result = await sendNotification({
          userId: reminder.user_id as string,
          type: "hatirlatma_manuel",
          title: `\u23F0 ${topic}`,
          body: note || `Manuel olarak kurdu\u011Funuz hat\u0131rlatma zaman\u0131 geldi: ${topic}`,
          payload: { click_target: "/tr/takvim" },
        });

        // Yine de "triggered" i\u015Faretle \u2014 tercih kapal\u0131ysa bile ayn\u0131 reminder
        // tekrar tekrar firing etmesin (DB'ye log yaz\u0131ld\u0131 veya ge\u00E7ildi).
        await supabase
          .from("reminders")
          .update({ triggered: true })
          .eq("id", reminder.id);

        if (result.notification_id) triggered++;
        else skipped++;
      } catch (err) {
        console.error(`[cron:hourly-check] Error for reminder ${reminder.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[cron:hourly-check] Fatal error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, triggered, skipped });
}
