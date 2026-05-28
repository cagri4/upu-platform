/**
 * POST /api/site/profile/save
 *
 * Body: { token?, display_name, email, role_title, building_name, building_address }
 *
 * Update'ler:
 *   - profiles: display_name, email, metadata.site_manager_profile.role_title
 *   - sy_buildings (manager_id == user.id): name, address
 *
 * Defense-in-depth: subdomain siteyonetim değilse 403.
 * whatsapp_phone read-only (auth tabanı; profil-değiştir akışında ayrı).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

interface SiteManagerProfile {
  role_title?: string;
}

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenantKey = getTenantByDomain(host)?.key || null;
  if (tenantKey !== "siteyonetim") {
    return NextResponse.json(
      { error: `Bu endpoint yalnız siteyönetim SaaS'ında aktif (tenant: ${tenantKey || "unknown"}).` },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const auth = await resolvePanelAuthFromBody(req, body);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const displayName = String(body.display_name || "").trim();
  if (displayName.length < 2) {
    return NextResponse.json({ error: "Ad soyad gerekli (en az 2 karakter)." }, { status: 400 });
  }
  const email = body.email ? String(body.email).trim() : "";
  const roleTitle = body.role_title ? String(body.role_title).trim().slice(0, 80) : "";
  const buildingName = body.building_name ? String(body.building_name).trim().slice(0, 120) : "";
  const buildingAddress = body.building_address ? String(body.building_address).trim().slice(0, 240) : "";

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    metadata: Record<string, unknown> | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id, metadata",
  });
  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const meta = (lookup.profile.metadata as Record<string, unknown>) || {};
  const existingMgr = (meta.site_manager_profile as SiteManagerProfile) || {};
  const newMgr: SiteManagerProfile = {
    ...existingMgr,
    role_title: roleTitle || existingMgr.role_title,
  };
  const newMeta = { ...meta, site_manager_profile: newMgr };

  const profileUpdate: Record<string, unknown> = {
    display_name: displayName,
    metadata: newMeta,
  };
  if (email) profileUpdate.email = email;

  const { error: profErr } = await sb
    .from("profiles")
    .update(profileUpdate)
    .eq("id", lookup.profile.id);
  if (profErr) {
    return NextResponse.json({ error: `Profil güncellenemedi: ${profErr.message}` }, { status: 500 });
  }

  // Yönettiği bina varsa name/address update. Yoksa skip (yeni bina create
  // burada değil, /binakodu komut akışı ile yapılır).
  if (buildingName || buildingAddress) {
    const { data: building } = await sb
      .from("sy_buildings")
      .select("id")
      .eq("manager_id", lookup.profile.id)
      .eq("tenant_id", lookup.tenantId)
      .limit(1)
      .maybeSingle();
    if (building?.id) {
      const buildingUpdate: Record<string, unknown> = {};
      if (buildingName) buildingUpdate.name = buildingName;
      if (buildingAddress) buildingUpdate.address = buildingAddress;
      const { error: bErr } = await sb
        .from("sy_buildings")
        .update(buildingUpdate)
        .eq("id", building.id);
      if (bErr) {
        return NextResponse.json({ error: `Bina güncellenemedi: ${bErr.message}` }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}
