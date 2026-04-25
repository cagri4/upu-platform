/**
 * /api/takip/save — upsert user's daily lead tracking criteria.
 * POST { token, neighborhoods, property_types, listing_type, price_min, price_max }
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText, sendUrlButton } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";

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

    // WA bildirimleri response döndükten SONRA çalışır — client-side
    // setStatus("done") gecikmesin diye after() callback'inde gönderilir.
    after(async () => {
      try {
        const sb = getServiceClient();
        const { data: profile } = await sb
          .from("profiles")
          .select("whatsapp_phone, display_name")
          .eq("id", magicToken.user_id)
          .single();

        if (!profile?.whatsapp_phone) return;
        const phone = profile.whatsapp_phone as string;
        const summary = [
          neighborhoods.length > 0 ? neighborhoods.join(", ") : "Tüm Bodrum",
          propertyTypes.length > 0 ? propertyTypes.join(", ") : "Tüm tipler",
          listingType ? (listingType === "satilik" ? "Satılık" : "Kiralık") : "Satılık+Kiralık",
        ].join(" · ");

        await sendText(
          phone,
          `✅ *Takibin kaydedildi!*\n\nKriter: ${summary}\n\nYarın sabah 06:45'te bu kriterlere uyan yeni sahibi ilanlar WhatsApp'ınıza düşecek.\n\n💡 İleride menüden *📬 Günlük İlan Takibi*'ne dönerek kriterini güncelleyebilir ya da yeni aramalar yapabilirsiniz.`,
        );

        // Auto-chain: mülk ekle butonu (intro flow)
        const mulkToken = randomBytes(32).toString("hex");
        const mulkExpires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        await sb.from("magic_link_tokens").insert({
          user_id: magicToken.user_id,
          token: mulkToken,
          expires_at: mulkExpires,
        });
        const mulkUrl = `https://estateai.upudev.nl/tr/mulkekle-form?t=${mulkToken}`;

        await sendUrlButton(
          phone,
          `🏠 *Şimdi bir mülkünüzü birlikte ekleyelim ve size 3 dakikada profesyonel bir sunum hazırlayayım.*\n\nBu, yapay zekamın satış hedefli metin yazma gücünü göreceğiniz yer. Aşağıdaki formdan portföyünüzden bir mülkü tanıtın — gerisini ben halledeceğim.`,
          "🏠 Mülk Ekle",
          mulkUrl,
          { skipNav: true },
        );
      } catch (waErr) {
        console.error("[takip:save] WA notify failed:", waErr);
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[takip:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
