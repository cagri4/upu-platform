/**
 * GET /api/panel-session/qr-finish?code=<code>
 *
 * Desktop tarayıcı qr-status'tan 'claimed' alınca bu endpoint'e yönlenir.
 * Server:
 *   1. Code'u DB'den yükle (status='claimed')
 *   2. claimed_user_id'den profile fetch → tenantId
 *   3. Cookie set (.upudev.nl scope, 30 gün)
 *   4. Code'u finished olarak işaretle (tek kullanımlık)
 *   5. Tenant subdomain'e + panel ana URL'ine 302 redirect
 *
 * Cookie .upudev.nl scope olduğu için redirect olunan tenant subdomain'inde
 * de geçerli — hedef panel sayfası /me ile direkt auth eder.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { signSession, buildSessionCookie } from "@/platform/auth/session";
import { getTenantPanelUrl } from "@/platform/auth/qr";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const FALLBACK_HOME = "https://upudev.nl";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.redirect(FALLBACK_HOME);

    const sb = getServiceClient();
    const { data: row } = await sb
      .from("panel_qr_tokens")
      .select("status, claimed_user_id, claimed_tenant, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (!row) return NextResponse.redirect(FALLBACK_HOME);
    if (row.status !== "claimed") return NextResponse.redirect(FALLBACK_HOME);
    if (!row.claimed_user_id || !row.claimed_tenant) return NextResponse.redirect(FALLBACK_HOME);

    // Tenant subdomain'i kullanıcının ait olduğu paneldir
    const targetUrl = getTenantPanelUrl(row.claimed_tenant);
    if (!targetUrl) return NextResponse.redirect(FALLBACK_HOME);

    // Multi-tenant profile lookup — claimed_tenant'a göre doğru profile'ı bul.
    // Legacy `eq("id", uid)` her zaman emlak profile döndürüyordu; bayi gibi
    // multi-tenant subdomain'lerde JWT yanlış tenant_id ile imzalanıyordu →
    // panel layout bayi açsa da içerik emlak'a düşüyor / mobil view "emlak'a
    // dönüşmüş" görünür.
    const lookup = await resolveTenantProfile<{ tenant_id: string }>(sb, {
      userId: row.claimed_user_id,
      tenantKey: row.claimed_tenant,
      select: "tenant_id",
    });
    if ("error" in lookup) {
      console.error("[qr-finish] profile lookup fail:", lookup.error);
      return NextResponse.redirect(FALLBACK_HOME);
    }

    // Code'u tek kullanımlık olarak işaretle
    await sb
      .from("panel_qr_tokens")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("code", code)
      .eq("status", "claimed");

    const jwt = await signSession({
      uid: row.claimed_user_id,
      tenantId: lookup.tenantId,
    });

    const response = NextResponse.redirect(targetUrl);
    response.headers.append("Set-Cookie", buildSessionCookie(jwt));
    return response;
  } catch (err) {
    console.error("[qr-finish]", err);
    return NextResponse.redirect(FALLBACK_HOME);
  }
}
