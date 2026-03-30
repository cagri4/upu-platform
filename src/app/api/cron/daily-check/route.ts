import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getDailyCheckFn, getTenantKey } from "@/platform/cron/briefing-registry";
import "@/platform/cron/tenant-briefings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  let totalAlerts = 0;

  try {
    const { data: users } = await supabase
      .from("profiles")
      .select("id, whatsapp_phone, tenant_id")
      .not("whatsapp_phone", "is", null)
      .eq("metadata->>briefing_enabled", "true");

    if (!users?.length) return NextResponse.json({ ok: true, alerts: 0 });

    for (const user of users) {
      try {
        const tenantKey = await getTenantKey(user.tenant_id);
        if (!tenantKey) continue;

        const checkFn = getDailyCheckFn(tenantKey);
        if (!checkFn) continue;

        const alerts = await checkFn(user.id, user.tenant_id, user.whatsapp_phone);
        totalAlerts += alerts;
      } catch (err) {
        console.error(`[cron:daily-check] Error for ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[cron:daily-check] Fatal:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alerts: totalAlerts });
}
