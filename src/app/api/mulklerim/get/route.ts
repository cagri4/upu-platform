/**
 * /api/mulklerim/get?id=<property_id>&t=<token>
 * — düzenleme modu için tek mülkün tüm alanlarını ve fotolarını döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

    const auth = await resolvePanelAuth(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getServiceClient();
    const { data: prop } = await supabase
      .from("emlak_properties")
      .select("*")
      .eq("id", id)
      .eq("user_id", auth.userId)
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
