/**
 * GET /api/otel-panel/me — otel panel cookie session doğrulama.
 * Cookie geçerliyse profile + ilk hotel adı döner. Sliding session.
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

    const { data: ouh } = await supabase
      .from("otel_user_hotels")
      .select("hotel_id, otel_hotels(name, city)")
      .eq("user_id", session.uid)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const hotel = ouh?.otel_hotels as unknown as { name?: string; city?: string } | null;
    const officeName = hotel?.name
      ? (hotel.city ? `${hotel.name} · ${hotel.city}` : hotel.name)
      : (profile.metadata as { hotel_name?: string } | null)?.hotel_name || null;

    const response = NextResponse.json({
      success: true,
      displayName: profile.display_name || null,
      tenantId: profile.tenant_id || null,
      officeName,
      botPhone: "31644967207",
    });
    return await attachSessionToResponse(response, {
      uid: session.uid,
      tenantId: profile.tenant_id ?? null,
    });
  } catch (err) {
    console.error("[otel-panel:me]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
