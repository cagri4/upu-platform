/**
 * /api/takip/save — upsert user's daily lead tracking criteria.
 * POST { token, neighborhoods, property_types, listing_type, price_min, price_max }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
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

    const neighborhoods = Array.isArray(body.neighborhoods) ? body.neighborhoods : [];
    const propertyTypes = Array.isArray(body.property_types) ? body.property_types : [];
    const listingType = typeof body.listing_type === "string" && body.listing_type ? body.listing_type : null;
    const priceMin = Number.isFinite(Number(body.price_min)) && Number(body.price_min) > 0 ? Number(body.price_min) : null;
    const priceMax = Number.isFinite(Number(body.price_max)) && Number(body.price_max) > 0 ? Number(body.price_max) : null;

    const { error } = await supabase.from("emlak_tracking_criteria").upsert(
      {
        user_id: magicToken.user_id,
        neighborhoods,
        property_types: propertyTypes,
        listing_type: listingType,
        price_min: priceMin,
        price_max: priceMax,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("[takip:save]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[takip:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
