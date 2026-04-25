/**
 * /api/mulklerim/get?id=<property_id>&t=<token>
 * — düzenleme modu için tek mülkün tüm alanlarını ve fotolarını döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
    const id = req.nextUrl.searchParams.get("id");
    if (!token || !id) {
      return NextResponse.json({ error: "Token ve id gerekli." }, { status: 400 });
    }

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

    const { data: prop } = await supabase
      .from("emlak_properties")
      .select("*")
      .eq("id", id)
      .eq("user_id", magicToken.user_id)
      .neq("status", "deleted")
      .maybeSingle();

    if (!prop) return NextResponse.json({ error: "Mülk bulunamadı." }, { status: 404 });

    const { data: photos } = await supabase
      .from("emlak_property_photos")
      .select("url, sort_order")
      .eq("property_id", id)
      .order("sort_order", { ascending: true });

    const photoUrls = (photos || []).map(p => p.url as string);

    return NextResponse.json({ property: prop, photo_urls: photoUrls });
  } catch (err) {
    console.error("[mulklerim:get]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
