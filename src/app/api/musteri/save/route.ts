/**
 * /api/musteri/save — yeni müşteri kaydı (eşleştirme YOK).
 * Kayıt sonrası WA'ya "✅ Müşteri kaydedildi" mesajı + 2 yollu seçim
 * butonları after() içinde gönderilir:
 *   - 📋 Sözleşme Oluştur (cmd:sozlesme) — handleSozlesme tetiklenir
 *   - 🪪 Sonra (cmd:profilduzenle) — handleProfilDuzenle tetiklenir
 *
 * POST { token, name, phone, email?, listing_type, property_type[], rooms?,
 *        budget_min?, budget_max?, location?, notes? }
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const name = String(body.name || "").trim();
    if (name.length < 2) {
      return NextResponse.json({ error: "İsim en az 2 karakter olmalı." }, { status: 400 });
    }

    const phone = String(body.phone || "").trim();
    if (phone.length < 7) {
      return NextResponse.json({ error: "Geçerli telefon gerekli." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, whatsapp_phone")
      .eq("id", magicToken.user_id)
      .single();
    const tenantId = profile?.tenant_id as string | undefined;
    if (!tenantId) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const propertyType = Array.isArray(body.property_type) ? body.property_type : [];

    // looking_for primary array; legacy listing_type kolonu için derive et
    // ('satilik'+'kiralik' = 'hepsi'). Eski body.listing_type da kabul edilir
    // (geri uyum); yoksa array zorunlu.
    const lookingForRaw = Array.isArray(body.looking_for) ? body.looking_for : [];
    const lookingFor = lookingForRaw.filter((v: unknown): v is string => v === "satilik" || v === "kiralik");
    if (lookingFor.length === 0 && body.listing_type) {
      // backward-compat: tek string gelirse array'e çevir
      if (body.listing_type === "hepsi") lookingFor.push("satilik", "kiralik");
      else if (body.listing_type === "satilik" || body.listing_type === "kiralik") lookingFor.push(body.listing_type);
    }
    if (lookingFor.length === 0) {
      return NextResponse.json({ error: "En az bir ilan tipi seçin (Satılık / Kiralık)." }, { status: 400 });
    }
    const listingTypeDerived = lookingFor.length === 2 ? "hepsi" : lookingFor[0];

    const { data: inserted, error } = await supabase
      .from("emlak_customers")
      .insert({
        tenant_id: tenantId,
        user_id: magicToken.user_id,
        name,
        phone,
        email: body.email ? String(body.email).trim() : null,
        looking_for: lookingFor,
        listing_type: listingTypeDerived,
        property_type: propertyType.length > 0 ? propertyType : null,
        rooms: body.rooms || null,
        budget_min: body.budget_min ? Number(body.budget_min) : null,
        budget_max: body.budget_max ? Number(body.budget_max) : null,
        location: body.location || null,
        notes: body.notes || null,
        status: "aktif",
        pipeline_stage: "yeni",
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("[musteri:save]", error);
      return NextResponse.json({ error: error?.message || "Kaydedilemedi." }, { status: 500 });
    }

    const userPhone = profile?.whatsapp_phone as string | undefined;

    // Free-ride pattern (2026-05-06): "Sözleşme Yap / Sonra Profil" 2-button
    // chain transition kaldırıldı. Sadece sade onay mesajı — kullanıcı
    // sonraki adımı kendi inisiyatifiyle Panel'den seçer.
    after(async () => {
      try {
        if (!userPhone) return;
        const { sendText } = await import("@/platform/whatsapp/send");
        await sendText(
          userPhone,
          `✅ *Müşteri kaydedildi!*\n\n👤 ${name}\n📞 ${phone}`,
        );
      } catch (err) {
        console.error("[musteri:save] WA notify failed:", err);
      }
    });

    return NextResponse.json({ success: true, customerId: inserted.id });
  } catch (err) {
    console.error("[musteri:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
