/**
 * /api/takip/delete — takip sil.
 * POST { token, id }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body as { id?: string };
    if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sb = getServiceClient();
    const { error } = await sb.from("emlak_tracking_criteria")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.userId);

    if (error) {
      console.error("[takip:delete]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[takip:delete]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
