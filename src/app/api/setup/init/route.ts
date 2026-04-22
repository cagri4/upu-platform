/**
 * Setup init: verify magic token + return current profile data to pre-fill setup form.
 * Does NOT invalidate token (so user can refresh, navigate back).
 * Token is invalidated on /api/setup/save.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  try {
    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    if (new Date(magicToken.expires_at) < new Date()) return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, whatsapp_phone, metadata, tenant_id")
      .eq("id", magicToken.user_id)
      .single();

    return NextResponse.json({
      success: true,
      userId: magicToken.user_id,
      profile: {
        display_name: profile?.display_name || "",
        whatsapp_phone: profile?.whatsapp_phone || "",
        office_name: (profile?.metadata as Record<string, unknown>)?.office_name as string || "",
        location: (profile?.metadata as Record<string, unknown>)?.location as string || "",
        email: (profile?.metadata as Record<string, unknown>)?.email as string || "",
        experience_years: (profile?.metadata as Record<string, unknown>)?.experience_years as string || "",
      },
    });
  } catch (err) {
    console.error("[setup:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
