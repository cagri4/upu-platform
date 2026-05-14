/**
 * POST /api/admin/test-identities/create
 *
 * Body: { virtual_phone, display_name?, target_tenant?, notes? }
 *   - virtual_phone: 6-15 hanesi rakam, unique
 *   - target_tenant: emlak|bayi|market|otel|restoran|siteyonetim|muhasebe (opsiyonel hint)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";

export const dynamic = "force-dynamic";

const VALID_TENANTS = new Set([
  "emlak",
  "bayi",
  "market",
  "otel",
  "restoran",
  "siteyonetim",
  "muhasebe",
]);

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  let body: {
    virtual_phone?: string;
    display_name?: string;
    target_tenant?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const virtualPhone = (body.virtual_phone ?? "").trim();
  if (!/^[0-9]{6,15}$/.test(virtualPhone)) {
    return NextResponse.json(
      { error: "virtual_phone yalnızca rakam olmalı (6-15 hane)." },
      { status: 400 },
    );
  }

  const targetTenant = body.target_tenant?.trim() || null;
  if (targetTenant && !VALID_TENANTS.has(targetTenant)) {
    return NextResponse.json(
      { error: `Geçersiz target_tenant. İzinli: ${[...VALID_TENANTS].join(", ")}` },
      { status: 400 },
    );
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("admin_test_identities")
    .insert({
      admin_user_id: auth.userId,
      virtual_phone: virtualPhone,
      display_name: body.display_name?.trim() || null,
      target_tenant: targetTenant,
      notes: body.notes?.trim() || null,
    })
    .select("id, virtual_phone, display_name, target_tenant, notes, created_at")
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json(
        { error: "Bu virtual_phone zaten kayıtlı." },
        { status: 409 },
      );
    }
    console.error("[admin/test-identities/create]", error);
    return NextResponse.json({ error: "Kayıt oluşturulamadı." }, { status: 500 });
  }

  return NextResponse.json({ identity: data });
}
