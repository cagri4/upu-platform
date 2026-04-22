/**
 * Mülk ekle save: accept token + property form data, insert property,
 * invalidate token, trigger WhatsApp bot message.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function toArr(v: unknown): string[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.filter(x => typeof x === "string" && x.trim()).map(x => String(x).trim());
  const s = String(v).trim();
  if (!s) return null;
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
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

    if (!body.title || String(body.title).trim().length < 3) {
      return NextResponse.json({ error: "Başlık en az 3 karakter olmalı." }, { status: 400 });
    }
    if (!body.price || Number(body.price) <= 0) {
      return NextResponse.json({ error: "Geçerli fiyat gerekli." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_phone, tenant_id")
      .eq("id", magicToken.user_id)
      .single();
    const userPhone = profile?.whatsapp_phone as string | undefined;
    const tenantId = profile?.tenant_id as string | undefined;
    if (!userPhone || !tenantId) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const { data: inserted, error } = await supabase.from("emlak_properties").insert({
      tenant_id: tenantId,
      user_id: magicToken.user_id,
      title: String(body.title).trim(),
      listing_type: body.listing_type || "satilik",
      type: body.type || "daire",
      price: Number(body.price),
      area: body.area ? Number(body.area) : null,
      net_area: body.net_area ? Number(body.net_area) : null,
      rooms: body.rooms || null,
      floor: body.floor || null,
      total_floors: body.total_floors || null,
      building_age: body.building_age || null,
      location_city: body.location_city || null,
      location_district: body.location_district || null,
      location_neighborhood: body.location_neighborhood || null,
      heating: body.heating || null,
      parking: body.parking || null,
      facade: toArr(body.facade),
      housing_type: toArr(body.housing_type),
      bathroom_count: body.bathroom_count || null,
      kitchen_type: body.kitchen_type || null,
      elevator: typeof body.elevator === "boolean" ? body.elevator : null,
      balcony: typeof body.balcony === "boolean" ? body.balcony : null,
      deed_type: body.deed_type || null,
      usage_status: body.usage_status || null,
      swap: typeof body.swap === "boolean" ? body.swap : null,
      description: body.description || null,
      interior_features: toArr(body.interior_features),
      exterior_features: toArr(body.exterior_features),
      view_features: toArr(body.view_features),
      neighborhood_features: toArr(body.neighborhood_features),
      disability_features: toArr(body.disability_features),
      transportation: toArr(body.transportation),
      status: "aktif",
    }).select("id").single();

    if (error || !inserted) {
      console.error("[mulkekle:save]", error);
      return NextResponse.json({ error: error?.message || "Kaydedilemedi." }, { status: 500 });
    }

    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    // Auto-generate presentation (property-only, no customer)
    const propTitle = String(body.title).trim();
    const propPrice = Number(body.price);
    let sunumUrl: string | null = null;

    try {
      const propertyDetails = [
        `Başlık: ${propTitle}`,
        `Fiyat: ${new Intl.NumberFormat("tr-TR").format(propPrice)} TL`,
        body.area ? `Alan: ${body.area} m²` : null,
        body.rooms ? `Oda: ${body.rooms}` : null,
        body.type ? `Tip: ${body.type}` : null,
        body.listing_type ? `İlan: ${body.listing_type}` : null,
        body.location_neighborhood || body.location_district ? `Konum: ${body.location_neighborhood || body.location_district}` : null,
        body.description ? `Açıklama: ${String(body.description).substring(0, 300)}` : null,
      ].filter(Boolean).join("\n");

      let aiSummary = "";
      try {
        const { askClaude } = await import("@/platform/ai/claude");
        aiSummary = await askClaude(
          "Sen profesyonel bir emlak sunum uzmanısın. Bu mülkün öne çıkan özelliklerini vurgulayarak ikna edici, kısa bir sunum metni yaz. Türkçe.",
          `MÜLK:\n${propertyDetails}`,
          512,
        );
      } catch {
        aiSummary = "";
      }

      const sunumToken = randomBytes(16).toString("hex");
      const content = {
        customer: { name: propTitle, listing_type: body.listing_type || null, budget_max: null, rooms: body.rooms || null, location: body.location_neighborhood || body.location_district || null },
        properties: [{
          id: inserted.id,
          title: propTitle,
          price: propPrice,
          area: body.area ? Number(body.area) : null,
          rooms: body.rooms || null,
          type: body.type || null,
          listing_type: body.listing_type || null,
          location: body.location_neighborhood || body.location_district || null,
          description: body.description || null,
          image_url: null,
          features: null,
          interior_features: toArr(body.interior_features)?.join(", ") || null,
          exterior_features: toArr(body.exterior_features)?.join(", ") || null,
          view_features: toArr(body.view_features)?.join(", ") || null,
        }],
        ai_summary: aiSummary,
        created_at: new Date().toISOString(),
      };

      const { data: pres } = await supabase.from("emlak_presentations").insert({
        tenant_id: tenantId,
        user_id: magicToken.user_id,
        customer_id: null,
        property_ids: [inserted.id],
        title: propTitle,
        magic_token: sunumToken,
        content,
        ai_summary: aiSummary,
        status: "draft",
      }).select("id").single();

      if (pres) sunumUrl = `https://estateai.upudev.nl/d/p/${sunumToken}`;
    } catch (sunumErr) {
      console.error("[mulkekle:save] sunum generate failed:", sunumErr);
    }

    // WhatsApp bot message
    try {
      if (sunumUrl) {
        await sendUrlButton(userPhone,
          `✅ Mülk eklendi!\n\n📋 ${propTitle}\n💰 ${new Intl.NumberFormat("tr-TR").format(propPrice)} TL\n\n📊 Sunumun hazır. Şimdi inceleyelim.`,
          "📊 Sunumu Gör",
          sunumUrl,
          { skipNav: true },
        );
      } else {
        const { sendText } = await import("@/platform/whatsapp/send");
        await sendText(userPhone,
          `✅ Mülk eklendi!\n\n📋 ${propTitle}\n💰 ${new Intl.NumberFormat("tr-TR").format(propPrice)} TL\n\n✨ Sunum hazırlanıyor. Sunumlarım menüsünden görebilirsin.`,
        );
      }
    } catch (waErr) {
      console.error("[mulkekle:save] WA notify failed:", waErr);
    }

    return NextResponse.json({ success: true, propertyId: inserted.id, sunumUrl });
  } catch (err) {
    console.error("[mulkekle:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
