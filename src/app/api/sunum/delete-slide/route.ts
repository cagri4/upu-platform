/**
 * /api/sunum/delete-slide — bir slaytı "deleted_slides" listesine
 * ekler. Sayfa render sırasında bu liste filtrelenerek slayt
 * gizlenir. Geri alınabilir, gerçek silme yok.
 *
 * POST { token, slide_key }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface PresContent {
  deleted_slides?: string[];
  [k: string]: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    const slideKey = body.slide_key as string;

    if (!token || !slideKey) {
      return NextResponse.json({ error: "Token ve slide_key gerekli." }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: pres } = await supabase
      .from("emlak_presentations")
      .select("id, content")
      .eq("magic_token", token)
      .single();

    if (!pres) return NextResponse.json({ error: "Sunum bulunamadı." }, { status: 404 });

    const content: PresContent = (pres.content as PresContent) || {};
    const deleted = new Set(content.deleted_slides || []);
    deleted.add(slideKey);

    const newContent = { ...content, deleted_slides: Array.from(deleted) };

    const { error } = await supabase.from("emlak_presentations")
      .update({ content: newContent })
      .eq("id", pres.id);

    if (error) {
      console.error("[sunum:delete-slide]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[sunum:delete-slide]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
