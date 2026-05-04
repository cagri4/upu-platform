/**
 * /api/musterilerim/delete — soft delete (deleted_at = now())
 *
 * POST { token, customer_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    const customerId = body.customer_id as string;

    if (!token || !customerId) {
      return NextResponse.json({ error: "Token ve customer_id gerekli." }, { status: 400 });
    }

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

    const { error } = await supabase
      .from("emlak_customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", customerId)
      .eq("user_id", magicToken.user_id);

    if (error) {
      console.error("[musterilerim:delete]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[musterilerim:delete]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
