import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendNotification } from "@/platform/notifications/send-notification";
import { getBriefingFn, getTenantKey } from "@/platform/cron/briefing-registry";
import { getTenantPanelUrl } from "@/platform/auth/qr";
import "@/platform/cron/tenant-briefings"; // registers all tenant briefings

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  let sent = 0;
  let skipped = 0;

  try {
    const { data: users } = await supabase
      .from("profiles")
      .select("id, whatsapp_phone, tenant_id")
      .not("whatsapp_phone", "is", null);

    if (!users?.length) return NextResponse.json({ ok: true, sent: 0, skipped: 0 });

    for (const user of users) {
      try {
        const tenantKey = await getTenantKey(user.tenant_id);
        if (!tenantKey) continue;

        const briefingFn = getBriefingFn(tenantKey);
        if (!briefingFn) continue;

        const message = await briefingFn(user.id, user.tenant_id);
        if (!message) continue;

        // Tenant-aware panel URL (emlak /tr/panel, bayi /tr/bayi-panel, vs.)
        const panelUrl = getTenantPanelUrl(tenantKey) || "https://estateai.upudev.nl/tr/panel";

        // Bayi WA pivot (2026-05-20): AI Eleman web'de yaşıyor — uzun
        // "Günlük Platform Raporu" yerine kısa text + paneli aç linki.
        // Detay panel'deki UPU asistanından alınır.
        let title = "🌅 Sabah Brifingi";
        let body = message;
        if (tenantKey === "bayi") {
          title = "🌅 Bugün ne var?";
          // İlk 200 karakter (manşet + kritik metrik), devamı panelde
          body = message.length > 200 ? `${message.slice(0, 197)}…` : message;
          body += "\n\nDetay için paneli aç — UPU asistanına sorabilirsin.";
        }

        // sendNotification handles shouldNotify (preference + DND) +
        // DB log + WA interactive button. Tercih kapalıysa skipped++.
        const result = await sendNotification({
          userId: user.id,
          type: "sabah_brif",
          title,
          body,
          payload: { click_target: panelUrl },
        });
        if (result.notification_id) sent++;
        else skipped++;
      } catch (err) {
        console.error(`[cron:morning-briefing] Error for ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[cron:morning-briefing] Fatal:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
