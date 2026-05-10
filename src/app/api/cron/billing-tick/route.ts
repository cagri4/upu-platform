/**
 * /api/cron/billing-tick — günlük abonelik durumu bakım cron'u.
 *
 * 1. Trial bitenleri Free'ye düşür (plan='free', status='expired')
 * 2. Pro abonelik current_period_end < now ise past_due'ya çek
 *    (Mollie webhook recurring payment ile düzeltir; bu sadece backup)
 *
 * vercel.json içinde 03:00 UTC günlük tetiklenir.
 */
import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  const now = new Date().toISOString();

  // 1. Trial expiry → Free
  const { data: trialExpired, error: e1 } = await sb
    .from("subscriptions")
    .update({ plan: "free", status: "expired" })
    .eq("plan", "trial")
    .lt("trial_ends_at", now)
    .select("user_id");

  if (e1) console.error("[cron:billing-tick] trial expiry", e1);

  // 2. Pro period_end geçmişse past_due — Mollie webhook geç kalmışsa backup
  const { data: stalePro, error: e2 } = await sb
    .from("subscriptions")
    .update({ status: "past_due" })
    .in("plan", ["pro_monthly", "pro_yearly"])
    .eq("status", "active")
    .lt("current_period_end", now)
    .select("user_id");

  if (e2) console.error("[cron:billing-tick] pro past_due", e2);

  return NextResponse.json({
    ok: true,
    trial_expired: trialExpired?.length || 0,
    pro_past_due: stalePro?.length || 0,
  });
}
