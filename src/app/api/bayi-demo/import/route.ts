/**
 * POST /api/bayi-demo/import — owner'ın tenant'ına sektör bazlı demo dataset yazar.
 *
 * Tek truth-source: src/tenants/bayi/demo-import/seed.ts → sectors/index.ts.
 * Sektör resolution sırası:
 *   1) body.sector (explicit override)
 *   2) profile.metadata.firma_profili.sektor
 *   3) "boya" default
 *
 * Production'da kullanılmaz: owner-only (admin/user role).
 * Mevcut veriyle birleşmez (tenant_id'de zaten ürün/bayi varsa skip).
 *
 * Body: { token, sector?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { seedTenantDemoData } from "@/tenants/bayi/demo-import/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { token?: string; sector?: string };
  try {
    body = await req.json() as { token?: string; sector?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = body.token;
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, metadata")
    .eq("id", magicToken.user_id)
    .maybeSingle();
  if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });
  if (profile.role !== "admin" && profile.role !== "user") {
    return NextResponse.json({ error: "Sadece firma sahibi demo veri içe aktarabilir." }, { status: 403 });
  }

  const meta = (profile.metadata || {}) as Record<string, unknown>;
  const firmaSektor = (meta.firma_profili as { sektor?: string } | undefined)?.sektor;
  const sector = body.sector || firmaSektor || "boya";

  const result = await seedTenantDemoData(supabase, profile.tenant_id, profile.id, sector);

  if (!result.ok) {
    if (result.skipped) {
      return NextResponse.json({ error: result.reason, existing: true }, { status: 409 });
    }
    return NextResponse.json({ error: result.reason || "Demo seed hatası" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    sector: result.sector,
    summary: result.summary,
  });
}
