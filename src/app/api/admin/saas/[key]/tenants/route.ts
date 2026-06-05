/**
 * GET /api/admin/saas/[key]/tenants
 *
 * Belirli bir SaaS kategorisindeki tüm müşteri tenant'larını döner.
 * Platform admin yetkisi gerektirir.
 *
 * Response: {
 *   category: { key, name, slug, icon, color, description, whatsappPhone },
 *   tenants: [{ id, name, slug, is_active, created_at, userCount, whatsapp_phone }]
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";
import { getTenantByKey } from "@/tenants/config";

export const dynamic = "force-dynamic";

interface RouteCtx { params: Promise<{ key: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  const { key } = await ctx.params;
  const cfg = getTenantByKey(key);
  if (!cfg) {
    return NextResponse.json({ error: "Bilinmeyen SaaS kategorisi." }, { status: 404 });
  }

  const sb = getServiceClient();
  const { data: tenants, error: tErr } = await sb
    .from("tenants")
    .select("id, name, slug, is_active, created_at, saas_type")
    .eq("saas_type", cfg.saasType)
    .order("created_at", { ascending: false });
  if (tErr) {
    console.error("[admin/saas/[key]/tenants]", tErr);
    return NextResponse.json({ error: "Tenant listesi alınamadı." }, { status: 500 });
  }

  const tenantIds = (tenants || []).map((t) => t.id as string);
  let userCounts: Record<string, number> = {};
  if (tenantIds.length > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("tenant_id")
      .in("tenant_id", tenantIds);
    for (const p of profiles || []) {
      const tid = p.tenant_id as string | null;
      if (tid) userCounts[tid] = (userCounts[tid] || 0) + 1;
    }
  }

  return NextResponse.json({
    category: {
      key: cfg.key,
      name: cfg.name,
      slug: cfg.slug,
      icon: cfg.icon,
      color: cfg.color,
      description: cfg.description,
      whatsappPhone: cfg.whatsappPhone,
    },
    tenants: (tenants || []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      slug: t.slug as string,
      is_active: t.is_active as boolean,
      created_at: t.created_at as string,
      userCount: userCounts[t.id as string] || 0,
    })),
  });
}
