/**
 * GET /api/cron/bayi-referral-award — günlük referans tahakkuk cron.
 * Schedule: günlük 02:30 (Vercel cron).
 * Auth: CRON_SECRET Bearer.
 *
 * accepted referral'larda referred_dealer'ın ilk siparişi varsa earned'a
 * geçirir ve referrer'a credit award eder. Idempotent (status='accepted'
 * race guard).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { awardEligibleReferrals } from "@/platform/bayi-referral/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  const stats = await awardEligibleReferrals(sb);

  return NextResponse.json({ ok: true, ...stats });
}
