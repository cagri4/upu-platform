/**
 * /api/sozlesme/init?t=<token>
 * Sözleşme oluşturma sayfası için kullanıcının mülk + müşteri listesini döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const sb = getServiceClient();
  const [propsRes, custRes] = await Promise.all([
    sb.from("emlak_properties")
      .select("id, title, listing_type, type, price, location_district, location_neighborhood")
      .eq("user_id", auth.userId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false }),
    sb.from("emlak_customers")
      .select("id, name, phone, email, looking_for")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    success: true,
    properties: propsRes.data || [],
    customers: custRes.data || [],
  });
}
