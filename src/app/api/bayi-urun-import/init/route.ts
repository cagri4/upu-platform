/**
 * GET /api/bayi-urun-import/init — magic-link tabanlı toplu ürün import
 * sayfasının token doğrulaması. Mevcut kategoriler + kayıtlı ürün sayısı
 * geri döner; sayfa şablonu indirme + dropdown önerisi için kullanır.
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
  if (!canEdit) return NextResponse.json({ error: "Toplu ürün yükleme yetkiniz yok." }, { status: 403 });

  const ownerId = profile.invited_by || profile.id;

  const { data: existing } = await supabase
    .from("bayi_products")
    .select("category")
    .eq("user_id", ownerId)
    .not("category", "is", null)
    .limit(100);
  const categories = Array.from(new Set((existing || []).map((p) => p.category).filter(Boolean))) as string[];

  const { count: productCount } = await supabase
    .from("bayi_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id);

  return NextResponse.json({
    success: true,
    categories,
    existingProductCount: productCount || 0,
  });
}
