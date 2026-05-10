/**
 * /api/takip/toggle — takip durumunu çevir (active <-> paused).
 * POST { token, id, active }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, active } = body as { id?: string; active?: boolean };
    if (!id || typeof active !== "boolean") {
      return NextResponse.json({ error: "id ve active gerekli." }, { status: 400 });
    }

    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sb = getServiceClient();
    const { error } = await sb.from("emlak_tracking_criteria")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", auth.userId);

    if (error) {
      console.error("[takip:toggle]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[takip:toggle]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
