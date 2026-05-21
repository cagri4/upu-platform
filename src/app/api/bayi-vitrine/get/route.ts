/**
 * GET /api/bayi-vitrine/get — bayi kendi vitrinini getirir.
 * Yoksa boş şablon döner (henüz oluşturulmamış demektir).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; display_name: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, display_name",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: vitrine } = await sb
    .from("bayi_vitrines")
    .select("id, slug, title, subtitle, logo_url, accent_color, is_active, show_prices, visible_product_ids, theme, view_count, lead_count, conversion_count, created_at, updated_at")
    .eq("dealer_user_id", lookup.profile.id)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    vitrine: vitrine || null,
    suggested_slug: vitrine ? null : suggestSlug(lookup.profile.display_name || "bayi"),
  });
}

function suggestSlug(name: string): string {
  return name.toLowerCase()
    .replace(/[ğ]/g, "g").replace(/[ü]/g, "u").replace(/[ş]/g, "s")
    .replace(/[ı]/g, "i").replace(/[ö]/g, "o").replace(/[ç]/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}
