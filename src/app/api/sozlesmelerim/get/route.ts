/**
 * /api/sozlesmelerim/get?id=<contract_id>[&t=<token>]
 * Detay sayfası için tek sözleşmenin tüm alanlarını döner.
 * Cookie session öncelik, legacy ?t= token fallback.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const { data: contract } = await sb
    .from("contracts")
    .select("id, type, status, contract_data, sign_token, signed_at, created_at, owner_signature_url")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .neq("status", "deleted")
    .maybeSingle();

  if (!contract) return NextResponse.json({ error: "Sözleşme bulunamadı." }, { status: 404 });

  return NextResponse.json({ success: true, contract });
}
