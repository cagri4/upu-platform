/**
 * /api/takip/init?t=<token>
 * Multi-row (2026-05-08): kullanıcının tüm takiplerini liste olarak döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || req.nextUrl.searchParams.get("t");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at")
    .eq("token", token).maybeSingle();

  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: criteria } = await supabase
    .from("emlak_tracking_criteria")
    .select("id, name, neighborhoods, property_types, listing_type, price_min, price_max, active, created_at")
    .eq("user_id", magicToken.user_id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    success: true,
    trackings: criteria || [],
  });
}
