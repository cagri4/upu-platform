/**
 * GET /api/bayi-panel/me — bayi panel cookie session doğrulama.
 *
 * Cookie geçerliyse bayi tenant profili döner. Token gerekmez (sliding session).
 *
 * Multi-tenant fix: resolveTenantProfile("bayi") composite lookup:
 *   .or(auth_user_id.eq.<uid>, id.eq.<uid>).eq(tenant_id, bayi)
 * Aynı auth.users.id'ye sahip emlak legacy + bayi multi-tenant profile
 * birlikte var olabilir; subdomain bayi → bayi profili döner, emlak değil.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies, attachSessionToResponse } from "@/platform/auth/session";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }

    const supabase = getServiceClient();
    const lookup = await resolveTenantProfile<{
      display_name: string | null;
      tenant_id: string;
      metadata: Record<string, unknown> | null;
    }>(supabase, {
      userId: session.uid,
      tenantKey: "bayi",
      select: "id, display_name, tenant_id, metadata",
    });

    if ("error" in lookup) {
      return NextResponse.json({ error: lookup.error }, { status: lookup.status });
    }

    const meta = (lookup.profile.metadata || {}) as Record<string, unknown>;
    const firma = (meta.firma_profili || {}) as Record<string, unknown>;
    const firmaUnvani =
      (firma.ticari_unvan as string) ||
      (meta.company_name as string) ||
      null;

    const response = NextResponse.json({
      success: true,
      displayName: lookup.profile.display_name || null,
      firmaUnvani,
      officeName: firmaUnvani,
      tenantId: lookup.tenantId,
      botPhone: "31644967207",
    });
    return await attachSessionToResponse(response, {
      uid: session.uid,
      tenantId: lookup.tenantId,
    });
  } catch (err) {
    console.error("[bayi-panel:me]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
