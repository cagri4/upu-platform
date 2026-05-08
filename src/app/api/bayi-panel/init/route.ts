/**
 * GET /api/bayi-panel/init?t=<token>
 *
 * Bayi panel layout giriş doğrulama. Token used_at SET ETMEZ — panel
 * kapanıp tekrar açılabilir (re-openable, magic link 7-gün TTL).
 *
 * Dönüş: displayName, firmaUnvani, tenantId, botPhone.
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

    const meta = (profile?.metadata || {}) as Record<string, unknown>;
    const firma = (meta.firma_profili || {}) as Record<string, unknown>;
    const firmaUnvani =
      (firma.ticari_unvan as string) ||
      (meta.company_name as string) ||
      null;

    return NextResponse.json({
      success: true,
      displayName: profile?.display_name || null,
      firmaUnvani,
      officeName: firmaUnvani,
      tenantId: profile?.tenant_id || null,
      botPhone: "31644967207",
    });
  } catch (err) {
    console.error("[bayi-panel:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
