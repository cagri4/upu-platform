/**
 * GET /api/market/init?t=<token>
 *
 * Market panel giriş doğrulama. Cookie session öncelikli + token fallback
 * (C5 federated audit F1 — Aşama 1D pattern'i market'a yayıldı). Sidebar
 * nav'dan cookie session ile gelen kullanıcı artık 400 almıyor.
 *
 * Multi-tenant guard: profile tenant_id market saas_type'a ait olmalı,
 * değilse 403. Composite OR lookup (id / auth_user_id) ile runtime
 * tenant profilleri de bulunur.
 *
 * Dönüş: displayName, officeName (market_adi), tenantId, botPhone.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { attachSessionToResponse, getSessionFromCookies } from "@/platform/auth/session";
import { getTenantByKey } from "@/tenants/config";
import { getAllTenantIdsForSaas } from "@/platform/auth/multi-tenant";

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
    if (!resolvedUserId) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }

    const marketCfg = getTenantByKey("market");
    if (!marketCfg?.saasType) {
      return NextResponse.json({ error: "Market tenant config bulunamadı." }, { status: 500 });
    }

    const tenantIds = await getAllTenantIdsForSaas(supabase, marketCfg.saasType);
    if (tenantIds.length === 0) {
      return NextResponse.json(
        { error: "Market tenant'ı sistemde bulunmuyor." },
        { status: 500 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, tenant_id, metadata, auth_user_id")
      .or(`id.eq.${resolvedUserId},auth_user_id.eq.${resolvedUserId}`)
      .in("tenant_id", tenantIds)
      .limit(1)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "Bu link market tenant'ına ait değil veya profil yok." },
        { status: 403 },
      );
    }

    const meta = (profile.metadata as Record<string, unknown> | null) || {};
    const storeName = (meta.market_adi as string) || (meta.office_name as string) || null;

    const response = NextResponse.json({
      success: true,
      displayName: profile.display_name || null,
      tenantId: profile.tenant_id || null,
      officeName: storeName,
      botPhone: "31644967207",
    });
    return await attachSessionToResponse(response, {
      uid: profile.auth_user_id || profile.id,
      tenantId: profile.tenant_id ?? null,
    });
  } catch (err) {
    console.error("[market:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
