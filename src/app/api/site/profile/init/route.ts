/**
 * GET /api/site/profile/init?t=<token>
 *
 * Site yöneticisi profilini düzenleme için pre-populate verisi:
 *   - profiles: display_name, email, whatsapp_phone (read-only display)
 *   - profiles.metadata.site_manager_profile: role_title (örn. "Yönetim Kurulu Başkanı")
 *   - sy_buildings: name, address (yönettiği bina; manager_id == user.id)
 *
 * Defense-in-depth: subdomain `siteyonetim` değilse 403 — başka SaaS
 * panelinden bu endpoint'i tetiklemek izolasyonu bozar.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

interface SiteManagerProfile {
  role_title?: string;
}

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenantKey = getTenantByDomain(host)?.key || null;
  if (tenantKey !== "siteyonetim") {
    return NextResponse.json(
      { error: `Bu endpoint yalnız siteyönetim SaaS'ında aktif (tenant: ${tenantKey || "unknown"}).` },
      { status: 403 },
    );
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    display_name: string | null;
    email: string | null;
    whatsapp_phone: string | null;
    metadata: Record<string, unknown> | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id, display_name, email, whatsapp_phone, metadata",
  });
  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const meta = (lookup.profile.metadata as Record<string, unknown>) || {};
  const manager = (meta.site_manager_profile as SiteManagerProfile) || {};

  const { data: building } = await sb
    .from("sy_buildings")
    .select("id, name, address")
    .eq("manager_id", lookup.profile.id)
    .eq("tenant_id", lookup.tenantId)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    profile: {
      display_name: lookup.profile.display_name || "",
      email: lookup.profile.email || "",
      whatsapp_phone: lookup.profile.whatsapp_phone || "",
      role_title: manager.role_title || "",
    },
    building: {
      id: building?.id || null,
      name: building?.name || "",
      address: (building as { address?: string | null } | null)?.address || "",
    },
  });
}
