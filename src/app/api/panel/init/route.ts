/**
 * /api/panel/init — yönetim paneli giriş doğrulama.
 * Cookie session öncelik (sliding refresh), legacy magic-link token fallback.
 * Display_name + tenant_id + bot_phone döndürür ve session cookie'yi yeniler.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { attachSessionToResponse, getSessionFromCookies } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    let userId: string | null = null;

    const session = await getSessionFromCookies();
    if (session?.uid) {
      userId = session.uid;
    } else {
      const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
      if (!token) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
      const { data: magicToken } = await supabase
        .from("magic_link_tokens")
        .select("user_id, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
      if (new Date(magicToken.expires_at) < new Date()) {
        return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
      }
      userId = magicToken.user_id;
    }
    if (!userId) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, tenant_id, metadata")
      .eq("id", userId)
      .single();

    const response = NextResponse.json({
      success: true,
      displayName: profile?.display_name || null,
      tenantId: profile?.tenant_id || null,
      officeName: (profile?.metadata as { office_name?: string } | null)?.office_name || null,
      botPhone: "31644967207",
    });
    return await attachSessionToResponse(response, {
      uid: userId,
      tenantId: profile?.tenant_id ?? null,
    });
  } catch (err) {
    console.error("[panel:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
