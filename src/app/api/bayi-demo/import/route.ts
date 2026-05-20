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
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
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
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; role: string | null;
    metadata: Record<string, unknown> | null;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, role, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;
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
