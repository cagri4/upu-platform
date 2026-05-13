/**
 * GET /api/profile/kvkk-status
 *
 * KvkkConsentModal panel mount'ta bu endpoint'i çağırır. Kullanıcı v1
 * sürümünü onaylamadıysa needsConsent=true → modal gösterilir.
 *
 * Legacy kullanıcılar (kvkk_consent_at NOT NULL ama version=legacy)
 * için de needsConsent true — v1'i onaylamaları istenir.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

const CURRENT_KVKK_VERSION = "v1";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getServiceClient();
  const { data } = await admin
    .from("profiles")
    .select("kvkk_consent_at, kvkk_consent_version")
    .eq("id", auth.userId)
    .single();

  const consentedAt = (data?.kvkk_consent_at as string | null) ?? null;
  const version = (data?.kvkk_consent_version as string | null) ?? null;
  const needsConsent = !consentedAt || version !== CURRENT_KVKK_VERSION;

  return NextResponse.json({
    needsConsent,
    consentedAt,
    version,
    currentVersion: CURRENT_KVKK_VERSION,
  });
}
