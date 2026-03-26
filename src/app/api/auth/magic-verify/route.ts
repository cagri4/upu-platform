import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token gerekli" }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    // Find token
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) {
      return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    }

    if (magicToken.used_at) {
      return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    }

    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Bu linkin süresi dolmuş." }, { status: 400 });
    }

    // Mark as used
    await supabase
      .from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", magicToken.id);

    // Get user info
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, tenant_id")
      .eq("id", magicToken.user_id)
      .single();

    return NextResponse.json({
      success: true,
      userId: magicToken.user_id,
      name: profile?.display_name || "",
    });
  } catch (err) {
    console.error("[magic-verify]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
