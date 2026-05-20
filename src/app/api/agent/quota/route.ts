/**
 * GET /api/agent/quota
 *
 * UI'a quota durumu döner. UpuAgentWidget hem mount'ta hem her mesajdan
 * sonra çağırır — rozet/uyarı bar/limit modal state'i bu endpoint'ten.
 *
 * Response:
 * {
 *   ok: true,
 *   used: 210, limit: 300, remaining: 90, percent: 70,
 *   period_end: "2026-06-12", days_until_reset: 3,
 *   plan: "starter", plan_display: "Başlangıç",
 *   status: "warning"   // 'ok' < %70, 'warning' 70-89, 'critical' 90-99, 'exceeded' 100+
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { getOrCreateQuota } from "@/platform/agent/quota";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenantCfg = getTenantByDomain(host);
  const tenantKey = tenantCfg?.key;
  if (!tenantKey) {
    return NextResponse.json({ error: "Tenant resolve edilemedi." }, { status: 400 });
  }

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string }>(sb, {
    userId: auth.userId,
    tenantKey,
    select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  try {
    const quota = await getOrCreateQuota(sb, lookup.profile.id, lookup.tenantId);
    return NextResponse.json({
      ok: true,
      used: quota.row.used_messages,
      limit: quota.limit,
      remaining: quota.remaining,
      percent: quota.percent,
      period_end: quota.row.period_end,
      days_until_reset: quota.days_until_reset,
      plan: quota.row.plan_key,
      plan_display: quota.plan_display,
      status: quota.status,
    });
  } catch (err) {
    console.error("[agent/quota] err", err);
    return NextResponse.json({ error: "Quota okunamadı." }, { status: 500 });
  }
}
