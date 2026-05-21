/**
 * GET /api/bayi-drip/list — admin için kampanya listesi + enrollment stats.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (lookup.profile.role !== "admin" && lookup.profile.role !== "satis") {
    return NextResponse.json({ error: "Yetki yok." }, { status: 403 });
  }

  const { data: campaigns } = await sb
    .from("bayi_drip_campaigns")
    .select("id, name, description, audience, channel, is_active, enrollment_mode, created_at, updated_at")
    .eq("tenant_id", lookup.tenantId)
    .order("created_at", { ascending: false });

  // Step counts + enrollment counts per campaign
  const campIds = (campaigns || []).map(c => c.id);
  const [stepsRes, enrolRes] = await Promise.all([
    campIds.length > 0
      ? sb.from("bayi_drip_steps").select("campaign_id").in("campaign_id", campIds)
      : Promise.resolve({ data: [] as Array<{ campaign_id: string }> }),
    campIds.length > 0
      ? sb.from("bayi_drip_enrollments").select("campaign_id, status").in("campaign_id", campIds)
      : Promise.resolve({ data: [] as Array<{ campaign_id: string; status: string }> }),
  ]);

  const stepCount = new Map<string, number>();
  for (const s of stepsRes.data || []) {
    stepCount.set(s.campaign_id, (stepCount.get(s.campaign_id) || 0) + 1);
  }

  type Stats = { active: number; completed: number; total: number };
  const enrolStats = new Map<string, Stats>();
  for (const e of enrolRes.data || []) {
    if (!enrolStats.has(e.campaign_id)) enrolStats.set(e.campaign_id, { active: 0, completed: 0, total: 0 });
    const s = enrolStats.get(e.campaign_id)!;
    s.total++;
    if (e.status === "active") s.active++;
    if (e.status === "completed") s.completed++;
  }

  return NextResponse.json({
    success: true,
    campaigns: (campaigns || []).map(c => ({
      ...c,
      step_count: stepCount.get(c.id) || 0,
      stats: enrolStats.get(c.id) || { active: 0, completed: 0, total: 0 },
    })),
  });
}
