/**
 * /api/site/init — siteyönetim panel giriş doğrulama.
 *
 * Token'ı `used_at` set etmeden doğrular (panel kapanıp tekrar açılabilir).
 * displayName + binaName + tenantId döndürür. Bina yöneticilik bağı
 * yoksa binaName null gelir; layout topbar'da boş gösterir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

const SITEYONETIM_TENANT_ID = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";

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
      .select("display_name, tenant_id")
      .eq("id", magicToken.user_id)
      .single();

    // Yöneticilik yaptığı binayı çek (sidebar topbar'da bina adı görünür).
    const { data: building } = await supabase
      .from("sy_buildings")
      .select("name")
      .eq("manager_id", magicToken.user_id)
      .eq("tenant_id", SITEYONETIM_TENANT_ID)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      displayName: profile?.display_name || null,
      tenantId: profile?.tenant_id || null,
      buildingName: building?.name || null,
      botPhone: "31644967207",
    });
  } catch (err) {
    console.error("[site/init]", err);
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 });
  }
}
