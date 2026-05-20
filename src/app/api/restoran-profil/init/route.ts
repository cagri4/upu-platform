/**
 * GET /api/restoran-profil/init?t=<token>
 *
 * Token doğrula, profile metadata + display_name dön. Form mevcut değerleri
 * önceden doldurmak için.
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
    display_name: string | null; metadata: Record<string, unknown> | null; tenant_id: string;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "restoran",
    select: "display_name, metadata, tenant_id",
  });
  const profile = "error" in lookup ? null : lookup.profile;

  return NextResponse.json({
    ok: true,
    profile: profile ? {
      display_name: profile.display_name,
      metadata: profile.metadata || {},
    } : null,
  });
}
