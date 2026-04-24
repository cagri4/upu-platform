/**
 * /api/lead-liste/call — log a call action against a daily lead.
 * POST { token, source_id, status: "called" | "no_answer" | "interested" | "not_interested" | "listed", note? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["called", "no_answer", "interested", "not_interested", "listed"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    const sourceId = body.source_id as string;
    const status = body.status as string;
    const note = (body.note as string | null) || null;

    if (!token || !sourceId || !status) {
      return NextResponse.json({ error: "token, source_id ve status gerekli." }, { status: 400 });
    }
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Geçersiz status." }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at")
      .eq("token", token).maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    // Upsert on (user_id, source_id) — UNIQUE index on these columns
    const { error } = await supabase.from("emlak_lead_calls").upsert(
      {
        user_id: magicToken.user_id,
        source_id: sourceId,
        status,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,source_id" },
    );

    if (error) {
      console.error("[lead-liste:call]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[lead-liste:call]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
