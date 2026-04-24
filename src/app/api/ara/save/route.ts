/**
 * /api/ara/save — Save search criteria to user profile, return results preview,
 * trigger WA bot message with next step (profile form link).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

interface SavePayload {
  token: string;
  region: string;
  property_type: string;
  listing_type: string;
  listed_by: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SavePayload;
    const token = body.token;
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    if (new Date(magicToken.expires_at) < new Date()) return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_phone, metadata")
      .eq("id", magicToken.user_id)
      .single();
    const userPhone = profile?.whatsapp_phone as string | undefined;
    if (!userPhone) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    // Save search criteria to profile metadata (legacy reference)
    const newMetadata = {
      ...(profile?.metadata as Record<string, unknown> || {}),
      search_criteria: {
        region: body.region,
        property_type: body.property_type,
        listing_type: body.listing_type,
        listed_by: body.listed_by,
      },
    };
    await supabase.from("profiles").update({ metadata: newMetadata }).eq("id", magicToken.user_id);

    // Also write to emlak_tracking_criteria so the morning brief honors
    // the onboarding selection immediately (shared source-of-truth).
    await supabase.from("emlak_tracking_criteria").upsert(
      {
        user_id: magicToken.user_id,
        neighborhoods: [], // onboarding only picks region (Bodrum), no sub-areas
        property_types: body.property_type && body.property_type !== "hepsi" ? [body.property_type] : [],
        listing_type: body.listing_type && body.listing_type !== "hepsi" ? body.listing_type : null,
        price_min: null,
        price_max: null,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    // Query results matching criteria
    let query = supabase.from("emlak_properties")
      .select("location_neighborhood, price", { count: "exact" })
      .ilike("location_district", `%${body.region}%`);
    if (body.property_type !== "hepsi") query = query.eq("type", body.property_type);
    if (body.listing_type !== "hepsi") query = query.eq("listing_type", body.listing_type);
    if (body.listed_by !== "hepsi") query = query.eq("listed_by", body.listed_by === "sahibi" ? "sahibi" : "emlakci");

    const { data: props, count } = await query.limit(1000);

    const byHood: Record<string, number> = {};
    let totalPrice = 0, priceCount = 0;
    for (const p of props || []) {
      const hood = p.location_neighborhood || "Diğer";
      byHood[hood] = (byHood[hood] || 0) + 1;
      if (p.price) { totalPrice += p.price; priceCount++; }
    }
    const avgPrice = priceCount > 0 ? Math.round(totalPrice / priceCount) : 0;
    const neighborhoods = Object.entries(byHood).sort((a, b) => b[1] - a[1]);

    // Invalidate search token
    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    // Generate next step token (profile form) and send WA message
    const profileToken = randomBytes(32).toString("hex");
    const profileExpires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await supabase.from("magic_link_tokens").insert({
      user_id: magicToken.user_id,
      token: profileToken,
      expires_at: profileExpires,
    });

    const profileUrl = `https://estateai.upudev.nl/tr/profil-kurulum?t=${profileToken}`;

    try {
      await sendUrlButton(userPhone,
        `✅ Arama kriterlerini kaydettim. Bölgende ${count || 0} ilan var.\n\nŞimdi seni tanıyalım — profil bilgilerini doldurmak için butonun tıkla:`,
        "👤 Profil Formu",
        profileUrl,
        { skipNav: true },
      );
    } catch (err) {
      console.error("[ara:save] WA notify failed:", err);
    }

    return NextResponse.json({
      success: true,
      count: count || 0,
      avgPrice,
      neighborhoods: neighborhoods.map(([name, cnt]) => ({ name, count: cnt })),
    });
  } catch (err) {
    console.error("[ara:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
