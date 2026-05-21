/**
 * POST /api/bayi-drip/toggle — kampanya aktif/pasif.
 * Body: { token?, id, is_active }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (lookup.profile.role !== "admin") {
    return NextResponse.json({ error: "Yalnız admin değiştirebilir." }, { status: 403 });
  }

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "ID gerekli." }, { status: 400 });

  const { error } = await sb
    .from("bayi_drip_campaigns")
    .update({ is_active: body.is_active === true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", lookup.tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true });
}
