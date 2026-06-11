/**
 * GET /api/cron/bayi-recommendations — günlük cross-sell pair recompute.
 *
 * Tüm bayi tenant'ları için item-item co-occurrence yeniden hesaplar.
 * Schedule: her gün 04:00 UTC.
 * Auth: CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { computeCrossSellPairs } from "@/platform/bayi-recommendations/cross-sell";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  const { data: tenants } = await sb
    .from("tenants")
    .select("id, name")
    .eq("saas_type", "bayi");
  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ ok: true, tenants_processed: 0 });
  }

  let totalPairs = 0;
  const errors: string[] = [];
  for (const t of tenants) {
    try {
      const r = await computeCrossSellPairs(sb, t.id);
      totalPairs += r.pairs;
      if (r.errors.length > 0) errors.push(`${t.name}: ${r.errors.join(", ")}`);
    } catch (err) {
      errors.push(`${t.name}: ${(err as Error).message}`);
    }
  }
  return NextResponse.json({
    ok: true,
    tenants_processed: tenants.length,
    pairs_upserted: totalPairs,
    errors: errors.length > 0 ? errors : undefined,
  });
}
