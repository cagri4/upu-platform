/**
 * /api/site/sakinler — siteyönetim aktif sakin listesi.
 *
 * Token/cookie auth → yönettiği binadan sy_residents satırlarını döner.
 * Daire bilgisi sy_units.unit_number ile join edilir.
 *
 * Sıralama: unit_number asc (1A, 1B, 2A, ...).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";


interface ResidentRow {
  id: string;
  name: string | null;
  phone: string | null;
  is_active: boolean | null;
  created_at: string | null;
  sy_units: { unit_number: string | null } | null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: building } = await sb
    .from("sy_buildings")
    .select("id, name")
    .eq("manager_id", lookup.profile.id)
    .eq("tenant_id", lookup.tenantId)
    .limit(1)
    .maybeSingle();

  if (!building?.id) {
    return NextResponse.json({ success: true, building: null, residents: [] });
  }

  const { data, error } = await sb
    .from("sy_residents")
    .select("id, name, phone, is_active, created_at, sy_units(unit_number)")
    .eq("building_id", building.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[site/sakinler GET] error:", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  const rows = (data || []) as unknown as ResidentRow[];
  const residents = rows.map((r) => ({
    id: r.id,
    name: r.name || "İsimsiz sakin",
    phone: r.phone,
    is_active: r.is_active !== false,
    unit_number: r.sy_units?.unit_number || "—",
  }));

  // Daire numarasına göre sırala (1A, 1B, ..., 10A)
  residents.sort((a, b) => {
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
    building: { id: building.id, name: building.name || "Apartman" },
    residents,
  });
}
