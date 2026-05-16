/**
 * GET /api/panel/google-link/status
 *
 * Panel Ayarları > Hesap Bağlantıları section'ı için kullanıcının Google
 * bağlama durumunu döndürür. Cookie session öncelikli (resolvePanelAuth) +
 * multi-tenant aware profile lookup.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getServiceClient();
  const lookup = await resolveTenantProfile<{
    google_email: string | null;
    google_sub: string | null;
    metadata: Record<string, unknown> | null;
  }>(admin, {
    userId: auth.userId,
    select: "id, google_email, google_sub, metadata",
  });
  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const meta = lookup.profile.metadata ?? {};
  return NextResponse.json({
    linked: !!lookup.profile.google_sub,
    email: lookup.profile.google_email ?? null,
    welcomeSeen: !!meta.welcome_google_modal_seen,
    bannerDismissedUntil: (meta.google_banner_dismissed_until as string | null) || null,
  });
}
