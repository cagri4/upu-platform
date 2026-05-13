/**
 * POST /api/profile/kvkk-accept
 *
 * Kullanıcı KvkkConsentModal'da "Okudum, onaylıyorum" diyince çağrılır.
 * profiles.kvkk_consent_at = now() + kvkk_consent_version = "v1" set edilir.
 * Mevcut metadata alanları (agent_profile, quick_actions vb.) etkilenmez.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

const CURRENT_KVKK_VERSION = "v1";

export async function POST(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getServiceClient();
  const { error } = await admin
    .from("profiles")
    .update({
      kvkk_consent_at: new Date().toISOString(),
      kvkk_consent_version: CURRENT_KVKK_VERSION,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, version: CURRENT_KVKK_VERSION });
}
