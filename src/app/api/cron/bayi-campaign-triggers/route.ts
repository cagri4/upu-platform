/**
 * GET /api/cron/bayi-campaign-triggers — saatlik trigger evaluator.
 *
 * Tüm bayi tenant'larında is_active=true trigger'ları çalıştırır.
 * Schedule: her saat başı (Vercel cron 0 * * * *).
 * Auth: CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { runTrigger, type CampaignTrigger } from "@/platform/bayi-campaigns/rule-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  const { data: triggers } = await sb
    .from("bayi_campaign_triggers")
    .select("*")
    .eq("is_active", true);

  if (!triggers || triggers.length === 0) {
    return NextResponse.json({ ok: true, triggers_processed: 0 });
  }

  let totalSent = 0, totalSkipped = 0, totalFailed = 0;
  const reports: Array<{ name: string; matched: number; sent: number }> = [];

  for (const t of triggers as CampaignTrigger[]) {
    try {
      const r = await runTrigger(sb, t);
      totalSent += r.sent;
      totalSkipped += r.skipped;
      totalFailed += r.failed;
      reports.push({ name: t.name, matched: r.matched, sent: r.sent });
    } catch (err) {
      console.error(`[cron:bayi-campaign-triggers] ${t.name}`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    triggers_processed: triggers.length,
    sent: totalSent,
    skipped: totalSkipped,
    failed: totalFailed,
    reports,
  });
}
