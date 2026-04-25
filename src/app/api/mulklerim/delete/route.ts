/**
 * /api/mulklerim/delete — soft delete (status='deleted')
 *
 * POST { token, property_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    const propertyId = body.property_id as string;

    if (!token || !propertyId) {
      return NextResponse.json({ error: "Token ve property_id gerekli." }, { status: 400 });
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

    // Sadece kendi mülkünü silebilir
    const { error } = await supabase
      .from("emlak_properties")
      .update({ status: "deleted" })
      .eq("id", propertyId)
      .eq("user_id", magicToken.user_id);

    if (error) {
      console.error("[mulklerim:delete]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[mulklerim:delete]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
