/**
 * /api/sozlesmelerim/get?id=<contract_id>&t=<token>
 * Detay sayfası için tek sözleşmenin tüm alanlarını döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  const id = req.nextUrl.searchParams.get("id");
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

  const { data: contract } = await sb
    .from("contracts")
    .select("id, type, status, contract_data, sign_token, signed_at, created_at, owner_signature_url")
    .eq("id", id)
    .eq("user_id", pt.user_id)
    .neq("status", "deleted")
    .maybeSingle();

  if (!contract) return NextResponse.json({ error: "Sözleşme bulunamadı." }, { status: 404 });

  return NextResponse.json({ success: true, contract });
}
