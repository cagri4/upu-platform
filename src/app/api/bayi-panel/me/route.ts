/**
 * GET /api/bayi-panel/me — bayi panel cookie session doğrulama.
 * Cookie geçerliyse profile döner (token gerekmez). Sliding session.
 */
import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies, attachSessionToResponse } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }

    const supabase = getServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, tenant_id, metadata")
      .eq("id", session.uid)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
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
    return await attachSessionToResponse(response, {
      uid: session.uid,
      tenantId: profile.tenant_id ?? null,
    });
  } catch (err) {
    console.error("[bayi-panel:me]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
