/**
 * /api/site/personel — Modül 5: Personel CRUD (Sprint 2).
 *
 * GET    → Yönetici binasındaki aktif + pasif personel listesi
 * POST   → Yeni personel ekle (yönetici only)
 * PATCH  → Mevcut personel güncelle (id body'de)
 * DELETE → Soft-delete (is_active=false). Hard-delete YOK.
 *
 * Auth: requireAuth (cookie/token) + siteyonetim tenant profile +
 *       manager_id == auth caller (yönetici-only).
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
  return { sb, userId: lookup.profile.id, tenantId: lookup.tenantId, buildingId: building.id, buildingName: building.name || "Apartman" } as const;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await ctx.sb
    .from("sy_personnel")
    .select("id, full_name, role, phone, monthly_salary_kurus, sgk_no, start_date, contract_end, is_active, contract_pdf_url, notes, created_at")
    .eq("building_id", ctx.buildingId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[site/personel GET] error:", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    building: { id: ctx.buildingId, name: ctx.buildingName },
    personnel: data || [],
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const full_name = String(body.full_name || "").trim();
  const role = String(body.role || "").trim();
  if (!full_name || !role) {
    return NextResponse.json({ error: "Ad-soyad ve görev zorunlu." }, { status: 400 });
  }

  const insertPayload = {
    tenant_id: ctx.tenantId,
    building_id: ctx.buildingId,
    full_name,
    role,
    phone: body.phone ? String(body.phone) : null,
    monthly_salary_kurus: typeof body.monthly_salary_kurus === "number"
      ? body.monthly_salary_kurus
      : null,
    sgk_no: body.sgk_no ? String(body.sgk_no) : null,
    start_date: body.start_date ? String(body.start_date) : null,
    contract_end: body.contract_end ? String(body.contract_end) : null,
    contract_pdf_url: body.contract_pdf_url ? String(body.contract_pdf_url) : null,
    notes: body.notes ? String(body.notes) : null,
    is_active: body.is_active !== false,
  };

  const { data, error } = await ctx.sb
    .from("sy_personnel")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    console.error("[site/personel POST] error:", error);
    return NextResponse.json({ error: "Eklenemedi: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  // Bu personel bu binaya mı ait?
  const { data: own } = await ctx.sb
    .from("sy_personnel")
    .select("id")
    .eq("id", id)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();
  if (!own) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });

  const allowed = [
    "full_name", "role", "phone", "monthly_salary_kurus", "sgk_no",
    "start_date", "contract_end", "contract_pdf_url", "notes", "is_active",
  ];
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in body) updatePayload[k] = body[k];
  }

  const { error } = await ctx.sb
    .from("sy_personnel")
    .update(updatePayload)
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) {
    console.error("[site/personel PATCH] error:", error);
    return NextResponse.json({ error: "Güncellenemedi: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  // Soft-delete: is_active=false
  const { error } = await ctx.sb
    .from("sy_personnel")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) {
    console.error("[site/personel DELETE] error:", error);
    return NextResponse.json({ error: "Pasifleştirilemedi." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
