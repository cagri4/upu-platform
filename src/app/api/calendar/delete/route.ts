/**
 * /api/calendar/delete — event cancel (soft, status='cancelled').
 * POST { token, id }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { token, id } = await req.json();
    if (!token || !id) return NextResponse.json({ error: "Token ve id gerekli." }, { status: 400 });

    const sb = getServiceClient();
    const { data: pt } = await sb
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token).maybeSingle();
    if (!pt) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(pt.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { error } = await sb.from("emlak_calendar_events")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", pt.user_id);

    if (error) {
      console.error("[calendar:delete]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[calendar:delete]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
