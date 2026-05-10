/**
 * /api/musterilerim/delete — soft delete (deleted_at = now())
 *
 * POST { token, customer_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const customerId = body.customer_id as string | undefined;
    if (!customerId) return NextResponse.json({ error: "customer_id gerekli." }, { status: 400 });

    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getServiceClient();
    const { error } = await supabase
      .from("emlak_customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", customerId)
      .eq("user_id", auth.userId);

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
