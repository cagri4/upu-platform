/**
 * POST /api/bayi-referral/generate — bayi referral code oluşturur (yoksa).
 * Body: { token? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { generateCode } from "@/platform/bayi-referral/engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const result = await generateCode(sb, lookup.tenantId, lookup.profile.id, 100);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, code: result.code, id: result.id });
}
