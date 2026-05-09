/**
 * GET /api/panel/me — emlak yönetim paneli cookie session doğrulama.
 * Cookie geçerliyse profile döner (token gerekmez). Cookie expiry her isabet
 * ettiğinde refresh edilir (sliding session).
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

    const response = NextResponse.json({
      success: true,
      displayName: profile.display_name || null,
      tenantId: profile.tenant_id || null,
      officeName: (profile.metadata as { office_name?: string } | null)?.office_name || null,
      botPhone: "31644967207",
    });
    return await attachSessionToResponse(response, {
      uid: session.uid,
      tenantId: profile.tenant_id ?? null,
    });
  } catch (err) {
    console.error("[panel:me]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
