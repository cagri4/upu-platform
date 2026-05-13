/**
 * POST /api/auth/google/unlink
 *
 * Google bağlantısını profile'dan kaldırır. Cookie session zorunlu.
 *
 * TODO (Faz 6.6): Sensitive action — requireWaStepUp(req) çağrılacak
 * (son 10 dk içinde WA OTP doğrulamış olmak gerek). Şimdilik cookie yeter.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // TODO Faz 6.6: requireWaStepUp(req) — son 10 dk WA OTP zorunlu
  const admin = getServiceClient();
  const { error } = await admin
    .from("profiles")
    .update({
      google_sub: null,
      google_email: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
