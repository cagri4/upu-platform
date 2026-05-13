/**
 * GET /api/panel/google-link/status
 *
 * Panel Ayarları > Hesap Bağlantıları section'ı için kullanıcının Google
 * bağlama durumunu döndürür. Cookie session öncelikli (resolvePanelAuth).
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getServiceClient();
  const { data } = await admin
    .from("profiles")
    .select("google_email, google_sub, metadata")
    .eq("id", auth.userId)
    .single();

  const meta = (data?.metadata as Record<string, unknown> | null) || {};
  return NextResponse.json({
    linked: !!data?.google_sub,
    email: (data?.google_email as string | null) || null,
    welcomeSeen: !!meta.welcome_google_modal_seen,
    bannerDismissedUntil: (meta.google_banner_dismissed_until as string | null) || null,
  });
}
