/**
 * POST /api/bayi-panel/quick-actions/save
 *
 * Bayi kullanıcının Bayi Panel Ayarları > Hızlı İşlemler tercihini
 * kaydeder. profiles.metadata.bayi_quick_actions = string[] (sırayla).
 *
 * Multi-tenant aware: resolvePanelAuth + bayi tenant composite lookup.
 * Emlak quick_actions metadata key'inden ayrı tutulur — kullanıcının
 * birden fazla tenant'ta profili olabilir (Sprint Foundation v2).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { sanitizeBayiQuickActions } from "@/platform/quick-actions/bayi-keys";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostTenant = getTenantByDomain(host);
  if (hostTenant?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde kullanılır." }, { status: 400 });
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const actions = sanitizeBayiQuickActions(body?.actions);
  if (actions === null) {
    return NextResponse.json({ error: "Geçersiz işlem listesi." }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ metadata: Record<string, unknown> | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const meta = (lookup.profile.metadata as Record<string, unknown> | null) || {};
  const nextMeta = { ...meta, bayi_quick_actions: actions };

  const { error: writeErr } = await sb
    .from("profiles")
    .update({ metadata: nextMeta })
    .eq("id", lookup.profile.id);
  if (writeErr) {
    console.error("[bayi-panel/quick-actions/save]", writeErr);
    return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({ success: true, quickActions: actions });
}
