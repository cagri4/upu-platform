/**
 * GET /api/bayi-panel/init?t=<token>
 *
 * Bayi panel layout giriş doğrulama. Token used_at SET ETMEZ — panel
 * kapanıp tekrar açılabilir (re-openable, magic link 7-gün TTL).
 *
 * Multi-tenant: magic_link_tokens.user_id evergreen tarafından bayi
 * profile.id ile mint edilir. Bayi tenant guard: dönen profile tenant_id
 * bayi olmalı, değilse 403 (legacy emlak token bayi subdomain'inde kullanılamaz).
 *
 * Dönüş: displayName, firmaUnvani, tenantId, botPhone.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { attachSessionToResponse } from "@/platform/auth/session";
import { getTenantByKey } from "@/tenants/config";

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

    const bayiCfg = getTenantByKey("bayi");
    if (!bayiCfg?.tenantId) {
      return NextResponse.json({ error: "Bayi tenant config bulunamadı." }, { status: 500 });
    }

    // Profile composite lookup — id (legacy emlak profile.id == auth.users.id)
    // veya auth_user_id (multi-tenant). Bayi tenant guard sonunda.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, tenant_id, metadata, auth_user_id")
      .or(`id.eq.${magicToken.user_id},auth_user_id.eq.${magicToken.user_id}`)
      .eq("tenant_id", bayiCfg.tenantId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "Bu link bayi tenant'ına ait değil veya profil yok." },
        { status: 403 },
      );
    }

    const meta = (profile.metadata || {}) as Record<string, unknown>;
    const firma = (meta.firma_profili || {}) as Record<string, unknown>;
    const firmaUnvani =
      (firma.ticari_unvan as string) ||
      (meta.company_name as string) ||
      null;

    const response = NextResponse.json({
      success: true,
      displayName: profile.display_name || null,
      firmaUnvani,
      officeName: firmaUnvani,
      tenantId: profile.tenant_id || null,
      botPhone: "31644967207",
    });
    // Session cookie auth.users.id taşır (auth_user_id legacy emlak'ta ==id);
    // sonraki cookie session lookup'larında bu uid resolveTenantProfile ile
    // doğru bayi profile'a bağlanır.
    return await attachSessionToResponse(response, {
      uid: profile.auth_user_id || profile.id,
      tenantId: profile.tenant_id ?? null,
    });
  } catch (err) {
    console.error("[bayi-panel:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
