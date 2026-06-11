/**
 * GET /api/cron/bayi-scoring — haftalık bayi performans skor snapshot.
 *
 * Tüm bayi tenant'larındaki dealer'lar için score hesaplar + upsert.
 * Cron schedule (Vercel): Pazartesi 02:00 NL time.
 *
 * Auth: CRON_SECRET Bearer header.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { calculateScoresForTenant } from "@/platform/bayi-scoring/calculate";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();

  // Bayi tenant'larını bul
  const { data: tenants } = await sb
    .from("tenants")
    .select("id, name")
    .eq("saas_type", "bayi");

  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ ok: true, tenants_processed: 0 });
  }

  let totalInserted = 0;
  const errors: string[] = [];

  for (const t of tenants) {
    try {
      const r = await calculateScoresForTenant(sb, t.id);
      totalInserted += r.inserted;
      if (r.errors.length > 0) errors.push(`${t.name}: ${r.errors.join(", ")}`);
    } catch (err) {
      errors.push(`${t.name}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    tenants_processed: tenants.length,
    scores_upserted: totalInserted,
    errors: errors.length > 0 ? errors : undefined,
  });
}
