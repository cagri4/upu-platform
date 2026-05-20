/**
 * GET /api/urunler/init — magic-link auth + ürün katalog sayfası context.
 * /[locale]/urunler mount'unda token doğrulaması; sahip profile + sektör
 * + tenant_id döndürür.
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
    id: string; tenant_id: string; capabilities: string[] | null; role: string | null;
    invited_by: string | null; display_name: string | null; metadata: Record<string, unknown> | null;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, capabilities, role, invited_by, display_name, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;

  const meta = (profile.metadata || {}) as Record<string, unknown>;
  const firmaProfili = (meta.firma_profili as { sektor?: string; ticari_unvan?: string } | undefined);

  // Mevcut kategori listesi (filter dropdown için)
  const { data: existing } = await supabase
    .from("bayi_products")
    .select("category")
    .eq("tenant_id", profile.tenant_id)
    .not("category", "is", null);
  const categories = Array.from(new Set((existing || []).map((p) => p.category).filter(Boolean))) as string[];

  return NextResponse.json({
    success: true,
    user: {
      id: profile.id,
      tenantId: profile.tenant_id,
      ownerId: profile.invited_by || profile.id,
      displayName: profile.display_name,
      capabilities: profile.capabilities || [],
      sektor: firmaProfili?.sektor || "boya",
      ticariUnvan: firmaProfili?.ticari_unvan || "",
    },
    categories: categories.sort(),
  });
}
