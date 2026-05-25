/**
 * /api/site/talepler — siteyönetim arıza/şikayet (maintenance ticket) listesi.
 *
 * Token/cookie auth → yönettiği binadan sy_maintenance_tickets satırlarını
 * döner (sy_units join, opsiyonel — unit_id null olabilir, genel alan).
 * Filtre:
 *   - ?filter=acik (default) | tum | kapali
 *
 * Sıralama: priority desc (acil > normal > dusuk), created_at desc.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const SITEYONETIM_TENANT_ID = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";

interface TicketRow {
  id: string;
  category: string | null;
  priority: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
  sy_units: { unit_number: string | null } | null;
}

const PRIORITY_RANK: Record<string, number> = { acil: 3, normal: 2, dusuk: 1 };

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const filter = req.nextUrl.searchParams.get("filter") || "acik";

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
    .eq("tenant_id", SITEYONETIM_TENANT_ID)
    .limit(1)
    .maybeSingle();

  if (!building?.id) {
    return NextResponse.json({
      success: true,
      building: null,
      tickets: [],
      summary: { open: 0, urgent: 0, closed: 0 },
    });
  }

  let query = sb
    .from("sy_maintenance_tickets")
    .select("id, category, priority, description, status, created_at, sy_units(unit_number)")
    .eq("building_id", building.id);

  if (filter === "acik") query = query.eq("status", "acik");
  if (filter === "kapali") query = query.neq("status", "acik");

  const { data, error } = await query;
  if (error) {
    console.error("[site/talepler GET] error:", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  const rows = (data || []) as unknown as TicketRow[];

  // Özet — tüm filtreden bağımsız sayım için ayrı query
  const { data: allStatus } = await sb
    .from("sy_maintenance_tickets")
    .select("status, priority")
    .eq("building_id", building.id);

  let openCount = 0;
  let urgentCount = 0;
  let closedCount = 0;
  for (const s of (allStatus || []) as { status: string | null; priority: string | null }[]) {
    if (s.status === "acik") {
      openCount += 1;
      if (s.priority === "acil") urgentCount += 1;
    } else {
      closedCount += 1;
    }
  }

  const tickets = rows.map((r) => ({
    id: r.id,
    category: r.category || "diger",
    priority: r.priority || "normal",
    description: r.description || "(açıklama yok)",
    status: r.status || "acik",
    created_at: r.created_at,
    unit_number: r.sy_units?.unit_number || null,
  }));

  // priority desc, sonra created_at desc
  tickets.sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] || 0;
    const pb = PRIORITY_RANK[b.priority] || 0;
    if (pa !== pb) return pb - pa;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });

  return NextResponse.json({
    success: true,
    building: { id: building.id, name: building.name || "Apartman" },
    tickets,
    summary: { open: openCount, urgent: urgentCount, closed: closedCount },
  });
}
