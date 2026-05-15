/**
 * GET /api/auth/list-memberships
 *
 * Geçerli cookie session'a sahip user'in tüm tenant profile'larını döner.
 * Multi-tenant SaaS switcher (sidebar) tarafından kullanılır.
 *
 * Auth: cookie/token (resolvePanelAuth)
 * Strategy: ctx.userId profile.id olabilir (legacy 1-1) veya farklı UUID
 *   (multi-tenant). Her iki durumda da profiles.id = userId satırından
 *   auth_user_id'i çek, ardından auth_user_id ile tüm profile'ları join.
 *
 * Response:
 *   { memberships: [
 *       { tenantKey: "emlak", tenantName: "Emlak Ofisi", icon: "🏠" },
 *       { tenantKey: "bayi",  tenantName: "Bayi Yönetimi", icon: "📦" },
 *     ] }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getTenantByKey } from "@/tenants/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = getServiceClient();

  // userId → auth_user_id (legacy: aynı; multi-tenant: ayrı kolon)
  const { data: ownProfile } = await sb
    .from("profiles")
    .select("auth_user_id")
    .eq("id", auth.userId)
    .maybeSingle();

  const authUserId = ownProfile?.auth_user_id || auth.userId;

  type Row = { tenant_id: string; tenants: { saas_type: string; name: string } | null };
  const { data: rows } = await sb
    .from("profiles")
    .select("tenant_id, tenants(saas_type, name)")
    .eq("auth_user_id", authUserId)
    .returns<Row[]>();

  const memberships = (rows ?? [])
    .map((r) => {
      const t = r.tenants;
      if (!t) return null;
      const cfg = getTenantByKey(t.saas_type);
      return {
        tenantKey: t.saas_type,
        tenantName: cfg?.name || t.name,
        icon: cfg?.icon || "•",
      };
    })
    .filter((x): x is { tenantKey: string; tenantName: string; icon: string } => x !== null);

  return NextResponse.json({ memberships });
}
