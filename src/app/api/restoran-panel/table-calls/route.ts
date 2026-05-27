/**
 * GET /api/restoran-panel/table-calls?t=<token>&status=pending
 *
 * Panel için bekleyen masa çağrıları listesi.
 * Default status=pending.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

    const status = req.nextUrl.searchParams.get("status") || "pending";

    const sb = getServiceClient();
    const { data: magicToken } = await sb
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("tenant_id")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

    const { data: calls } = await sb
      .from("rst_table_calls")
      .select("id, table_id, reason, status, notes, called_at, ack_at")
      .eq("tenant_id", profile.tenant_id)
      .eq("status", status)
      .order("called_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ calls: calls || [] });
  } catch (err) {
    console.error("[restoran-panel/table-calls]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
