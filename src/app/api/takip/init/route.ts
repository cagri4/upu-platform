/**
 * /api/takip/init — validate magic token + return user's existing criteria (if any)
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
    .select("neighborhoods, property_types, listing_type, price_min, price_max, active")
    .eq("user_id", magicToken.user_id)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    criteria: criteria || {
      neighborhoods: [],
      property_types: [],
      listing_type: null,
      price_min: null,
      price_max: null,
      active: true,
    },
  });
}
