/**
 * /api/site/init — siteyönetim panel giriş doğrulama.
 *
 * Çoklu auth (Çağrı 2026-05-27 magic-link iyileştirme onayı):
 *   1) Cookie session öncelikli — .upudev.nl JWT cookie varsa token gerekmez
 *   2) Token (?t= / ?token=) — magic-link tıklaması ile gelen kullanıcı
 *      `used_at` set ETMEZ (single-use kaldırıldı — link 24 saat boyunca
 *      defalarca kullanılabilir).
 *
 * Token süresi dolmuşsa 'expired' error code ile döner — frontend
 * "WA'dan yeni link iste" CTA gösterir.
 *
 * displayName + binaName + tenantId döndürür. Bina yöneticilik bağı
 * yoksa binaName null gelir; layout topbar'da boş gösterir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  try {
    // Cookie session öncelikli, token query fallback.
    const auth = await resolvePanelAuth(req);
    if ("error" in auth) {
      // Token süresi dolduysa frontend WA'dan yeni link iste CTA göstersin
      const status = auth.status;
      const code = status === 400 ? "expired" : status === 404 ? "invalid" : "unauthorized";
      return NextResponse.json({ error: auth.error, code }, { status });
    }

    const supabase = getServiceClient();

    // Multi-tenant profile lookup — auth_user_id öncelik + tenant scope
    const lookup = await resolveTenantProfile<{ display_name: string | null; tenant_id: string }>(
      supabase,
      {
        userId: auth.userId,
        tenantKey: "siteyonetim",
        select: "id, display_name, tenant_id",
      },
    );
    if ("error" in lookup) {
      return NextResponse.json({ error: lookup.error, code: "no_profile" }, { status: lookup.status });
    }

    // Yöneticilik yaptığı binayı çek (sidebar topbar'da bina adı görünür).
    const { data: building } = await supabase
      .from("sy_buildings")
      .select("name")
      .eq("manager_id", lookup.profile.id)
      .eq("tenant_id", lookup.tenantId)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      displayName: lookup.profile.display_name || null,
      tenantId: lookup.profile.tenant_id || lookup.tenantId,
      buildingName: building?.name || null,
      botPhone: "31644967207",
    });
  } catch (err) {
    console.error("[site/init]", err);
    return NextResponse.json({ error: "Bir hata oluştu", code: "server_error" }, { status: 500 });
  }
}
