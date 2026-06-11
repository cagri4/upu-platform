/**
 * GET /api/cron/recommendations — saatlik öneri motoru.
 * Tüm tenant adapter'larını çalıştırır (şu an: bayi).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { runAdapterForTenant } from "@/platform/recommendations/engine";
import { BAYI_RECOMMENDATIONS_ADAPTER } from "@/tenants/bayi/recommendations";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  // Expire eski open kayıtları
  await sb.from("recommendation_runs")
    .update({ status: "expired" })
    .eq("status", "open")
    .lt("expires_at", new Date().toISOString());

  let totalCreated = 0, totalSkipped = 0;
  const reports: Array<{ tenant_key: string; created: number; skipped: number }> = [];

  // Bayi adapter
  const { data: bayiTenants } = await sb.from("tenants").select("id").eq("saas_type", "bayi");
  for (const t of bayiTenants || []) {
    try {
      const r = await runAdapterForTenant(sb, BAYI_RECOMMENDATIONS_ADAPTER, t.id);
      totalCreated += r.created;
      totalSkipped += r.skipped;
      reports.push({ tenant_key: "bayi", created: r.created, skipped: r.skipped });
    } catch (err) {
      console.error("[cron:recommendations]", err);
    }
  }

  return NextResponse.json({ ok: true, created: totalCreated, skipped: totalSkipped, reports });
}
