/**
 * /api/takip/save — kullanıcının takip kriteri ekle veya düzenle.
 *
 * Multi-row (2026-05-08): id verilirse UPDATE, yoksa INSERT.
 * Kullanıcı başına max 5 aktif takip (uygulama-seviyesi limit).
 *
 * POST { token, id?, name, neighborhoods, property_types, listing_type, price_min, price_max }
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

const MAX_PER_USER = 5;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getServiceClient();
    const userId = auth.userId;

    const id = typeof body.id === "string" && body.id ? body.id : null;
    const isEdit = !!id;
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : "Takibim";
    const neighborhoods = Array.isArray(body.neighborhoods) ? body.neighborhoods : [];
    const propertyTypes = Array.isArray(body.property_types) ? body.property_types : [];
    const listingType = typeof body.listing_type === "string" && body.listing_type ? body.listing_type : null;
    const priceMin = Number.isFinite(Number(body.price_min)) && Number(body.price_min) > 0 ? Number(body.price_min) : null;
    const priceMax = Number.isFinite(Number(body.price_max)) && Number(body.price_max) > 0 ? Number(body.price_max) : null;

    if (isEdit) {
      // UPDATE — sadece kullanıcının kendi row'u
      const { error } = await supabase.from("emlak_tracking_criteria")
        .update({
          name,
          neighborhoods,
          property_types: propertyTypes,
          listing_type: listingType,
          price_min: priceMin,
          price_max: priceMax,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) {
        console.error("[takip:save] update", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, id });
    }

    // INSERT — limit kontrol
    const { count } = await supabase.from("emlak_tracking_criteria")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= MAX_PER_USER) {
      return NextResponse.json({
        error: `En fazla ${MAX_PER_USER} takip ekleyebilirsiniz. Mevcut takiplerinizden birini silin.`,
      }, { status: 400 });
    }

    const { data: inserted, error } = await supabase.from("emlak_tracking_criteria")
      .insert({
        user_id: userId,
        name,
        neighborhoods,
        property_types: propertyTypes,
        listing_type: listingType,
        price_min: priceMin,
        price_max: priceMax,
        active: true,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      console.error("[takip:save] insert", error);
      return NextResponse.json({ error: error?.message || "Kaydedilemedi." }, { status: 500 });
    }

    // WA bildirimi (yalnız ilk eklemede, edit'te değil)
    after(async () => {
      try {
        const sb = getServiceClient();
        const { data: profile } = await sb
          .from("profiles")
          .select("whatsapp_phone")
          .eq("id", userId)
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
          `✅ *Takip eklendi!*\n\n📍 *${name}*\nKriter: ${summary}\n\nYarın sabah 06:45'te bu kriterlere uyan yeni sahibi ilanlar WhatsApp'ınıza düşecek.`,
        );
        const { sendBackToPanel } = await import("@/tenants/emlak/menu");
        await sendBackToPanel(userId, phone);
      } catch (waErr) {
        console.error("[takip:save] WA notify failed:", waErr);
      }
    });

    return NextResponse.json({ success: true, id: inserted.id });
  } catch (err) {
    console.error("[takip:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
