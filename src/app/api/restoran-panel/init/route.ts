/**
 * GET /api/restoran-panel/init?t=<token>
 *
 * Cookie session öncelikli + token fallback (task #41/#51 pattern,
 * 2026-06-05 audit #5 — 4 SaaS init'e yayıldı).
 *
 * Dönüş: displayName, restaurantName, tenantId, botPhone.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
    const cookieSession = await getSessionFromCookies();
    if (!token && !cookieSession?.uid) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }

    const supabase = getServiceClient();
    let resolvedUserId: string | null = cookieSession?.uid ?? null;
    if (!resolvedUserId && token) {
      const { data: magicToken } = await supabase
        .from("magic_link_tokens")
        .select("user_id, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
      if (new Date(magicToken.expires_at) < new Date()) {
        return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
      }
      resolvedUserId = magicToken.user_id as string;
    }
    if (!resolvedUserId) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, tenant_id, metadata")
      .or(`id.eq.${resolvedUserId},auth_user_id.eq.${resolvedUserId}`)
      .limit(1)
      .maybeSingle();

    const meta = (profile?.metadata || {}) as { restaurant_name?: string; location?: string };

    let restaurantId: string | null = null;
    let restaurantSlug: string | null = null;
    if (profile?.tenant_id) {
      const { data: rest } = await supabase
        .from("rst_restaurants")
        .select("id, slug")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();
      restaurantId = rest?.id || null;
      restaurantSlug = rest?.slug || null;
    }

    return NextResponse.json({
      success: true,
      displayName: profile?.display_name || null,
      restaurantName: meta.restaurant_name || null,
      location: meta.location || null,
      tenantId: profile?.tenant_id || null,
      restaurantId,
      restaurantSlug,
      botPhone: "31644967207",
    });
  } catch (err) {
    console.error("[restoran-panel:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
