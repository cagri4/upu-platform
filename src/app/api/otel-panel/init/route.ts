/**
 * /api/otel-panel/init — otel yönetim paneli giriş doğrulama.
 * Token'ı `used_at` set etmeden doğrular (panel kapanıp tekrar açılabilir).
 * Display_name + tenant_id + ilk hotel adı (officeName) döndürür.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, tenant_id, metadata")
      .eq("id", magicToken.user_id)
      .single();

    // Owner'ın ilk oteli — topbar'da "ofis adı" yerine
    const { data: ouh } = await supabase
      .from("otel_user_hotels")
      .select("hotel_id, otel_hotels(name, city)")
      .eq("user_id", magicToken.user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const hotel = ouh?.otel_hotels as unknown as { name?: string; city?: string } | null;
    const officeName = hotel?.name
      ? (hotel.city ? `${hotel.name} · ${hotel.city}` : hotel.name)
      : (profile?.metadata as { hotel_name?: string } | null)?.hotel_name || null;

    return NextResponse.json({
      success: true,
      displayName: profile?.display_name || null,
      tenantId: profile?.tenant_id || null,
      officeName,
      botPhone: "31644967207",
    });
  } catch (err) {
    console.error("[otel-panel:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
