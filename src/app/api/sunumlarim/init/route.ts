/**
 * /api/sunumlarim/init — magic link doğrulama + kullanıcının
 * sunumlarını listele.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolvePanelAuth(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = getServiceClient();
    const { data: presentations } = await supabase
      .from("emlak_presentations")
      .select("id, title, magic_token, created_at, content")
      .eq("user_id", auth.userId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(50);

    const items = (presentations || []).map((p) => {
      const c = (p.content as { properties?: Array<{ photos?: string[]; image_url?: string | null; price?: number | null }> }) || {};
      const prop = c.properties?.[0];
      const cover = prop?.photos?.[0] || prop?.image_url || null;
      const price = prop?.price || null;
      return {
        id: p.id,
        title: p.title,
        magic_token: p.magic_token,
        created_at: p.created_at,
        cover,
        price,
      };
    });

    return NextResponse.json({ presentations: items });
  } catch (err) {
    console.error("[sunumlarim:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
