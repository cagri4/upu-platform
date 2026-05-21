import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!["admin", "user"].includes(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Admin yetkisi gerekli." }, { status: 403 });
  }

  const id = String(body.id || "").trim();
  const active = body.is_active === true;
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const { error } = await sb.from("bayi_campaign_triggers")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", lookup.tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
