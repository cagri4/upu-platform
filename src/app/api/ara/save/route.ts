/**
 * /api/ara/save — DEMO ARAMA (query-only).
 *
 * Kullanıcı intro akışında form doldurur → bu endpoint bugünün
 * emlak_daily_leads'ını formdaki kriterlere göre süzer, uyan ilanları
 * döner. KAYDETME YOK — sadece gösterim amaçlı.
 *
 * İlk aramadan sonra kullanıcıya WA'dan "şimdi kalıcı takip kuralım"
 * followup mesajı tetikleniyor (idempotent: profile.metadata.demo_shown
 * flag ile).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

interface SearchPayload {
  token: string;
  listing_type?: string;
  property_types?: string[];
  price_min?: number | null;
  price_max?: number | null;
  rooms?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SearchPayload;
    const token = body.token;
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_phone, metadata")
      .eq("id", magicToken.user_id)
      .single();
    const userPhone = profile?.whatsapp_phone as string | undefined;

    // Query today's daily_leads matching form criteria
    const today = new Date().toISOString().slice(0, 10);
    let query = supabase.from("emlak_daily_leads")
      .select("source_id, source_url, title, type, listing_type, price, area, rooms, location_neighborhood")
      .eq("snapshot_date", today)
      .ilike("location_district", "%Bodrum%");

    if (body.listing_type) query = query.eq("listing_type", body.listing_type);
    if (body.property_types && body.property_types.length > 0) {
      query = query.in("type", body.property_types);
    }
    if (body.price_min) query = query.gte("price", body.price_min);
    if (body.price_max) query = query.lte("price", body.price_max);
    if (body.rooms && body.rooms.length > 0) {
      query = query.in("rooms", body.rooms);
    }

    const { data: results } = await query.order("created_at", { ascending: false }).limit(50);

    // Trigger followup WA button for takip setup (only first time)
    const metadata = (profile?.metadata as Record<string, unknown>) || {};
    const alreadyShown = metadata.demo_shown === true;

    if (!alreadyShown && userPhone) {
      try {
        // Mark demo as shown
        await supabase.from("profiles").update({
          metadata: { ...metadata, demo_shown: true },
        }).eq("id", magicToken.user_id);

        // Generate magic token for takip page
        const takipToken = randomBytes(16).toString("hex");
        const takipExpires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        await supabase.from("magic_link_tokens").insert({
          user_id: magicToken.user_id,
          token: takipToken,
          expires_at: takipExpires,
        });
        const takipUrl = `https://estateai.upudev.nl/tr/takip?t=${takipToken}`;

        await sendUrlButton(
          userPhone,
          `🎯 *Şimdi her sabah düzenli gelecek takibini kuralım.* Hangi kriterlere uyan ilanlar günlük brifinginizde olsun?`,
          "🎯 Takip Kur",
          takipUrl,
          { skipNav: true },
        );
      } catch (waErr) {
        console.error("[ara:save] takip WA failed:", waErr);
      }
    }

    return NextResponse.json({
      success: true,
      results: results || [],
    });
  } catch (err) {
    console.error("[ara:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
