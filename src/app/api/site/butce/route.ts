/**
 * /api/site/butce — Modül 2: Gider & Bütçe (Sprint 2).
 *
 * GET    ?year=YYYY → Plan vs gerçekleşen raporu
 *   - sy_budget_categories (planlanan)
 *   - sy_income_expenses (gerçekleşen, type='expense', period 'YYYY-MM')
 *   - kategori bazında JOIN + grup
 *   - %20+ sapma uyarısı
 *
 * POST   → Yeni kategori bütçesi ekle
 * PATCH  → Mevcut bütçe planını güncelle (id body'de)
 * DELETE → Bütçe satırı sil (hard delete — planlama bilgisi)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const SITEYONETIM_TENANT_ID = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";

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
    .eq("tenant_id", SITEYONETIM_TENANT_ID)
    .limit(1)
    .maybeSingle();

  if (!building?.id) {
    return { error: "Yönettiğiniz bir bina bulunamadı.", status: 403 } as const;
  }
  return { sb, userId: lookup.profile.id, buildingId: building.id, buildingName: building.name || "Apartman" } as const;
}

interface BudgetRow {
  id: string;
  category: string;
  year: number;
  yearly_planned_kurus: number;
  notes: string | null;
}

interface ExpenseRow {
  category: string;
  amount_kurus: number;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  // Bütçe kategorileri (planlanan)
  const { data: budgets, error: bErr } = await ctx.sb
    .from("sy_budget_categories")
    .select("id, category, year, yearly_planned_kurus, notes")
    .eq("building_id", ctx.buildingId)
    .eq("year", year);

  if (bErr) {
    console.error("[site/butce GET budget] error:", bErr);
    return NextResponse.json({ error: "Bütçe alınamadı." }, { status: 500 });
  }

  // Gerçekleşen giderler (sy_income_expenses period YYYY-MM, filter type=expense + year prefix)
  const periodPrefix = `${year}-`;
  const { data: expenses, error: eErr } = await ctx.sb
    .from("sy_income_expenses")
    .select("category, amount_kurus")
    .eq("building_id", ctx.buildingId)
    .eq("type", "expense")
    .like("period", `${periodPrefix}%`);

  if (eErr) {
    console.error("[site/butce GET expenses] error:", eErr);
    return NextResponse.json({ error: "Giderler alınamadı." }, { status: 500 });
  }

  // Kategori bazında topla
  const actualMap = new Map<string, number>();
  for (const e of (expenses || []) as ExpenseRow[]) {
    actualMap.set(e.category, (actualMap.get(e.category) || 0) + e.amount_kurus);
  }

  // Bütçe kategorileri + actual eşleştir
  const rows = ((budgets || []) as BudgetRow[]).map((b) => {
    const actual = actualMap.get(b.category) || 0;
    const planned = b.yearly_planned_kurus;
    const variance = planned > 0 ? ((actual - planned) / planned) * 100 : 0;
    const overrun = variance >= 20;  // %20+ sapma uyarısı
    return {
      id: b.id,
      category: b.category,
      year: b.year,
      planned_kurus: planned,
      actual_kurus: actual,
      remaining_kurus: planned - actual,
      variance_percent: Math.round(variance * 10) / 10,
      overrun,
      notes: b.notes,
    };
  });

  // Plansız harcama kategorileri (gerçekleşen var ama bütçe yok)
  const plannedCategories = new Set(rows.map((r) => r.category));
  const unplanned: Array<{ category: string; actual_kurus: number }> = [];
  for (const [cat, amount] of actualMap.entries()) {
    if (!plannedCategories.has(cat)) {
      unplanned.push({ category: cat, actual_kurus: amount });
    }
  }

  // Toplam
  const total_planned_kurus = rows.reduce((s, r) => s + r.planned_kurus, 0);
  const total_actual_kurus =
    rows.reduce((s, r) => s + r.actual_kurus, 0) +
    unplanned.reduce((s, u) => s + u.actual_kurus, 0);

  rows.sort((a, b) => a.category.localeCompare(b.category, "tr"));
  unplanned.sort((a, b) => a.category.localeCompare(b.category, "tr"));

  return NextResponse.json({
    success: true,
    building: { id: ctx.buildingId, name: ctx.buildingName },
    year,
    budgets: rows,
    unplanned,
    total: {
      planned_kurus: total_planned_kurus,
      actual_kurus: total_actual_kurus,
      remaining_kurus: total_planned_kurus - total_actual_kurus,
    },
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const category = String(body.category || "").trim();
  const year = typeof body.year === "number" ? body.year : new Date().getFullYear();
  const planned = typeof body.yearly_planned_kurus === "number" ? body.yearly_planned_kurus : 0;

  if (!category) {
    return NextResponse.json({ error: "Kategori zorunlu." }, { status: 400 });
  }
  if (planned < 0) {
    return NextResponse.json({ error: "Tutar negatif olamaz." }, { status: 400 });
  }

  // UNIQUE (building_id, category, year) constraint → upsert davranışı
  const { data: existing } = await ctx.sb
    .from("sy_budget_categories")
    .select("id")
    .eq("building_id", ctx.buildingId)
    .eq("category", category)
    .eq("year", year)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Bu yıl + kategori için zaten bütçe var. Düzenleyin." }, { status: 409 });
  }

  const { data, error } = await ctx.sb
    .from("sy_budget_categories")
    .insert({
      tenant_id: SITEYONETIM_TENANT_ID,
      building_id: ctx.buildingId,
      category,
      year,
      yearly_planned_kurus: planned,
      notes: body.notes ? String(body.notes) : null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[site/butce POST] error:", error);
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

  const { data: own } = await ctx.sb
    .from("sy_budget_categories")
    .select("id")
    .eq("id", id)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();
  if (!own) return NextResponse.json({ error: "Bütçe satırı bulunamadı." }, { status: 404 });

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("yearly_planned_kurus" in body && typeof body.yearly_planned_kurus === "number") {
    updatePayload.yearly_planned_kurus = body.yearly_planned_kurus;
  }
  if ("notes" in body) {
    updatePayload.notes = body.notes ? String(body.notes) : null;
  }

  const { error } = await ctx.sb
    .from("sy_budget_categories")
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
    .from("sy_budget_categories")
    .delete()
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  return NextResponse.json({ success: true });
}
