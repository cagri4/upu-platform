/**
 * GET /api/site-panel/profile?t=<token>
 *
 * Site yöneticisinin profil özeti — display_name + yönettiği bina snapshot.
 *
 * Cookie öncelik, token fallback (resolvePanelAuth). Pattern bayi-panel/profile
 * ile simetrik; bayi 'firma' field'ı yerine site 'building' field'ı.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    display_name: string | null;
    metadata: Record<string, unknown> | null;
    phone: string | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id, display_name, metadata, phone",
  });

  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const { data: building } = await sb
    .from("sy_buildings")
    .select("id, name, address")
    .eq("manager_id", lookup.profile.id)
    .eq("tenant_id", lookup.tenantId)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    displayName: lookup.profile.display_name || null,
    phone: lookup.profile.phone || null,
    building: {
      id:      building?.id ?? null,
      name:    building?.name ?? null,
      address: (building as { address?: string | null } | null)?.address ?? null,
    },
  });
}
