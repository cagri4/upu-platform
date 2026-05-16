/**
 * GET /api/panel/me — emlak yönetim paneli cookie session doğrulama.
 * Cookie geçerliyse profile döner (token gerekmez). Cookie expiry her isabet
 * ettiğinde refresh edilir (sliding session).
 *
 * Multi-tenant aware: profile lookup (auth_user_id || id) + tenant_id ile
 * scoped — eski `eq("id", session.uid)` multi-tenant pattern'inde 0 row
 * dönüyordu (display_name boş, modal'lar persistent fail).
 */
import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies, attachSessionToResponse } from "@/platform/auth/session";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }

    const supabase = getServiceClient();
    const lookup = await resolveTenantProfile<{
      display_name: string | null;
      tenant_id: string | null;
      metadata: Record<string, unknown> | null;
    }>(supabase, {
      userId: session.uid,
      select: "id, display_name, tenant_id, metadata",
    });
    if ("error" in lookup) {
      return NextResponse.json({ error: lookup.error }, { status: lookup.status });
    }

    const profile = lookup.profile;
    const response = NextResponse.json({
      success: true,
      displayName: profile.display_name || null,
      tenantId: profile.tenant_id || null,
      officeName: (profile.metadata as { office_name?: string } | null)?.office_name || null,
      botPhone: "31644967207",
    });
    return await attachSessionToResponse(response, {
      uid: session.uid,
      tenantId: profile.tenant_id ?? null,
    });
  } catch (err) {
    console.error("[panel:me]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
