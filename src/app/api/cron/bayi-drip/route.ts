/**
 * GET /api/cron/bayi-drip — saatlik drip campaign tick.
 * Schedule: her saat :15 (Vercel cron).
 * Auth: CRON_SECRET Bearer.
 *
 * 1. autoEnrollActiveCampaigns — auto-enroll modlu kampanyalar için segment refresh
 * 2. processDueSends — next_send_at <= now olan enrollment'ları işle
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { processDueSends, autoEnrollActiveCampaigns } from "@/platform/bayi-marketing/drip-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  const startedAt = Date.now();

  const enrolledCount = await autoEnrollActiveCampaigns(sb).catch(err => {
    console.error("[cron:bayi-drip] auto-enroll", err);
    return 0;
  });

  const stats = await processDueSends(sb).catch(err => {
    console.error("[cron:bayi-drip] process due", err);
    return { campaigns_evaluated: 0, sends_attempted: 0, sends_ok: 0, sends_failed: 0, completed: 0 };
  });

  return NextResponse.json({
    ok: true,
    auto_enrolled: enrolledCount,
    ...stats,
    duration_ms: Date.now() - startedAt,
  });
}
