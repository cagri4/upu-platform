/**
 * GET /api/profile/kvkk-status
 *
 * KvkkConsentModal panel mount'ta bu endpoint'i çağırır. Kullanıcı v1
 * sürümünü onaylamadıysa needsConsent=true → modal gösterilir.
 *
 * Multi-tenant aware: profile lookup `auth_user_id || id` + tenant_id ile
 * scoped (eski `eq("id", auth.userId)` yeni multi-tenant pattern'inde
 * 0 row dönüyordu, modal sürekli açılıyordu).
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

const CURRENT_KVKK_VERSION = "v1";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getServiceClient();
  const lookup = await resolveTenantProfile<{
    kvkk_consent_at: string | null;
    kvkk_consent_version: string | null;
  }>(admin, {
    userId: auth.userId,
    select: "id, kvkk_consent_at, kvkk_consent_version",
  });

  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const consentedAt = lookup.profile.kvkk_consent_at ?? null;
  const version = lookup.profile.kvkk_consent_version ?? null;
  const needsConsent = !consentedAt || version !== CURRENT_KVKK_VERSION;

  return NextResponse.json({
    needsConsent,
    consentedAt,
    version,
    currentVersion: CURRENT_KVKK_VERSION,
  });
}
