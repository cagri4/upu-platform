/**
 * /api/site/tedarikciler — Modül 5: Tedarikçi CRUD (Sprint 2).
 *
 * GET    → Aktif + pasif tedarikçi listesi
 * POST   → Yeni tedarikçi ekle
 * PATCH  → Güncelle
 * DELETE → Soft-delete (is_active=false)
 *
 * sy_personnel endpoint paterni ile simetrik.
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
  return { sb, userId: lookup.profile.id, buildingId: building.id, buildingName: building.name || "Apartman" } as const;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await ctx.sb
    .from("sy_suppliers")
    .select("id, company_name, sector, contact_name, contact_phone, contact_email, service, monthly_fee_kurus, contract_start, contract_end, contract_pdf_url, is_active, notes, created_at")
    .eq("building_id", ctx.buildingId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[site/tedarikciler GET] error:", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    building: { id: ctx.buildingId, name: ctx.buildingName },
    suppliers: data || [],
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

  const company_name = String(body.company_name || "").trim();
  const sector = String(body.sector || "").trim();
  if (!company_name || !sector) {
    return NextResponse.json({ error: "Firma adı ve sektör zorunlu." }, { status: 400 });
  }

  const insertPayload = {
    tenant_id: lookup.tenantId,
    building_id: ctx.buildingId,
    company_name,
    sector,
    contact_name: body.contact_name ? String(body.contact_name) : null,
    contact_phone: body.contact_phone ? String(body.contact_phone) : null,
    contact_email: body.contact_email ? String(body.contact_email) : null,
    service: body.service ? String(body.service) : null,
    monthly_fee_kurus: typeof body.monthly_fee_kurus === "number" ? body.monthly_fee_kurus : null,
    contract_start: body.contract_start ? String(body.contract_start) : null,
    contract_end: body.contract_end ? String(body.contract_end) : null,
    contract_pdf_url: body.contract_pdf_url ? String(body.contract_pdf_url) : null,
    notes: body.notes ? String(body.notes) : null,
    is_active: body.is_active !== false,
  };

  const { data, error } = await ctx.sb
    .from("sy_suppliers")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    console.error("[site/tedarikciler POST] error:", error);
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

  const { data: own } = await ctx.sb
    .from("sy_suppliers")
    .select("id")
    .eq("id", id)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();
  if (!own) return NextResponse.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });

  const allowed = [
    "company_name", "sector", "contact_name", "contact_phone", "contact_email",
    "service", "monthly_fee_kurus", "contract_start", "contract_end",
    "contract_pdf_url", "notes", "is_active",
  ];
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in body) updatePayload[k] = body[k];
  }

  const { error } = await ctx.sb
    .from("sy_suppliers")
    .update(updatePayload)
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) {
    console.error("[site/tedarikciler PATCH] error:", error);
    return NextResponse.json({ error: "Güncellenemedi: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const { error } = await ctx.sb
    .from("sy_suppliers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) {
    console.error("[site/tedarikciler DELETE] error:", error);
    return NextResponse.json({ error: "Pasifleştirilemedi." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
