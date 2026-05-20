/**
 * POST /api/agent/clear — Konuşma sıfırla. agent_conversations kullanıcı
 * satırlarını siler. agent_profiles korunur (last_active update'i sürer).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

const SUPPORTED_TENANTS = new Set(["bayi", "emlak"]);

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenantKey = getTenantByDomain(host)?.key || null;
  if (!tenantKey || !SUPPORTED_TENANTS.has(tenantKey)) {
    return NextResponse.json(
      { error: `UPU agent bu domain'de aktif değil (tenant: ${tenantKey || "unknown"}).` },
      { status: 403 },
    );
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey,
    select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  // Defense-in-depth: delete'i user_id + tenant_id'ye scope'la (RLS yoksa
  // bile cross-tenant temizleme imkânsız). lookup zaten tenant'a göre profile
  // resolve etti — buradaki tenant_id eq ek katman.
  const { error } = await sb
    .from("agent_conversations")
    .delete()
    .eq("user_id", lookup.profile.id)
    .eq("tenant_id", lookup.tenantId);
  if (error) return NextResponse.json({ error: "Silinemedi." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
