/**
 * /api/panel/init — emlak yönetim paneli giriş doğrulama.
 *
 * Cookie session öncelik (sliding refresh), legacy magic-link token fallback.
 *
 * Multi-tenant guard (C5 federated audit F2): profile tenant_id emlak
 * saas_type'a ait olmalı; .upudev.nl cookie tüm subdomain'lere gittiği
 * için bayi/otel/restoran kullanıcısı estateai panel'e ulaşabilirdi.
 * Composite OR lookup runtime tenant profillerini de bulur.
 *
 * Display_name + tenant_id + bot_phone döndürür ve session cookie'yi yeniler.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { attachSessionToResponse, getSessionFromCookies } from "@/platform/auth/session";
import { getTenantByKey } from "@/tenants/config";
import { getAllTenantIdsForSaas } from "@/platform/auth/multi-tenant";

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

    const emlakCfg = getTenantByKey("emlak");
    if (!emlakCfg?.saasType) {
      return NextResponse.json({ error: "Emlak tenant config bulunamadı." }, { status: 500 });
    }

    const tenantIds = await getAllTenantIdsForSaas(supabase, emlakCfg.saasType);
    if (tenantIds.length === 0) {
      return NextResponse.json(
        { error: "Emlak tenant'ı sistemde bulunmuyor." },
        { status: 500 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, tenant_id, metadata, auth_user_id")
      .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
      .in("tenant_id", tenantIds)
      .limit(1)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "Bu oturum emlak tenant'ına ait değil veya profil yok." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({
      success: true,
      displayName: profile.display_name || null,
      tenantId: profile.tenant_id || null,
      officeName: (profile.metadata as { office_name?: string } | null)?.office_name || null,
      botPhone: "31644967207",
    });
    return await attachSessionToResponse(response, {
      uid: profile.auth_user_id || profile.id,
      tenantId: profile.tenant_id ?? null,
    });
  } catch (err) {
    console.error("[panel:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
