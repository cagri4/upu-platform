/**
 * GET /api/restoran-profil/init?t=<token>
 *
 * Token doğrula, profile metadata + display_name dön. Form mevcut değerleri
 * önceden doldurmak için.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, metadata, tenant_id")
    .eq("id", magicToken.user_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    profile: profile ? {
      display_name: profile.display_name,
      metadata: profile.metadata || {},
    } : null,
  });
}
