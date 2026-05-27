import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { attachSessionToResponse } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/magic-verify?token=<token>
 *
 * Magic link doğrulama + cookie session attach. Eski WA mesajlarındaki
 * /auth/magic?token=... linkleri için defense — sayfa fetch eder, başarı
 * durumunda Set-Cookie response header'ı tarayıcıya yazar, sonraki
 * /tr/<panel-path> yönlendirmesi cookie session ile init yapar.
 *
 * Yeni WA mesajları zaten /api/<tenant>-panel/evergreen kullanır
 * (router.ts evergreenEndpoint map) ve fresh token mint + 302 ile
 * doğrudan panel'e gider.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token gerekli" }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    // Find token
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) {
      return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    }

    if (magicToken.used_at) {
      return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    }

    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Bu linkin süresi dolmuş." }, { status: 400 });
    }

    // Mark as used
    await supabase
      .from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", magicToken.id);

    // Get user info — multi-tenant profile lookup: user_id auth.users.id
    // taşıyabilir (auth_user_id) veya legacy profile.id. Tenant_id için
    // siteyonetim/market/otel/restoran/muhasebe profiles birden fazla
    // tenant'ta var olabilir; host header'ından subdomain tenant'ı seçeriz.
    const { data: byAuthUser } = await supabase
      .from("profiles")
      .select("id, display_name, tenant_id")
      .eq("auth_user_id", magicToken.user_id)
      .maybeSingle();

    const { data: byId } = byAuthUser
      ? { data: null }
      : await supabase
          .from("profiles")
          .select("id, display_name, tenant_id")
          .eq("id", magicToken.user_id)
          .maybeSingle();

    const profile = byAuthUser || byId;

    const response = NextResponse.json({
      success: true,
      userId: magicToken.user_id,
      name: profile?.display_name || "",
    });

    // Cookie session attach — sonraki sayfa /tr/<panel>?t= olmadan da
    // init yapabilsin (defense — yeni evergreen flow zaten token URL'de
    // taşıyor ama burada da set ediyoruz).
    return await attachSessionToResponse(response, {
      uid: magicToken.user_id,
      tenantId: profile?.tenant_id ?? null,
    });
  } catch (err) {
    console.error("[magic-verify]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
