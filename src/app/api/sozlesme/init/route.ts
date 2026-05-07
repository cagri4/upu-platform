/**
 * /api/sozlesme/init?t=<token>
 * Sözleşme oluşturma sayfası için kullanıcının mülk + müşteri listesini döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
  }

  const [propsRes, custRes] = await Promise.all([
    sb.from("emlak_properties")
      .select("id, title, listing_type, type, price, location_district, location_neighborhood")
      .eq("user_id", pt.user_id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false }),
    sb.from("emlak_customers")
      .select("id, name, phone, email, looking_for")
      .eq("user_id", pt.user_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    success: true,
    properties: propsRes.data || [],
    customers: custRes.data || [],
  });
}
