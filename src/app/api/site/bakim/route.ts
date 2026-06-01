/**
 * /api/site/bakim — Modül 6: Bakım Planlama (Sprint 3).
 *
 * GET    → Bakım takvimi (status + due filter)
 * POST   → Yeni bakım planı ekle
 * PATCH  → Güncelle veya "done" işaretle (next_due_at otomatik shift)
 * DELETE → Sil
 *
 * Done işaretlenince:
 *   - last_done_at = now()
 *   - next_due_at = last_done_at + period_days
 *   - status = 'pending' (yeni döngü başlar)
 *
 * Cron /api/cron/* gelecekte overdue tespiti yapacak (V2).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";


async function resolveAdminBuilding(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return { error: "Oturum bulunamadı.", status: 401 } as const;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id",
  });
  if ("error" in lookup) return { error: lookup.error, status: lookup.status } as const;

  const { data: building } = await sb
    .from("sy_buildings")
    .select("id, name")
    .eq("manager_id", lookup.profile.id)
    .eq("tenant_id", lookup.tenantId)
    .limit(1)
    .maybeSingle();

  if (!building?.id) {
    return { error: "Yönettiğiniz bir bina bulunamadı.", status: 403 } as const;
  }
  return {
    sb,
    userId: lookup.profile.id,
    tenantId: lookup.tenantId,
    buildingId: building.id,
    buildingName: building.name || "Apartman",
  } as const;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  // Overdue otomatik tespit: next_due_at < now() + status='pending' → 'overdue'
  // V2'de cron yapacak; şimdilik query sırasında inline update.
  await ctx.sb
    .from("sy_maintenance_schedule")
    .update({ status: "overdue", updated_at: new Date().toISOString() })
    .eq("building_id", ctx.buildingId)
    .eq("status", "pending")
    .lt("next_due_at", new Date().toISOString());

  const { data, error } = await ctx.sb
    .from("sy_maintenance_schedule")
    .select("id, title, category, period_days, last_done_at, next_due_at, assigned_supplier_id, status, legal_basis, notes, created_at, sy_suppliers(company_name, sector)")
    .eq("building_id", ctx.buildingId)
    .order("next_due_at", { ascending: true });

  if (error) {
    console.error("[site/bakim GET] error:", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    building: { id: ctx.buildingId, name: ctx.buildingName },
    schedule: data || [],
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  const category = String(body.category || "").trim();
  const period_days = typeof body.period_days === "number" ? body.period_days : 0;
  const next_due_at = String(body.next_due_at || "");

  if (!title || !category || period_days <= 0 || !next_due_at) {
    return NextResponse.json({ error: "Başlık, kategori, period_days, next_due_at zorunlu." }, { status: 400 });
  }

  const { data, error } = await ctx.sb
    .from("sy_maintenance_schedule")
    .insert({
      tenant_id: ctx.tenantId,
      building_id: ctx.buildingId,
      title,
      category,
      period_days,
      next_due_at,
      assigned_supplier_id: body.assigned_supplier_id ? String(body.assigned_supplier_id) : null,
      legal_basis: body.legal_basis ? String(body.legal_basis) : null,
      notes: body.notes ? String(body.notes) : null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[site/bakim POST] error:", error);
    return NextResponse.json({ error: "Eklenemedi: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const { data: existing } = await ctx.sb
    .from("sy_maintenance_schedule")
    .select("id, period_days, next_due_at")
    .eq("id", id)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Bakım planı bulunamadı." }, { status: 404 });

  const markDone = body.mark_done === true;
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (markDone) {
    // Periyodik bakım tamamlama: last_done = now, next_due = last_done + period_days
    const now = new Date();
    const nextDue = new Date(now.getTime() + existing.period_days * 24 * 60 * 60 * 1000);
    updatePayload.last_done_at = now.toISOString();
    updatePayload.next_due_at = nextDue.toISOString();
    updatePayload.status = "pending";  // yeni döngü
  } else {
    for (const k of ["title", "category", "period_days", "next_due_at", "assigned_supplier_id", "status", "legal_basis", "notes"]) {
      if (k in body) updatePayload[k] = body[k];
    }
  }

  const { error } = await ctx.sb
    .from("sy_maintenance_schedule")
    .update(updatePayload)
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) return NextResponse.json({ error: "Güncellenemedi: " + error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const { error } = await ctx.sb
    .from("sy_maintenance_schedule")
    .delete()
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  return NextResponse.json({ success: true });
}
