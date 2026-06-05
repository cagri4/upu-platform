/**
 * /api/otel-panel/init — otel yönetim paneli giriş doğrulama.
 * Cookie session öncelikli + token fallback (task #41/#51 pattern,
 * 2026-06-05 audit #5 — 4 SaaS init'e yayıldı).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { attachSessionToResponse, getSessionFromCookies } from "@/platform/auth/session";

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

    // Owner'ın ilk oteli — topbar'da "ofis adı" yerine
    const { data: ouh } = await supabase
      .from("otel_user_hotels")
      .select("hotel_id, otel_hotels(name, city)")
      .eq("user_id", resolvedUserId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const hotel = ouh?.otel_hotels as unknown as { name?: string; city?: string } | null;
    const officeName = hotel?.name
      ? (hotel.city ? `${hotel.name} · ${hotel.city}` : hotel.name)
      : (profile?.metadata as { hotel_name?: string } | null)?.hotel_name || null;

    const response = NextResponse.json({
      success: true,
      displayName: profile?.display_name || null,
      tenantId: profile?.tenant_id || null,
      officeName,
      botPhone: "31644967207",
    });
    return await attachSessionToResponse(response, {
      uid: resolvedUserId,
      tenantId: profile?.tenant_id ?? null,
    });
  } catch (err) {
    console.error("[otel-panel:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
