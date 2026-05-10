/**
 * /api/mulklerim/delete — soft delete (status='deleted')
 *
 * POST { token, property_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const propertyId = body.property_id as string | undefined;
    if (!propertyId) {
      return NextResponse.json({ error: "property_id gerekli." }, { status: 400 });
    }

    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getServiceClient();
    // Sadece kendi mülkünü silebilir
    const { error } = await supabase
      .from("emlak_properties")
      .update({ status: "deleted" })
      .eq("id", propertyId)
      .eq("user_id", auth.userId);

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
