/**
 * GET /api/bayi-urun-ekle/init — validate token. The form is dead simple
 * (ad / kategori / birim / fiyat / stok / fotolar) so init only confirms
 * the link works and returns existing categories so the dropdown can
 * suggest what the owner already uses.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; capabilities: string[] | null;
    role: string | null; invited_by: string | null;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, capabilities, role, invited_by",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;

  const caps = (profile.capabilities as string[] | null) || [];
  const canEdit = caps.includes("*") || caps.includes("products:edit");
  if (!canEdit) return NextResponse.json({ error: "Ürün ekleme yetkiniz yok." }, { status: 403 });

  const ownerId = profile.invited_by || profile.id;

  const { data: existing } = await supabase
    .from("bayi_products")
    .select("category")
    .eq("user_id", ownerId)
    .not("category", "is", null)
    .limit(50);
  const categories = Array.from(new Set((existing || []).map((p) => p.category).filter(Boolean))) as string[];

  return NextResponse.json({ success: true, categories });
}
