/**
 * /api/sozlesmelerim/list?t=<token>
 * Kullanıcının sözleşmelerini listele.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const sb = getServiceClient();
  const { data } = await sb
    .from("contracts")
    .select("id, status, contract_data, sign_token, signed_at, created_at")
    .eq("user_id", auth.userId)
    .neq("status", "cancelled")
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ success: true, contracts: data || [] });
}
