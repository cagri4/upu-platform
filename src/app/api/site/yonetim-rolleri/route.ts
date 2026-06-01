/**
 * /api/site/yonetim-rolleri — siteyonetim rol atama endpoint'i (Sprint 1).
 *
 * GET  → Aktif sakinler + her birinin profiles.role'unu döner.
 *        Yönetici binasındaki kişiler. sy_user_residents bridge JOIN +
 *        profiles JOIN (auth_user_id → profile role).
 *
 * POST → role update. Sadece yönetici (mevcut requireAuth profil)
 *        rol değiştirebilir. Yeni roller: sakin, yonetici, denetci,
 *        muhasebeci_site.
 *
 * Yetkilendirme:
 *   - GET/POST sadece yönetici (sy_buildings.manager_id = caller).
 *   - Service client kullanılır (RLS bypass) — yetki kontrolü kodda.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["sakin", "yonetici", "denetci", "muhasebeci_site"] as const;
type SiteRole = (typeof ALLOWED_ROLES)[number];

interface BridgeRow {
  user_id: string;
  resident_id: string;
  sy_residents: {
    id: string;
    full_name: string | null;
    phone: string | null;
    is_active: boolean | null;
    sy_units: { unit_number: string | null } | null;
  } | null;
}

interface ProfileRow {
  id: string;
  auth_user_id: string;
  role: string | null;
  display_name: string | null;
}

async function resolveAdminBuilding(req: NextRequest): Promise<
  | { error: string; status: number }
  | { userId: string; tenantId: string; buildingId: string; buildingName: string }
> {
  const auth = await requireAuth(req);
  if ("error" in auth) return { error: "Oturum bulunamadı.", status: 401 };

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id",
  });
  if ("error" in lookup) return { error: lookup.error, status: lookup.status };

  const { data: building } = await sb
    .from("sy_buildings")
    .select("id, name")
    .eq("manager_id", lookup.profile.id)
    .eq("tenant_id", lookup.tenantId)
    .limit(1)
    .maybeSingle();

  if (!building?.id) {
    return { error: "Yönettiğiniz bir bina bulunamadı.", status: 403 };
  }

  return { userId: lookup.profile.id, tenantId: lookup.tenantId, buildingId: building.id, buildingName: building.name || "Apartman" };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const sb = getServiceClient();

  // 1) Binadaki sy_user_residents (bağlı kullanıcı) ile sakin info
  const { data: bridgeRows, error: bErr } = await sb
    .from("sy_user_residents")
    .select("user_id, resident_id, sy_residents(id, full_name, phone, is_active, sy_units(unit_number))")
    .eq("building_id", ctx.buildingId);

  if (bErr) {
    console.error("[site/yonetim-rolleri GET] bridge error:", bErr);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  const bridges = (bridgeRows || []) as unknown as BridgeRow[];
  const userIds = bridges.map((r) => r.user_id).filter(Boolean);

  // 2) Bu user_id'lerin profile.role'larını getir (siteyonetim tenant'a scoped)
  let profilesMap = new Map<string, { profileId: string; role: string; displayName: string | null }>();
  if (userIds.length > 0) {
    const orClauses = userIds.flatMap((uid) => [`id.eq.${uid}`, `auth_user_id.eq.${uid}`]).join(",");
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, auth_user_id, role, display_name")
      .or(orClauses)
      .eq("tenant_id", ctx.tenantId);

    for (const p of (profiles || []) as ProfileRow[]) {
      const key = p.auth_user_id || p.id;
      profilesMap.set(key, {
        profileId: p.id,
        role: p.role || "sakin",
        displayName: p.display_name,
      });
    }
  }

  const rows = bridges.map((b) => {
    const sakin = b.sy_residents;
    const profile = profilesMap.get(b.user_id);
    return {
      user_id: b.user_id,
      profile_id: profile?.profileId || null,
      full_name: sakin?.full_name || profile?.displayName || "İsimsiz",
      phone: sakin?.phone || null,
      unit_number: sakin?.sy_units?.unit_number || "—",
      is_active: sakin?.is_active !== false,
      role: profile?.role || "sakin",
    };
  });

  // Daire numarasına natural sort
  rows.sort((a, b) => {
    const am = a.unit_number.match(/^(\d+)(.*)$/);
    const bm = b.unit_number.match(/^(\d+)(.*)$/);
    if (am && bm) {
      const n = parseInt(am[1], 10) - parseInt(bm[1], 10);
      if (n !== 0) return n;
      return am[2].localeCompare(bm[2]);
    }
    return a.unit_number.localeCompare(b.unit_number);
  });

  return NextResponse.json({
    success: true,
    building: { id: ctx.buildingId, name: ctx.buildingName },
    members: rows,
    allowed_roles: ALLOWED_ROLES,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let body: { profile_id?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  if (!body.profile_id || !body.role) {
    return NextResponse.json({ error: "profile_id ve role gerekli." }, { status: 400 });
  }

  if (!ALLOWED_ROLES.includes(body.role as SiteRole)) {
    return NextResponse.json(
      { error: `Geçersiz rol. İzin verilen: ${ALLOWED_ROLES.join(", ")}` },
      { status: 400 },
    );
  }

  const sb = getServiceClient();

  // Hedef profile'ın bu binaya bağlı olduğunu doğrula
  const { data: target } = await sb
    .from("profiles")
    .select("id, auth_user_id, role")
    .eq("id", body.profile_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
  }

  // sy_user_residents üzerinden bu binaya bağlı mı kontrol
  const bridgeUid = target.auth_user_id || target.id;
  const { data: bridge } = await sb
    .from("sy_user_residents")
    .select("id")
    .eq("user_id", bridgeUid)
    .eq("building_id", ctx.buildingId)
    .limit(1)
    .maybeSingle();

  if (!bridge) {
    return NextResponse.json({ error: "Bu kullanıcı binanıza bağlı değil." }, { status: 403 });
  }

  // Yönetici kendi rolünü yonetici dışına alamaz (kendini kilitleme)
  if (target.id === ctx.userId && body.role !== "yonetici") {
    return NextResponse.json(
      { error: "Kendi rolünüzü yöneticiden başka bir role değiştiremezsiniz." },
      { status: 400 },
    );
  }

  const { error: updErr } = await sb
    .from("profiles")
    .update({ role: body.role, updated_at: new Date().toISOString() })
    .eq("id", body.profile_id);

  if (updErr) {
    console.error("[site/yonetim-rolleri POST] update error:", updErr);
    return NextResponse.json({ error: "Rol güncellenemedi." }, { status: 500 });
  }

  return NextResponse.json({ success: true, profile_id: body.profile_id, role: body.role });
}
