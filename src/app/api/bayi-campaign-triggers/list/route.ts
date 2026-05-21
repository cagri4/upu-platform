/**
 * GET /api/bayi-campaign-triggers/list — admin için tüm trigger'lar + son
 * çalıştırma istatistikleri.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ADMIN = new Set(["admin", "user", "satis"]);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ADMIN.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Yetki yok." }, { status: 403 });
  }
  const tenantId = lookup.tenantId;

  const [triggersRes, execStatsRes] = await Promise.all([
    sb.from("bayi_campaign_triggers")
      .select("id, name, description, event_type, conditions, action_type, action_payload, cooldown_days, is_active, last_run_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    sb.from("bayi_campaign_executions")
      .select("trigger_id, status")
      .eq("tenant_id", tenantId),
  ]);

  // Group execution stats per trigger
  const stats = new Map<string, { sent: number; skipped: number; failed: number }>();
  for (const e of execStatsRes.data || []) {
    if (!stats.has(e.trigger_id)) stats.set(e.trigger_id, { sent: 0, skipped: 0, failed: 0 });
    const st = stats.get(e.trigger_id)!;
    if (e.status === "sent") st.sent++;
    else if (e.status === "skipped") st.skipped++;
    else if (e.status === "failed") st.failed++;
  }

  return NextResponse.json({
    success: true,
    triggers: (triggersRes.data || []).map(t => ({
      ...t,
      stats: stats.get(t.id) || { sent: 0, skipped: 0, failed: 0 },
    })),
  });
}
