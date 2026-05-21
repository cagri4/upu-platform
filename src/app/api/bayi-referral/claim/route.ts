/**
 * POST /api/bayi-referral/claim — yeni bayi referral kodunu claim eder.
 * Body: { token?, code }
 * Çağrı zamanı: yeni bayi signup tamamlandıktan sonra (cookie session ile),
 * veya invite kabul sırasında.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { claimReferral } from "@/platform/bayi-referral/engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const code = String(body.code || "").trim();
  if (!code || code.length < 4) {
    return NextResponse.json({ error: "Geçerli kod gerekli." }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; display_name: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, display_name",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const result = await claimReferral(sb, code, lookup.profile.id, lookup.profile.display_name);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, referral_id: result.referral_id });
}
