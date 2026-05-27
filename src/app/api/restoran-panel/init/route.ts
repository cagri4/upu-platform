/**
 * GET /api/restoran-panel/init?t=<token>
 *
 * Restoran panel layout giriş doğrulama. Token used_at SET ETMEZ — panel
 * kapanıp tekrar açılabilir (re-openable, magic link 7-gün TTL).
 *
 * Dönüş: displayName, restaurantName, tenantId, botPhone.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, tenant_id, metadata")
      .eq("id", magicToken.user_id)
      .single();

    const meta = (profile?.metadata || {}) as { restaurant_name?: string; location?: string };

    // rst_restaurants public kart varsa id + slug döndür — panel realtime + public link için
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
