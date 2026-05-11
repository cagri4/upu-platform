/**
 * /api/notifications/mark-read — bildirim(ler)i okundu işaretle.
 * Body: { ids: [1,2,3] } veya { all: true }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sb = getServiceClient();
    const userId = auth.userId;
    const now = new Date().toISOString();

    if (body.all === true) {
      const { error } = await sb
        .from("notifications")
        .update({ is_read: true, read_at: now })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter((n: unknown) => typeof n === "number") : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids veya all gerekli." }, { status: 400 });
    }
    const { error } = await sb
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .in("id", ids)
      .eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notifications:mark-read]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
