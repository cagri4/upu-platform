/**
 * POST /api/auth/google/unlink
 *
 * Google bağlantısını profile'dan kaldırır. Hassas action — Faz 6.6 step-up
 * WA OTP zorunlu (`requireWaStepUp`). Cookie 10 dk içinde verify edilmemişse
 * 403 step_up_required döner; frontend StepUpModal akışını başlatır, cookie
 * kazanınca aynı endpoint tekrar denenir.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireWaStepUp } from "@/platform/auth/step-up";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Step-up gate — son 10 dk içinde WA OTP doğrulanmamışsa 403 dön
  const stepUp = await requireWaStepUp(req, auth.userId);
  if (!stepUp.ok) {
    return NextResponse.json({ error: stepUp.error }, { status: 403 });
  }

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
