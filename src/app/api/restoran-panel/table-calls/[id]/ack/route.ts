/**
 * POST /api/restoran-panel/table-calls/[id]/ack
 *
 * Restoran sahibi/garson masa çağrısını "yanıtladım" olarak işaretler.
 * Status: pending → acknowledged (ack_at + ack_by set).
 *
 * Body: { token: string, resolved?: boolean }
 *   - resolved true → status='resolved' direkt (closed)
 *   - resolved false (default) → status='acknowledged' (görüldü ama iş sürüyor)
 *
 * Auth: magic token, tenant_id eşleşmesi.
 * Realtime: rst_table_calls UPDATE → panel masalar sayfası badge kaybolur.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: callId } = await ctx.params;

    const body = (await req.json().catch(() => ({}))) as { token?: string; resolved?: boolean };
    const token = body.token || req.nextUrl.searchParams.get("t");
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

    // Çağrı lookup + tenant check
    const { data: call } = await supabase
      .from("rst_table_calls")
      .select("id, status")
      .eq("id", callId)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (!call) return NextResponse.json({ error: "Çağrı bulunamadı." }, { status: 404 });

    if (call.status === "resolved") {
      return NextResponse.json({ ok: true, status: "resolved" });
    }

    const nextStatus = body.resolved ? "resolved" : "acknowledged";
    await supabase
      .from("rst_table_calls")
      .update({
        status: nextStatus,
        ack_at: new Date().toISOString(),
        ack_by: magicToken.user_id,
      })
      .eq("id", callId);

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (err) {
    console.error("[table-calls/ack]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
